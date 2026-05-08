import { supabaseAdmin } from '../services/supabaseAdmin.js';

/**
 * GET /api/locations
 * Get all saved locations for the logged-in user
 */
export async function getSavedLocations(req, res) {
  try {
    const { data, error } = await supabaseAdmin
      .from('saved_locations')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) return res.status(400).json({ error: error.message });

    return res.status(200).json({ locations: data });
  } catch (err) {
    console.error('[GetLocations Error]', err.message);
    res.status(500).json({ error: 'Failed to fetch saved locations' });
  }
}

/**
 * POST /api/locations
 * Save a new location for the logged-in user
 * Body: { name, lat, lon }
 */
export async function saveLocation(req, res) {
  try {
    const { name, lat, lon } = req.body;

    // Ensure coordinates are numbers
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);

    if (!name || isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({ error: 'Valid name, lat, and lon are required' });
    }

    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized — no user identity' });
    }

    // Check for duplicate
    const { data: existing } = await supabaseAdmin
      .from('saved_locations')
      .select('id')
      .eq('user_id', req.user.id)
      .eq('lat', latitude)
      .eq('lon', longitude)
      .maybeSingle(); // maybeSingle is safer for checking existence

    if (existing) {
      return res.status(409).json({ error: 'Location already saved' });
    }

    const { data, error } = await supabaseAdmin
      .from('saved_locations')
      .insert({ 
        user_id: req.user.id, 
        name, 
        lat: latitude, 
        lon: longitude 
      })
      .select()
      .single();

    if (error) {
      console.error('[SaveLocation] Supabase Error:', error.message);
      return res.status(400).json({ error: error.message });
    }

    return res.status(201).json({ location: data, message: 'Location saved' });
  } catch (err) {
    console.error('[SaveLocation Error]', err.message);
    res.status(500).json({ error: 'Failed to save location' });
  }
}

/**
 * DELETE /api/locations/:id
 * Remove a saved location (must belong to user)
 */
export async function deleteLocation(req, res) {
  try {
    const { id } = req.params;

    const { error } = await supabaseAdmin
      .from('saved_locations')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user.id);

    if (error) return res.status(400).json({ error: error.message });

    return res.status(200).json({ message: 'Location removed' });
  } catch (err) {
    console.error('[DeleteLocation Error]', err.message);
    res.status(500).json({ error: 'Failed to delete location' });
  }
}
