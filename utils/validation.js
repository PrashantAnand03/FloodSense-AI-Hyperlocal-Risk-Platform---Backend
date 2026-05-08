/**
 * Input Validation & Sanitization Utilities
 * Protects against bad data, XSS, and SQL injection patterns
 */

/**
 * Validate latitude & longitude coordinates
 * @param {number} lat - Latitude (-90 to 90)
 * @param {number} lon - Longitude (-180 to 180)
 * @returns {object} { isValid, error }
 */
export function validateCoordinates(lat, lon) {
  const latitude = parseFloat(lat);
  const longitude = parseFloat(lon);

  if (isNaN(latitude) || isNaN(longitude)) {
    return { isValid: false, error: 'Coordinates must be valid numbers' };
  }

  if (latitude < -90 || latitude > 90) {
    return { isValid: false, error: 'Latitude must be between -90 and 90' };
  }

  if (longitude < -180 || longitude > 180) {
    return { isValid: false, error: 'Longitude must be between -180 and 180' };
  }

  return { isValid: true, lat: latitude, lon: longitude };
}

/**
 * Validate email format
 * @param {string} email
 * @returns {boolean}
 */
export function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

/**
 * Validate password strength
 * @param {string} password
 * @returns {object} { isValid, strength, feedback }
 */
export function validatePassword(password) {
  if (!password || password.length < 6) {
    return { isValid: false, strength: 'weak', feedback: 'At least 6 characters required' };
  }

  if (password.length < 8) {
    return { isValid: true, strength: 'weak', feedback: 'Consider using 8+ characters' };
  }

  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*]/.test(password);

  const strengthScore = [hasUppercase, hasLowercase, hasNumber, hasSpecial].filter(Boolean).length;

  let strength = 'weak';
  if (strengthScore >= 3) strength = 'strong';
  else if (strengthScore >= 2) strength = 'medium';

  return {
    isValid: true,
    strength,
    feedback: strength === 'strong' ? 'Strong password' : `Add ${4 - strengthScore} more character types`,
  };
}

/**
 * Sanitize text input (prevent XSS)
 * @param {string} text
 * @returns {string}
 */
export function sanitizeText(text) {
  if (typeof text !== 'string') return '';

  return text
    .trim()
    .substring(0, 500) // Max 500 chars
    .replace(/[<>\"']/g, '') // Remove HTML/JS characters
    .replace(/\s+/g, ' '); // Collapse whitespace
}

/**
 * Validate location name
 * @param {string} name
 * @returns {boolean}
 */
export function validateLocationName(name) {
  if (!name || typeof name !== 'string') return false;
  const clean = sanitizeText(name);
  return clean.length >= 1 && clean.length <= 500;
}

/**
 * Validate risk assessment data before saving
 * @param {object} data
 * @returns {object} { isValid, errors }
 */
export function validateRiskAssessment(data) {
  const errors = [];

  const { lat, lon, riskScore, riskLevel, locationName } = data;

  if (!validateCoordinates(lat, lon).isValid) {
    errors.push('Invalid coordinates');
  }

  if (riskScore === undefined || riskScore < 0 || riskScore > 1) {
    errors.push('Risk score must be between 0 and 1');
  }

  if (!['LOW', 'MEDIUM', 'HIGH'].includes(riskLevel)) {
    errors.push('Invalid risk level');
  }

  if (!validateLocationName(locationName)) {
    errors.push('Invalid location name');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate array of coordinates for batch requests
 * @param {array} coordinates - Array of { lat, lon }
 * @param {number} maxItems - Maximum array size (default 10)
 * @returns {object} { isValid, error }
 */
export function validateCoordinateBatch(coordinates, maxItems = 10) {
  if (!Array.isArray(coordinates)) {
    return { isValid: false, error: 'Coordinates must be an array' };
  }

  if (coordinates.length === 0) {
    return { isValid: false, error: 'At least one coordinate required' };
  }

  if (coordinates.length > maxItems) {
    return { isValid: false, error: `Maximum ${maxItems} locations per request` };
  }

  for (let i = 0; i < coordinates.length; i++) {
    const { isValid, error } = validateCoordinates(coordinates[i].lat, coordinates[i].lon);
    if (!isValid) {
      return { isValid: false, error: `Location ${i + 1}: ${error}` };
    }
  }

  return { isValid: true };
}

/**
 * Validate search query
 * @param {string} query
 * @returns {object} { isValid, error, clean_query }
 */
export function validateSearchQuery(query) {
  if (!query || typeof query !== 'string') {
    return { isValid: false, error: 'Search query required' };
  }

  const clean = sanitizeText(query);

  if (clean.length < 1) {
    return { isValid: false, error: 'Query too short' };
  }

  if (clean.length > 100) {
    return { isValid: false, error: 'Query too long (max 100 characters)' };
  }

  return { isValid: true, clean_query: clean };
}

/**
 * Rate limit helper - track requests per IP
 * @param {Map} requests - In-memory request tracker
 * @param {string} ip - Client IP
 * @param {number} maxPerMinute - Max requests per minute
 * @returns {object} { allowed, remaining, resetTime }
 */
export function checkRateLimit(requests, ip, maxPerMinute = 30) {
  const now = Date.now();
  const oneMinuteAgo = now - 60000;

  // Initialize or clean old entries
  if (!requests.has(ip)) {
    requests.set(ip, []);
  }

  let times = requests.get(ip);
  times = times.filter(t => t > oneMinuteAgo); // Remove old timestamps
  requests.set(ip, times);

  if (times.length >= maxPerMinute) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: new Date(times[0] + 60000).toISOString(),
    };
  }

  times.push(now);
  requests.set(ip, times);

  return {
    allowed: true,
    remaining: maxPerMinute - times.length,
    resetTime: new Date(now + 60000).toISOString(),
  };
}
