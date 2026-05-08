import { supabaseAdmin } from '../services/supabaseAdmin.js';
import {
  validateEmail,
  validatePassword,
  sanitizeText,
} from '../utils/validation.js';

/**
 * POST /api/auth/register
 * Body: { email, password, fullName }
 */
export async function register(req, res) {
  try {
    const { email, password, fullName } = req.body;

    // Validate required fields
    if (!email || !password || !fullName) {
      return res.status(400).json({ error: 'Email, password, and full name are required' });
    }

    // Validate email format
    if (!validateEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        error: passwordValidation.feedback,
        strength: passwordValidation.strength,
      });
    }

    // Sanitize full name
    const sanitizedFullName = sanitizeText(fullName);
    if (sanitizedFullName.length < 2) {
      return res.status(400).json({ error: 'Full name must be at least 2 characters' });
    }

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: { full_name: sanitizedFullName },
    });

    if (authError) {
      if (authError.message.includes('already registered')) {
        return res.status(409).json({ error: 'Email already in use' });
      }
      return res.status(400).json({ error: authError.message });
    }

    const userId = authData.user.id;

    // Create profile in profiles table
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: userId,
        full_name: sanitizedFullName,
        email: email.toLowerCase(),
        role: 'user',
      });

    if (profileError) {
      console.error('[Register] Profile creation failed:', profileError.message);
    }

    return res.status(201).json({
      message: 'Account created successfully',
      user: {
        id: userId,
        email: email.toLowerCase(),
        fullName: sanitizedFullName,
        role: 'user',
      },
    });
  } catch (err) {
    console.error('[Register Error]', err.message);
    res.status(500).json({ error: 'Registration failed' });
  }
}

/**
 * POST /api/auth/login
 * Body: { email, password }
 * Returns: { user, session: { access_token, refresh_token } }
 */
export async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Sign in via Supabase Auth
    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Fetch profile for role
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    return res.status(200).json({
      message: 'Login successful',
      user: {
        id: data.user.id,
        email: data.user.email,
        fullName: profile?.full_name || '',
        role: profile?.role || 'user',
        avatarUrl: profile?.avatar_url || null,
      },
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
      },
    });
  } catch (err) {
    console.error('[Login Error]', err.message);
    res.status(500).json({ error: 'Login failed' });
  }
}

/**
 * POST /api/auth/logout
 * Requires: Bearer token
 */
export async function logout(req, res) {
  try {
    // Supabase handles session invalidation on client side
    // Server just confirms
    return res.status(200).json({ message: 'Logged out successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Logout failed' });
  }
}

/**
 * GET /api/auth/me
 * Returns current user profile
 */
export async function getMe(req, res) {
  try {
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', req.user.id)
      .single();

    if (error) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    return res.status(200).json({
      user: {
        id: req.user.id,
        email: req.user.email,
        fullName: profile.full_name,
        role: profile.role,
        avatarUrl: profile.avatar_url,
        createdAt: profile.created_at,
      },
    });
  } catch (err) {
    console.error('[GetMe Error]', err.message);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
}

/**
 * PATCH /api/auth/profile
 * Body: { fullName }
 * Update user profile
 */
export async function updateProfile(req, res) {
  try {
    const { fullName } = req.body;

    if (!fullName) {
      return res.status(400).json({ error: 'Full name is required' });
    }

    // Sanitize full name
    const sanitizedFullName = sanitizeText(fullName);
    if (sanitizedFullName.length < 2) {
      return res.status(400).json({ error: 'Full name must be at least 2 characters' });
    }

    const { error } = await supabaseAdmin
      .from('profiles')
      .update({
        full_name: sanitizedFullName,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.user.id);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({ message: 'Profile updated successfully' });
  } catch (err) {
    console.error('[UpdateProfile Error]', err.message);
    res.status(500).json({ error: 'Failed to update profile' });
  }
}

/**
 * GET /api/auth/users  (Admin only)
 * List all registered users
 */
export async function getAllUsers(req, res) {
  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email, role, created_at')
      .order('created_at', { ascending: false });

    if (error) return res.status(400).json({ error: error.message });

    return res.status(200).json({ users: data });
  } catch (err) {
    console.error('[GetAllUsers Error]', err.message);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
}

/**
 * DELETE /api/auth/users/:id  (Admin only)
 * Delete a user by ID (removes from auth and profiles)
 */
export async function deleteUser(req, res) {
  try {
    const { id } = req.params;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    // Prevent admin from deleting themselves
    if (id === req.user.id) {
      return res.status(403).json({ error: 'You cannot delete your own account' });
    }

    // Delete from Supabase Auth
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id);

    if (authError) {
      console.error('[DeleteUser] Auth deletion error:', authError.message);
      return res.status(400).json({ error: 'Failed to delete user from auth' });
    }

    // Delete from profiles table (cascades to other tables via FK)
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', id);

    if (profileError) {
      console.error('[DeleteUser] Profile deletion warning:', profileError.message);
    }

    console.log(`[DeleteUser] Successfully deleted user: ${id}`);

    return res.status(200).json({
      message: 'User deleted successfully',
      userId: id,
    });
  } catch (err) {
    console.error('[DeleteUser Error]', err.message);
    res.status(500).json({ error: 'Failed to delete user' });
  }
}
