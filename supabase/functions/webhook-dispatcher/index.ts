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

  // Find subscribed api keys
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

  const eventPayload = {
    event,
    delivery_id: crypto.randomUUID(),
    occurred_at: new Date().toISOString(),
    data: {
      trackNumber: trigger.track_number,
      cargoId: trigger.cargo_id,
      status: externalStatus,
      previousStatus: trigger.old_status ? (INTERNAL_TO_EXTERNAL[trigger.old_status] ?? trigger.old_status) : null,
      statusUpdatedAt: trigger.status_date,
      merchantId: trigger.merchant_id ?? null,
      customerCode: trigger.customer_code ?? null,
    },
  };

  const results: any[] = [];
  for (const k of keys || []) {
    // Scope filter
    if (k.merchant_id && trigger.merchant_id && k.merchant_id !== trigger.merchant_id) continue;
    if (k.allowed_customer_codes?.length && trigger.customer_code &&
        !k.allowed_customer_codes.includes(trigger.customer_code)) continue;
    if (Array.isArray(k.webhook_events) && k.webhook_events.length &&
        !k.webhook_events.includes(event)) continue;

    const body = JSON.stringify(eventPayload);
    const ts = Math.floor(Date.now() / 1000).toString();
    const signature = k.webhook_secret
      ? await hmacSha256Hex(k.webhook_secret, `${ts}.${body}`)
      : "";

    let status = 0, respText = "", success = false, errMsg: string | null = null;
    try {
      const r = await fetch(k.webhook_url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-OnlyCargo-Event": event,
          "X-OnlyCargo-Delivery": eventPayload.delivery_id,
          "X-OnlyCargo-Timestamp": ts,
          "X-OnlyCargo-Signature": `t=${ts},v1=${signature}`,
        },
        body,
        signal: AbortSignal.timeout(10_000),
      });
      status = r.status;
      respText = (await r.text()).slice(0, 2000);
      success = r.ok;
    } catch (e: any) {
      errMsg = e?.message || String(e);
    }

    await supabase.from("webhook_deliveries").insert({
      api_key_id: k.id,
      event,
      payload: eventPayload,
      target_url: k.webhook_url,
      response_status: status || null,
      response_body: respText || null,
      success,
      error: errMsg,
    });

    results.push({ api_key: k.name, status, success });
  }

  return new Response(JSON.stringify({ dispatched: results.length, results }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
