/**
 * AI-Inspired Flood Risk Engine
 * 
 * Risk Score = Rainfall × 0.50 + Elevation × 0.30 + Historical × 0.20
 * 
 * Each factor is normalized to 0–1 range.
 * Final score 0–1 maps to: Low / Medium / High
 */

// Weights as per the proposal
const WEIGHTS = {
  rainfall:   0.50,
  elevation:  0.30,
  historical: 0.20,
};

// Risk thresholds
const THRESHOLDS = {
  LOW:    0.40,
  MEDIUM: 0.65,
};

/**
 * Historical risk factors by region — baseline patterns
 * Based on UK flood-prone area baselines (expandable)
 */
const HISTORICAL_PATTERNS = {
  default: 0.3,   // baseline for unknown areas
  coastal: 0.7,   // coastal zones historically high risk
  river:   0.65,  // riverside areas
  urban:   0.5,   // urban drainage issues
  rural:   0.25,  // rural lower risk
  hill:    0.1,   // elevated rural areas
};

/**
 * Determine historical factor based on location metadata
 * @param {object} locationMeta - { isCoastal, isUrban, isRiver, elevation }
 */
export function getHistoricalFactor(locationMeta = {}) {
  const { isCoastal, isUrban, isRiver, elevation } = locationMeta;

  if (isCoastal) return HISTORICAL_PATTERNS.coastal;
  if (isRiver)   return HISTORICAL_PATTERNS.river;
  if (isUrban)   return HISTORICAL_PATTERNS.urban;
  if (elevation !== undefined && elevation > 200) return HISTORICAL_PATTERNS.hill;
  return HISTORICAL_PATTERNS.default;
}

/**
 * Core risk score calculation
 * @param {number} rainfallFactor   - normalized 0–1 (from weatherService)
 * @param {number} elevationFactor  - normalized 0–1 (from elevationService)
 * @param {number} historicalFactor - normalized 0–1 (from getHistoricalFactor)
 * @returns {object} { score, level, breakdown }
 */
export function calculateRiskScore(rainfallFactor, elevationFactor, historicalFactor) {
  // Weighted sum
  const score =
    rainfallFactor   * WEIGHTS.rainfall +
    elevationFactor  * WEIGHTS.elevation +
    historicalFactor * WEIGHTS.historical;

  const clampedScore = Math.min(Math.max(score, 0), 1);
  const percentage   = Math.round(clampedScore * 100);

  // Calculate risk level based on score
  let level = 'LOW';
  if (clampedScore >= THRESHOLDS.MEDIUM) level = 'HIGH';
  else if (clampedScore >= THRESHOLDS.LOW) level = 'MEDIUM';
  
  console.log(`[RiskEngine] 🧪 Math: Rain=${(rainfallFactor * WEIGHTS.rainfall).toFixed(3)} + Elev=${(elevationFactor * WEIGHTS.elevation).toFixed(3)} + Hist=${(historicalFactor * WEIGHTS.historical).toFixed(3)} = ${clampedScore.toFixed(3)} (${level})`);

  // AI Commentary Generation
  let ai_commentary = '';
  if (clampedScore < THRESHOLDS.LOW) {
    ai_commentary = 'Conditions are currently stable. Low risk detected. Our AI models indicate minimal threat from current rainfall and elevation patterns.';
  } else if (clampedScore < THRESHOLDS.MEDIUM) {
    ai_commentary = 'Elevated risk detected. AI analysis suggests moderate vulnerability. Prepare emergency supplies and monitor local updates closely.';
  } else {
    ai_commentary = 'CRITICAL ALERT: AI models predict a high probability of localized flooding. Immediate preparation for evacuation is advised for low-lying areas.';
  }

  return {
    score:      clampedScore,
    percentage,
    level,
    ai_commentary,
    breakdown: {
      rainfall:   { raw: rainfallFactor,   weighted: rainfallFactor   * WEIGHTS.rainfall,   weight: WEIGHTS.rainfall },
      elevation:  { raw: elevationFactor,  weighted: elevationFactor  * WEIGHTS.elevation,  weight: WEIGHTS.elevation },
      historical: { raw: historicalFactor, weighted: historicalFactor * WEIGHTS.historical, weight: WEIGHTS.historical },
    },
  };
}

/**
 * Generate actionable alerts based on risk level and weather
 */
export function generateAlerts(riskResult, weatherData) {
  const { level, percentage } = riskResult;
  const alerts = [];

  if (level === 'HIGH') {
    alerts.push({
      type:    'EVACUATE',
      icon:    '🚨',
      title:   'Immediate Evacuation Advised',
      message: `Flood risk is critically high (${percentage}%). Move to higher ground immediately.`,
      color:   'red',
      priority: 1,
    });
    alerts.push({
      type:    'MOVE_VALUABLES',
      icon:    '📦',
      title:   'Move Valuables',
      message: 'Move electronics, documents, and valuables to upper floors or safe locations.',
      color:   'red',
      priority: 2,
    });
  }

  if (level === 'MEDIUM') {
    alerts.push({
      type:    'STAY_ALERT',
      icon:    '⚠️',
      title:   'Stay Alert',
      message: `Moderate flood risk detected (${percentage}%). Monitor conditions and prepare for possible flooding.`,
      color:   'yellow',
      priority: 1,
    });
    alerts.push({
      type:    'PREPARE',
      icon:    '🏠',
      title:   'Prepare Emergency Kit',
      message: 'Have emergency supplies ready. Know your evacuation route.',
      color:   'yellow',
      priority: 2,
    });
  }

  if (level === 'LOW') {
    alerts.push({
      type:    'SAFE',
      icon:    '✅',
      title:   'Area Currently Safe',
      message: `Low flood risk (${percentage}%). Continue monitoring conditions.`,
      color:   'green',
      priority: 1,
    });
  }

  // Weather-specific alerts
  if (weatherData?.current?.precip_mm > 20) {
    alerts.push({
      type:    'HEAVY_RAIN',
      icon:    '🌧️',
      title:   'Heavy Rainfall Warning',
      message: `${weatherData.current.precip_mm}mm of rain recorded. Drainage systems may be overwhelmed.`,
      color:   level === 'HIGH' ? 'red' : 'yellow',
      priority: 3,
    });
  }

  return alerts.sort((a, b) => a.priority - b.priority);
}

/**
 * Get risk color for map visualization
 */
export function getRiskColor(level) {
  switch (level) {
    case 'HIGH':   return '#ef4444';
    case 'MEDIUM': return '#f59e0b';
    case 'LOW':    return '#22c55e';
    default:       return '#94a3b8';
  }
}
