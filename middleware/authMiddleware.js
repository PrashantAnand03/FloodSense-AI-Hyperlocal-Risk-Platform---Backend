import { supabaseAdmin } from '../services/supabaseAdmin.js';
import dotenv from 'dotenv';
dotenv.config();

/**
 * Middleware: Verify JWT from Authorization header
 * Uses supabaseAdmin.auth.getUser() for robust verification
 */
export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized — no token provided' });
    }

    const token = authHeader.split(' ')[1];

    if (!token || token.length < 20) {
      return res.status(401).json({ error: 'Unauthorized — token malformed' });
    }

    // Verify using Supabase admin client (most reliable)
    const { data, error } = await supabaseAdmin.auth.getUser(token);

    if (error) {
      console.error('[Auth] Token verification failed:', error.message);
      return res.status(401).json({ error: 'Unauthorized — ' + error.message });
    }

    if (!data?.user) {
      return res.status(401).json({ error: 'Unauthorized — user not found' });
    }

    const authUser = data.user;

    // Fetch profile for role
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, role')
      .eq('id', authUser.id)
      .single();

    console.log(`[Auth] User: ${authUser.email} (${authUser.id}), Role: ${profile?.role || 'user'}`);

    req.user = {
      id:       authUser.id,
      email:    authUser.email,
      role:     profile?.role || 'user',
      fullName: profile?.full_name || '',
    };

    next();
  } catch (err) {
    console.error('[Auth Middleware Error]', err.message);
    res.status(500).json({ error: 'Internal auth error' });
  }
}

/**
 * Middleware: Require admin role
 */
export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden — admin access only' });
  }
  next();
}
