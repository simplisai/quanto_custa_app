/**
 * simplispay-refresh-token
 * Fetches a fresh Bearer token from Simplispay and saves it to gateway_tokens.
 * Called by pg_cron every 2 hours via net.http_post.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SIMPLISPAY_BASE_URL = Deno.env.get('SIMPLISPAY_BASE_URL') ?? 'https://api.zsystems.com.br';
const SIMPLISPAY_EMAIL    = Deno.env.get('SIMPLISPAY_EMAIL') ?? '';
const SIMPLISPAY_PASSWORD = Deno.env.get('SIMPLISPAY_PASSWORD') ?? '';
const SUPABASE_URL        = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const TOKEN_TTL_MS = 4 * 60 * 60 * 1000; // Simplispay tokens valid 4 hours

Deno.serve(async (_req: Request) => {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const now = new Date();

  try {
    const tokenRes = await fetch(`${SIMPLISPAY_BASE_URL}/createToken`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: SIMPLISPAY_EMAIL, password: SIMPLISPAY_PASSWORD }),
    });

    const tokenData = await tokenRes.json() as { success: boolean; token?: string };

    if (!tokenData.success || !tokenData.token) {
      console.error('[simplispay-refresh-token] Failed:', tokenData);
      await supabase.from('gateway_tokens').upsert({
        provider: 'simplispay',
        last_refresh_at: now.toISOString(),
        last_refresh_success: false,
        updated_at: now.toISOString(),
      }, { onConflict: 'provider' });
      return new Response(JSON.stringify({ error: 'Token fetch failed', detail: tokenData }), { status: 502 });
    }

    const expiresAt = new Date(now.getTime() + TOKEN_TTL_MS).toISOString();

    const { error: dbErr } = await supabase.from('gateway_tokens').upsert({
      provider:             'simplispay',
      token_value:          tokenData.token,
      token_expires_at:     expiresAt,
      last_refresh_at:      now.toISOString(),
      last_refresh_success: true,
      consecutive_failures: 0,
      updated_at:           now.toISOString(),
    }, { onConflict: 'provider' });

    if (dbErr) throw new Error(`DB error: ${dbErr.message}`);

    console.log('[simplispay-refresh-token] Token refreshed, expires:', expiresAt);
    return new Response(JSON.stringify({ success: true, expires_at: expiresAt }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[simplispay-refresh-token] Unexpected error:', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
