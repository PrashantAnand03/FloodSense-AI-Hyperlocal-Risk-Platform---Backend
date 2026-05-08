import {
  fetchWeatherByCoords,
  fetchForecastByCoords,
  extractRainfallFactor,
} from '../services/weatherService.js';
import { fetchElevation, normalizeElevation } from '../services/elevationService.js';
import {
  calculateRiskScore,
  getHistoricalFactor,
  generateAlerts,
  getRiskColor,
} from '../services/riskEngine.js';

// Track connected clients
let connectedClients = 0;

export function setupSocketHandlers(io) {
  io.on('connection', (socket) => {
    connectedClients++;
    console.log(`[Socket] Client connected: ${socket.id} | Total: ${connectedClients}`);

    // Send welcome
    socket.emit('connected', {
      message: 'Connected to Hyperlocal Flood System',
      clientId: socket.id,
      timestamp: new Date().toISOString(),
    });

    // Client subscribes to location updates
    socket.on('subscribe_location', async ({ lat, lon, locationName }) => {
      try {
        console.log(`[Socket] ${socket.id} subscribing to: ${lat}, ${lon}`);

        // Calculate initial risk
        const riskData = await computeRisk(lat, lon, locationName);
        socket.emit('risk_update', riskData);

        // Store subscription on socket for periodic updates
        socket.subscribedLocation = { lat, lon, locationName };
      } catch (err) {
        console.error('[Socket] subscribe_location error:', err.message);
        socket.emit('error', { message: 'Failed to compute risk for location' });
      }
    });

    // Client requests manual refresh
    socket.on('refresh_risk', async ({ lat, lon, locationName }) => {
      try {
        const riskData = await computeRisk(lat, lon, locationName);
        socket.emit('risk_update', riskData);
      } catch (err) {
        socket.emit('error', { message: 'Refresh failed' });
      }
    });

    // Client unsubscribes
    socket.on('unsubscribe_location', () => {
      socket.subscribedLocation = null;
      socket.emit('unsubscribed', { message: 'Unsubscribed from location updates' });
    });

    socket.on('disconnect', () => {
      connectedClients--;
      console.log(`[Socket] Client disconnected: ${socket.id} | Total: ${connectedClients}`);
    });
  });

  // Periodic updates every 5 minutes for all subscribed clients
  setInterval(async () => {
    const sockets = await io.fetchSockets();
    for (const socket of sockets) {
      if (socket.subscribedLocation) {
        const { lat, lon, locationName } = socket.subscribedLocation;
        try {
          const riskData = await computeRisk(lat, lon, locationName);
          socket.emit('risk_update', riskData);
          console.log(`[Socket] Pushed update to ${socket.id}`);
        } catch (err) {
          console.warn(`[Socket] Update failed for ${socket.id}:`, err.message);
        }
      }
    }
  }, 5 * 60 * 1000); // every 5 minutes
}

/**
 * Shared risk computation used by both HTTP and Socket routes
 */
async function computeRisk(lat, lon, locationName) {
  const [weatherData, forecaastData, elevation] = await Promise.all([
    fetchWeatherByCoords(parseFloat(lat), parseFloat(lon)),
    fetchForecastByCoords(parseFloat(lat), parseFloat(lon)), // 3-day forecast
    fetchElevation(parseFloat(lat), parseFloat(lon)),
  ]);

  const rainfallFactor   = extractRainfallFactor(weatherData);
  const elevationFactor  = normalizeElevation(elevation);
  const historicalFactor = getHistoricalFactor({ elevation });
  const riskResult       = calculateRiskScore(rainfallFactor, elevationFactor, historicalFactor);
  const alerts           = generateAlerts(riskResult, weatherData);

  // Extract forecast data (3-day outlook)
  const forecast = (forecaastData?.forecast?.forecastday || []).slice(0, 3).map(day => ({
    date: day.date,
    avgTemp: day.day?.avg_temp_c,
    maxTemp: day.day?.max_temp_c,
    minTemp: day.day?.min_temp_c,
    condition: day.day?.condition?.text,
    icon: day.day?.condition?.icon,
    rainMm: day.day?.totalprecip_mm,
    riskLevel: calculateDayRiskLevel(day.day?.totalprecip_mm),
  }));

  return {
    timestamp: new Date().toISOString(),
    location: {
      lat:     parseFloat(lat),
      lon:     parseFloat(lon),
      name:    locationName || weatherData.location?.name,
      region:  weatherData.location?.region,
      country: weatherData.location?.country,
    },
    weather: {
      temp_c:    weatherData.current?.temp_c,
      condition: weatherData.current?.condition?.text,
      icon:      weatherData.current?.condition?.icon,
      precip_mm: weatherData.current?.precip_mm,
      humidity:  weatherData.current?.humidity,
      wind_kph:  weatherData.current?.wind_kph,
    },
    forecast, // 3-day forecast included
    elevation: { meters: elevation, factor: elevationFactor },
    risk: {
      score:      riskResult.score,
      percentage: riskResult.percentage,
      level:      riskResult.level,
      color:      getRiskColor(riskResult.level),
      breakdown:  riskResult.breakdown,
    },
    alerts,
  };
}

/**
 * Determine risk level for a day based on precipitation
 */
function calculateDayRiskLevel(rainMm) {
  if (!rainMm) return 'LOW';
  if (rainMm > 50) return 'HIGH';
  if (rainMm > 20) return 'MEDIUM';
  return 'LOW';
}
