import { supabaseAdmin } from './supabaseAdmin.js';
import { fetchWeatherByCoords, extractRainfallFactor } from './weatherService.js';
import { fetchElevation, normalizeElevation } from './elevationService.js';
import { calculateRiskScore, getHistoricalFactor } from './riskEngine.js';
import { broadcastAreaAlert } from './alertService.js';

/**
 * System-wide Monitor Service
 * Scans all saved locations to proactively find risks
 */
export async function runGlobalMonitoring() {
  console.log('🚀 [MonitorService] Starting global flood risk scan...');
  
  try {
    // 1. Get all unique locations saved by users
    const { data: locations, error } = await supabaseAdmin
      .from('saved_locations')
      .select('lat, lon, name');

    if (error) throw error;

    if (!locations || locations.length === 0) {
      console.log('[MonitorService] No saved locations to monitor.');
      return;
    }

    // 2. Filter to unique coordinates
    const uniqueCoords = Array.from(new Set(locations.map(l => `${l.lat},${l.lon}`)))
      .map(str => {
        const [lat, lon] = str.split(',').map(Number);
        return { lat, lon };
      });

    console.log(`[MonitorService] Monitoring ${uniqueCoords.length} unique areas...`);

    // 3. For each unique area, check the current risk
    for (const coord of uniqueCoords) {
      try {
        const [weatherData, elevation] = await Promise.all([
          fetchWeatherByCoords(coord.lat, coord.lon),
          fetchElevation(coord.lat, coord.lon),
        ]);

        const rainfallFactor   = extractRainfallFactor(weatherData);
        const elevationFactor  = normalizeElevation(elevation);
        const historicalFactor = getHistoricalFactor({ elevation });

        const riskResult = calculateRiskScore(rainfallFactor, elevationFactor, historicalFactor);

        // 4. If risk is found, trigger a broadcast to everyone in that 5km area
        if (riskResult.percentage > 40) {
          console.log(`[MonitorService] ⚠️ RISK DETECTED at ${weatherData.location?.name} (${riskResult.percentage}%)`);
          
          await broadcastAreaAlert(
            coord.lat, 
            coord.lon, 
            riskResult, 
            weatherData.location?.name || 'Unknown Location', 
            weatherData.current
          );
        }
      } catch (err) {
        console.error(`[MonitorService] Error checking ${coord.lat}, ${coord.lon}:`, err.message);
      }
    }

    console.log('✅ [MonitorService] Global scan complete.');
  } catch (err) {
    console.error('[MonitorService] Global Monitoring Failed:', err.message);
  }
}
