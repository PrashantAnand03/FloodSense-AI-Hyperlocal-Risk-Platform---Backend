import { supabaseAdmin } from './supabaseAdmin.js';
import { sendAlertEmail } from './emailService.js';

/**
 * Alert Management Service
 * Coordinates database storage and external notifications
 */
export async function processAlert(userId, userEmail, riskResult, locationName, assessmentId = null, weatherInfo = {}) {
  try {
    const { level, score, percentage } = riskResult;
    
    console.log(`[AlertService] 🔍 Alert Evaluator: Level=${level}, Pct=${percentage}% (Target > 40%)`);

    // Only alert for HIGH and MEDIUM risk, and only if score > 40% as requested
    if (level === 'LOW' || percentage <= 40) {
      console.log(`[AlertService] ℹ️ Skipping alert. Level=${level}, Score=${percentage}%. (Threshold is >40%)`);
      return null;
    }

    // 1. Save to Alerts History in Database
    const { data: alertData, error: dbError } = await supabaseAdmin
      .from('alerts_history')
      .insert({
        user_id: userId,
        assessment_id: assessmentId,
        location_name: locationName,
        alert_type: level === 'HIGH' ? 'EVACUATE' : 'PREPARE',
        alert_title: level === 'HIGH' ? '🚨 Immediate Evacuation Advised' : '⚠️ Stay Alert',
        alert_message: level === 'HIGH' 
          ? `Flood risk is critically high (${percentage}%). Move to higher ground immediately.` 
          : `Moderate flood risk detected (${percentage}%). Prepare your emergency kit.`,
        risk_level: level
      })
      .select()
      .single();

    if (dbError) {
      console.error('[AlertService] DB Error:', dbError.message);
    }

    // 2. Send Automatic Informative Email Alert
    const emailResult = await sendAlertEmail(
      userEmail, 
      locationName, 
      level, 
      percentage,
      weatherInfo,
      riskResult.ai_commentary
    );

    return {
      alertId: alertData?.id,
      emailSent: emailResult.success
    };
  } catch (err) {
    console.error('[AlertService] General Error:', err.message);
    return null;
  }
}

/**
 * Broadcast alerts to all users near a specific coordinate
 */
export async function broadcastAreaAlert(lat, lon, riskResult, locationName, weatherInfo = {}) {
  try {
    const { level, percentage } = riskResult;

    // Only broadcast if risk is > 40%
    if (level === 'LOW' || percentage <= 40) return null;

    const radius = 0.05; // Roughly 5km radius
    
    // 1. Find all saved locations
    const { data: allLocs, error: locError } = await supabaseAdmin
      .from('saved_locations')
      .select('user_id, lat, lon, name');

    if (locError) {
      console.error('[AlertService] Location Query Error:', locError.message);
      return null;
    }

    // 2. Filter to those within the 5km radius (~0.05 degrees)
    const nearbyLocs = allLocs.filter(loc => {
      const latDiff = Math.abs(loc.lat - lat);
      const lonDiff = Math.abs(loc.lon - lon);
      return latDiff <= radius && lonDiff <= radius;
    });

    console.log(`[AlertService] 📍 Scan results: Found ${allLocs.length} total saved spots. ${nearbyLocs.length} are within 5km.`);

    const userIds = [...new Set(nearbyLocs.map(l => l.user_id))];

    if (userIds.length === 0) {
      console.log(`[AlertService] ℹ️ No users had a saved location near ${locationName}.`);
      return { broadcastCount: 0 };
    }

    console.log(`[AlertService] 🔍 Searching for profiles matching IDs: [${userIds.join(', ')}]`);

    // 3. Fetch emails for these specific users
    // We try the profiles table first, but we add a fallback to the Auth system
    let profiles = [];
    const { data: profData, error: profError } = await supabaseAdmin
      .from('profiles')
      .select('id, email')
      .in('id', userIds);

    if (!profError && profData && profData.length > 0) {
      profiles = profData;
    }

    // FALLBACK: If some users are missing from the 'profiles' table, 
    // fetch them directly from Supabase Auth (The ultimate source of truth)
    const foundIds = new Set(profiles.map(p => p.id));
    const missingIds = userIds.filter(id => !foundIds.has(id));

    if (missingIds.length > 0) {
      console.log(`[AlertService] 🔄 Healing data: Fetching ${missingIds.length} users directly from Auth system...`);
      for (const id of missingIds) {
        try {
          const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(id);
          if (!authError && authUser?.user?.email) {
            profiles.push({ id, email: authUser.user.email });
          }
        } catch (e) {
          console.error(`[AlertService] Auth Fallback failed for ${id}:`, e.message);
        }
      }
    }

    if (profiles.length === 0) {
      console.warn(`[AlertService] ❌ FAIL: Could not find any emails for IDs: [${userIds.join(', ')}] even with Auth fallback.`);
      return { broadcastCount: 0 };
    }

    console.log(`[AlertService] 📣 Broadcasting Emergency Alert to ${profiles.length} users: [${profiles.map(p => p.email).join(', ')}]`);

    // 4. Loop through and send alerts
    for (const profile of profiles) {
      if (profile.email) {
        processAlert(profile.id, profile.email, riskResult, locationName, null, weatherInfo)
          .catch(err => console.error(`[AlertService] Failed to notify ${profile.email}:`, err.message));
      }
    }

    return { broadcastCount: profiles.length };
  } catch (err) {
    console.error('[AlertService] Broadcast Error:', err.message);
    return null;
  }
}
