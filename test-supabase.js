import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

async function testSupabase() {
  console.log('Testing Supabase query...');
  const { data, error } = await supabaseAdmin
    .from('risk_assessments')
    .select('*')
    .limit(1);
    
  if (error) {
    console.error('Supabase Query Error:', error);
  } else {
    console.log('Supabase Query Success:', data);
  }

  console.log('Testing Insert...');
  // Find a user ID first
  const { data: users, error: userErr } = await supabaseAdmin.auth.admin.listUsers();
  if (userErr || !users.users.length) {
    console.log('No users found or error:', userErr);
    return;
  }
  const userId = users.users[0].id;
  console.log('Using user ID:', userId);

  const { data: insertData, error: insertErr } = await supabaseAdmin
    .from('saved_locations')
    .insert({
      user_id: userId,
      name: 'Test Location',
      lat: 51.0,
      lon: -0.1
    })
    .select();
    
  if (insertErr) {
    console.error('Insert Error:', insertErr);
  } else {
    console.log('Insert Success:', insertData);
  }
}

testSupabase();
