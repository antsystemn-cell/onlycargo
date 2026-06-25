import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
};

async function hmacSha256Hex(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function backoffSeconds(attempt: number) {
  return [60, 300, 900, 3600, 21600, 86400][Math.min(attempt - 1, 5)];
}

async function deliver(
  url: string,
  secret: string | null,
  event: string,
  eventId: string,
  body: string,
) {
  const ts = Math.floor(Date.now() / 1000).toString();
  const signature = secret ? await hmacSha256Hex(secret, `${ts}.${body}`) : "";
  const plainSig = secret ? await hmacSha256Hex(secret, body) : "";

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-OnlyCargo-Event": event,
    "X-OnlyCargo-Delivery": eventId,
    "X-OnlyCargo-Timestamp": ts,
  };
  if (secret) {
    headers["X-OnlyCargo-Signature"] = `t=${ts},v1=${signature}`;
    headers["X-Signature"] = `sha256=${plainSig}`;
    headers["X-Hub-Signature-256"] = `sha256=${plainSig}`;
    headers["X-OnlyCargo-Signature-Plain"] = plainSig;
  }

  try {
    const r = await fetch(url, {
      method: "POST", headers, body,
      signal: AbortSignal.timeout(10_000),
    });
    const text = (await r.text()).slice(0, 2000);
    return { status: r.status, body: text, success: r.ok, error: null as string | null };
  } catch (e: any) {
    return { status: 0, body: "", success: false, error: e?.message || String(e) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Optional body { delivery_id } for manual single-retry
  let manual: { delivery_id?: string } = {};
  try { manual = await req.json(); } catch { /* ignore */ }

  let query = supabase
    .from("webhook_deliveries")
    .select("*, api_keys!inner(webhook_url, webhook_secret, is_active, webhook_enabled)")
    .eq("status", "pending")
    .order("next_retry_at", { ascending: true })
    .limit(50);

  if (manual.delivery_id) {
    query = supabase
      .from("webhook_deliveries")
      .select("*, api_keys!inner(webhook_url, webhook_secret, is_active, webhook_enabled)")
      .eq("id", manual.delivery_id)
      .limit(1);
  } else {
    query = query.lte("next_retry_at", new Date().toISOString());
  }

  const { data: rows, error } = await query;
  if (error) {
    console.error("retry load failed", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }

  const results: any[] = [];
  for (const row of rows || []) {
    const ak = (row as any).api_keys;
    if (!ak || !ak.is_active || !ak.webhook_enabled || !ak.webhook_url) {
      await supabase.from("webhook_deliveries").update({ status: "dead", last_error: "api key disabled or webhook unconfigured" }).eq("id", row.id);
      continue;
    }
    const body = JSON.stringify(row.payload);
    const res = await deliver(ak.webhook_url, ak.webhook_secret, row.event, row.event_id || row.id, body);
    const attempts = (row.attempts || 0) + 1;
    const max = row.max_attempts || 6;
    const nowIso = new Date().toISOString();

    let newStatus = row.status;
    let nextRetry: string | null = null;
    if (res.success) newStatus = "success";
    else if (attempts >= max) newStatus = "dead";
    else {
      newStatus = "pending";
      nextRetry = new Date(Date.now() + backoffSeconds(attempts) * 1000).toISOString();
    }

    await supabase.from("webhook_deliveries").update({
      response_status: res.status || null,
      response_body: res.body || null,
      success: res.success,
      status: newStatus,
      attempts,
      last_attempt_at: nowIso,
      next_retry_at: nextRetry,
      last_error: res.error,
      error: res.error,
    }).eq("id", row.id);

    results.push({ id: row.id, status: res.status, success: res.success, attempts, newStatus });
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
