import { supabaseAdmin } from '../services/supabaseAdmin.js';

/**
 * POST /api/history
 * Save a risk assessment to history
 * Body: full risk assessment object from riskController
 */
export async function saveAssessment(req, res) {
  try {
    const {
      locationName, lat, lon,
      riskScore, riskLevel,
      rainfallFactor, elevationFactor, historicalFactor,
      elevationM, temperatureC, humidityPct, windKph, precipMm,
      weatherSnapshot,
    } = req.body;

    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized — no user identity' });
    }

    const { data, error } = await supabaseAdmin
      .from('risk_assessments')
      .insert({
        user_id:          req.user.id,
        location_name:    locationName,
        lat:              parseFloat(lat),
        lon:              parseFloat(lon),
        risk_score:       riskScore,
        risk_level:       riskLevel,
        rainfall_factor:  rainfallFactor,
        elevation_factor: elevationFactor,
        historical_factor: historicalFactor,
        elevation_m:      elevationM,
        temperature_c:    temperatureC,
        humidity_pct:     humidityPct,
        wind_kph:         windKph,
        precip_mm:        precipMm,
        weather_snapshot: weatherSnapshot,
      })
      .select()
      .single();

    if (error) {
      console.error('[SaveAssessment] Supabase Error:', error.message);
      return res.status(400).json({ error: error.message });
    }

    return res.status(201).json({ assessment: data });
  } catch (err) {
    console.error('[SaveAssessment Error]', err.message);
    res.status(500).json({ error: 'Failed to save assessment' });
  }
}

/**
 * GET /api/history
 * Get all risk assessments for the logged-in user
 * Query: ?limit=50&location=name
 */
export async function getHistory(req, res) {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const location = req.query.location;

    let query = supabaseAdmin
      .from('risk_assessments')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (location) {
      query = query.ilike('location_name', `%${location}%`);
    }

    const { data, error } = await query;
    if (error) return res.status(400).json({ error: error.message });

    return res.status(200).json({ history: data });
  } catch (err) {
    console.error('[GetHistory Error]', err.message);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
}

/**
 * GET /api/history/stats
 * Summary stats: total assessments, avg risk, highest level etc.
 */
export async function getHistoryStats(req, res) {
  try {
    const { data, error } = await supabaseAdmin
      .from('risk_assessments')
      .select('risk_score, risk_level, created_at, location_name')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) return res.status(400).json({ error: error.message });

    const total = data.length;
    const avgScore = total
      ? (data.reduce((s, r) => s + parseFloat(r.risk_score), 0) / total).toFixed(3)
      : 0;
    const highCount   = data.filter(r => r.risk_level === 'HIGH').length;
    const mediumCount = data.filter(r => r.risk_level === 'MEDIUM').length;
    const lowCount    = data.filter(r => r.risk_level === 'LOW').length;

    return res.status(200).json({
      stats: { total, avgScore, highCount, mediumCount, lowCount },
    });
  } catch (err) {
    console.error('[GetStats Error]', err.message);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
}

/**
 * DELETE /api/history/:id
 * Delete a specific assessment
 */
export async function deleteAssessment(req, res) {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin
      .from('risk_assessments')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user.id);

    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json({ message: 'Assessment deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete assessment' });
  }
}
