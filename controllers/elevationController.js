import { fetchElevation, normalizeElevation } from '../services/elevationService.js';

/**
 * GET /api/elevation?lat=&lon=
 */
export async function getElevation(req, res) {
  try {
    const { lat, lon } = req.query;
    if (!lat || !lon) return res.status(400).json({ error: 'lat and lon are required' });

    const elevation = await fetchElevation(parseFloat(lat), parseFloat(lon));
    const factor = normalizeElevation(elevation);

    res.json({
      success: true,
      data: {
        elevation,
        factor,
        unit: 'meters',
      },
    });
  } catch (err) {
    console.error('[ElevationController]', err.message);
    res.status(500).json({ error: 'Failed to fetch elevation', details: err.message });
  }
}
