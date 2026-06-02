import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'content-type, authorization, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) return json({ error: 'Unauthorized' }, 401);

  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Verify caller is authenticated
  const { data: { user: caller }, error: authErr } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !caller) return json({ error: 'Unauthorized' }, 401);

  // Verify caller is admin
  const { data: roleRow } = await supabaseAdmin
    .from('user_roles')
    .select('role')
    .eq('user_id', caller.id)
    .eq('role', 'admin')
    .maybeSingle();
  if (!roleRow) return json({ error: 'Forbidden: admin only' }, 403);

  const { userId, newPassword } = await req.json();
  if (!userId || !newPassword) return json({ error: 'userId and newPassword are required' }, 400);
  if (newPassword.length < 8) return json({ error: 'A senha deve ter no mínimo 8 caracteres' }, 400);

  const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: newPassword });
  if (updateErr) return json({ error: updateErr.message }, 500);

  return json({ success: true });
});
