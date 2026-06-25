import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
};

const INTERNAL_TO_EXTERNAL: Record<string, string> = {
  registered: "created",
  received_ereen: "received",
  transporting: "in_transit",
  warehouse_processing: "processing",
  ready_warehouse: "ready_for_pickup",
  completed: "completed",
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
  // 1m, 5m, 15m, 1h, 6h, 24h
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
    // Three signature formats for compatibility
    headers["X-OnlyCargo-Signature"] = `t=${ts},v1=${signature}`;
    headers["X-Signature"] = `sha256=${plainSig}`;
    headers["X-Hub-Signature-256"] = `sha256=${plainSig}`;
    headers["X-OnlyCargo-Signature-Plain"] = plainSig;
  }

  try {
    const r = await fetch(url, {
      method: "POST",
      headers,
      body,
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
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let trigger: any;
  try { trigger = await req.json(); } catch { return new Response("bad json", { status: 400 }); }

  const event: string = trigger.event || "shipment.status_changed";
  const eventId: string = trigger.event_id || crypto.randomUUID();

  const { data: keys, error } = await supabase
    .from("api_keys")
    .select("id, name, webhook_url, webhook_secret, webhook_events, webhook_enabled, allowed_branches, merchant_id, allowed_customer_codes, is_active")
    .eq("webhook_enabled", true)
    .eq("is_active", true)
    .not("webhook_url", "is", null);

  if (error) {
    console.error("Failed to load api_keys", error);
    return new Response(JSON.stringify({ error: "load failed" }), { status: 500 });
  }

  const internalStatus = trigger.new_status as string | undefined;
  const externalStatus = internalStatus ? INTERNAL_TO_EXTERNAL[internalStatus] ?? internalStatus : null;
  const previousExt = trigger.old_status ? (INTERNAL_TO_EXTERNAL[trigger.old_status] ?? trigger.old_status) : null;

  const eventPayload = {
    event,
    event_id: eventId,
    occurred_at: new Date().toISOString(),
    data: {
      // camelCase
      trackNumber: trigger.track_number,
      cargoId: trigger.cargo_id,
      status: externalStatus,
      previousStatus: previousExt,
      location: trigger.location ?? null,
      statusUpdatedAt: trigger.status_date,
      updatedAt: trigger.updated_at ?? trigger.status_date,
      merchantId: trigger.merchant_id ?? null,
      customerCode: trigger.customer_code ?? null,
      branchId: trigger.branch_id ?? null,
      // snake_case mirrors
      track_number: trigger.track_number,
      cargo_id: trigger.cargo_id,
      previous_status: previousExt,
      status_updated_at: trigger.status_date,
      updated_at: trigger.updated_at ?? trigger.status_date,
      merchant_id: trigger.merchant_id ?? null,
      customer_code: trigger.customer_code ?? null,
      branch_id: trigger.branch_id ?? null,
    },
  };
  const body = JSON.stringify(eventPayload);

  const results: any[] = [];
  for (const k of keys || []) {
    if (k.merchant_id && trigger.merchant_id && k.merchant_id !== trigger.merchant_id) continue;
    if (k.allowed_customer_codes?.length && trigger.customer_code &&
        !k.allowed_customer_codes.includes(trigger.customer_code)) continue;
    if (Array.isArray(k.webhook_events) && k.webhook_events.length &&
        !k.webhook_events.includes(event)) continue;

    // Idempotency: skip if (event_id, api_key_id) already delivered successfully
    const { data: existing } = await supabase
      .from("webhook_deliveries")
      .select("id, status")
      .eq("event_id", eventId)
      .eq("api_key_id", k.id)
      .maybeSingle();

    if (existing && existing.status === "success") {
      results.push({ api_key: k.name, skipped: "duplicate" });
      continue;
    }

    const res = await deliver(k.webhook_url!, k.webhook_secret, event, eventId, body);
    const nowIso = new Date().toISOString();

    if (existing) {
      // retry path (rare from dispatcher; usually from webhook-retry)
      const attempts = 1; // first attempt by dispatcher
      await supabase.from("webhook_deliveries").update({
        response_status: res.status || null,
        response_body: res.body || null,
        success: res.success,
        status: res.success ? "success" : "pending",
        attempts,
        last_attempt_at: nowIso,
        next_retry_at: res.success ? null : new Date(Date.now() + backoffSeconds(attempts) * 1000).toISOString(),
        last_error: res.error,
        error: res.error,
      }).eq("id", existing.id);
    } else {
      await supabase.from("webhook_deliveries").insert({
        api_key_id: k.id,
        event,
        event_id: eventId,
        payload: eventPayload,
        target_url: k.webhook_url,
        response_status: res.status || null,
        response_body: res.body || null,
        success: res.success,
        status: res.success ? "success" : "pending",
        attempts: 1,
        max_attempts: 6,
        last_attempt_at: nowIso,
        next_retry_at: res.success ? null : new Date(Date.now() + backoffSeconds(1) * 1000).toISOString(),
        last_error: res.error,
        error: res.error,
      });
    }

    results.push({ api_key: k.name, status: res.status, success: res.success });
  }

  return new Response(JSON.stringify({ dispatched: results.length, event_id: eventId, results }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
