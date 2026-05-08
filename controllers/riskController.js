import { fetchWeatherByCoords, fetchForecastByCoords, extractRainfallFactor, extractForecastRainfallFactor } from '../services/weatherService.js';
import { fetchElevation, fetchElevationBatch, normalizeElevation } from '../services/elevationService.js';
import {
  calculateRiskScore,
  getHistoricalFactor,
  generateAlerts,
  getRiskColor,
} from '../services/riskEngine.js';
import {
  validateCoordinates,
  validateLocationName,
  validateCoordinateBatch,
} from '../utils/validation.js';
import { processAlert, broadcastAreaAlert } from '../services/alertService.js';

/**
 * POST /api/risk/calculate
 * Body: { lat, lon, locationName? }
 */
export async function calculateRisk(req, res) {
  try {
    const { lat, lon, locationName } = req.body;
    const simulateExtreme = req.body.simulateExtreme === true;

    // Validate coordinates
    const coordValidation = validateCoordinates(lat, lon);
    if (!coordValidation.isValid) {
      return res.status(400).json({ error: coordValidation.error });
    }

    const latitude = coordValidation.lat;
    const longitude = coordValidation.lon;

    // Validate location name if provided
    if (locationName && !validateLocationName(locationName)) {
      return res.status(400).json({ error: 'Invalid location name' });
    }

    // Fetch weather & elevation in parallel
    const [weatherData, elevation] = await Promise.all([
      fetchWeatherByCoords(latitude, longitude),
      fetchElevation(latitude, longitude),
    ]);

    // Extract factors
    const rainfallFactor   = extractRainfallFactor(weatherData, simulateExtreme);
    const elevationFactor  = normalizeElevation(elevation);
    const historicalFactor = getHistoricalFactor({ elevation });

    // Calculate risk
    const riskResult = calculateRiskScore(rainfallFactor, elevationFactor, historicalFactor);

    // Generate alerts
    const alerts = generateAlerts(riskResult, weatherData);

    // Build response
    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      location: {
        lat: latitude,
        lon: longitude,
        name: weatherData.location?.name 
          ? `${weatherData.location.name} (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`
          : `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
        region: weatherData.location?.region || '',
        country: weatherData.location?.country || '',
      },
      weather: {
        temp_c:       weatherData.current?.temp_c,
        condition:    weatherData.current?.condition?.text,
        icon:         weatherData.current?.condition?.icon,
        precip_mm:    weatherData.current?.precip_mm,
        humidity:     weatherData.current?.humidity,
        wind_kph:     weatherData.current?.wind_kph,
        wind_dir:     weatherData.current?.wind_dir,
        feelslike_c:  weatherData.current?.feelslike_c,
        cloud:        weatherData.current?.cloud,
        vis_km:       weatherData.current?.vis_km,
        uv:           weatherData.current?.uv,
        last_updated: weatherData.current?.last_updated,
      },
      elevation: {
        meters: elevation,
        factor: elevationFactor,
      },
      risk: {
        score:      riskResult.score,
        percentage: riskResult.percentage,
        level:      riskResult.level,
        color:      getRiskColor(riskResult.level),
        breakdown:  riskResult.breakdown,
      },
      alerts,
    };

    // Trigger Automatic Alerts (Async - don't block the UI response)
    console.log(`[RiskController] ALERT_TRIGGER_CHECK: UserExists=${!!req.user}, Level=${riskResult.level}, Pct=${riskResult.percentage}%`);
    
    if (req.user) {
      if (riskResult.level === 'HIGH' || riskResult.level === 'MEDIUM') {
        // BROADCAST to all users who have this area saved (including current user if saved)
        // This follows the 'Strict' logic: only notify people with assets in the area.
        broadcastAreaAlert(
          latitude,
          longitude,
          riskResult,
          response.location.name,
          response.weather
        ).catch(e => console.error('[RiskController] Broadcast failed:', e.message));
      }
    }

    res.json(response);
  } catch (err) {
    console.error('[RiskController] calculate error:', err.message);
    res.status(500).json({ error: 'Risk calculation failed', details: err.message });
  }
}

/**
 * POST /api/risk/multi
 * Body: { locations: [{lat, lon, name}] }
 * Calculate risk for multiple points at once (for map visualization)
 */
export async function calculateMultiRisk(req, res) {
  try {
    const { locations } = req.body;
    const simulateExtreme = req.body.simulateExtreme === true;
    
    if (!Array.isArray(locations) || locations.length === 0) {
      return res.status(400).json({ error: 'locations array is required' });
    }

    // Limit to 10 points per request for safety
    const limited = locations.slice(0, 10);

    // 1. Validate all coordinates first
    const validatedPoints = limited.map(loc => {
      const v = validateCoordinates(loc.lat, loc.lon);
      return { ...loc, ...v };
    });

    if (validatedPoints.some(p => !p.isValid)) {
      return res.status(400).json({ error: 'One or more coordinates are invalid' });
    }

    // 2. Fetch all elevations in ONE batch call
    const elevations = await fetchElevationBatch(validatedPoints);

    // 3. Fetch weather data in parallel
    const weatherResults = await Promise.allSettled(
      validatedPoints.map(p => fetchWeatherByCoords(p.lat, p.lon))
    );

    // 4. Process all results
    const data = validatedPoints.map((p, i) => {
      const elevation = elevations[i];
      const weatherStatus = weatherResults[i];
      
      if (weatherStatus.status === 'rejected') {
        return { ...p, error: 'Weather data failed' };
      }

      const weatherData = weatherStatus.value;
      const rainfallFactor   = extractRainfallFactor(weatherData, simulateExtreme);
      const elevationFactor  = normalizeElevation(elevation);
      const historicalFactor = getHistoricalFactor({ elevation });
      const riskResult       = calculateRiskScore(rainfallFactor, elevationFactor, historicalFactor);
      const alerts           = generateAlerts(riskResult, weatherData);

      return {
        lat: p.lat,
        lon: p.lon,
        name: p.name || weatherData.location?.name,
        risk: { ...riskResult, color: getRiskColor(riskResult.level) },
        weather: {
          precip_mm: weatherData.current?.precip_mm,
          condition: weatherData.current?.condition?.text,
        },
        alerts,
      };
    });

    res.json({ success: true, timestamp: new Date().toISOString(), data });
  } catch (err) {
    console.error('[RiskController] multi error:', err.message);
    res.status(500).json({ error: 'Multi-risk calculation failed', details: err.message });
  }
}

/**
 * POST /api/risk/forecast
 * Body: { lat, lon }
 * Calculates 7-day risk forecast
 */
export async function calculateForecastRisk(req, res) {
  try {
    const { lat, lon } = req.body;
    
    const coordValidation = validateCoordinates(lat, lon);
    if (!coordValidation.isValid) {
      return res.status(400).json({ error: coordValidation.error });
    }

    const [weatherData, elevation] = await Promise.all([
      fetchForecastByCoords(coordValidation.lat, coordValidation.lon),
      fetchElevation(coordValidation.lat, coordValidation.lon),
    ]);

    const elevationFactor  = normalizeElevation(elevation);
    const historicalFactor = getHistoricalFactor({ elevation });

    const forecastDays = weatherData.forecast?.forecastday || [];
    
    const riskForecast = forecastDays.map(dayData => {
      const rainfallFactor = extractForecastRainfallFactor(dayData);
      const riskResult = calculateRiskScore(rainfallFactor, elevationFactor, historicalFactor);
      
      return {
        date: dayData.date,
        date_epoch: dayData.date_epoch,
        risk: {
          ...riskResult,
          color: getRiskColor(riskResult.level)
        },
        weather: {
          maxtemp_c: dayData.day?.maxtemp_c,
          mintemp_c: dayData.day?.mintemp_c,
          totalprecip_mm: dayData.day?.totalprecip_mm,
          condition: dayData.day?.condition?.text,
          icon: dayData.day?.condition?.icon,
        }
      };
    });

    res.json({
      success: true,
      location: weatherData.location,
      forecast: riskForecast
    });

  } catch (err) {
    console.error('[RiskController] forecast error:', err.message);
    res.status(500).json({ error: 'Forecast risk calculation failed', details: err.message });
  }
}
