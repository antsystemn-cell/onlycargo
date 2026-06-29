// Public webhook receiver for 17TRACK TRACKING_UPDATED / TRACKING_STOPPED
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  corsHeaders,
  normalize17TrackEvents,
  map17TrackStatusToCargoChinaStatus,
  detectEreenCandidateFromTrackingEvents,
} from "../_shared/track17.ts";

// Statuses Mongolia-side that 17TRACK MUST NOT overwrite
const MN_LOCKED_STATUSES = new Set([
  "transporting",
  "warehouse_processing",
  "ready_warehouse",
  "completed",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("ok", { headers: corsHeaders });
  }

  let payload: any = null;
  try {
    payload = await req.json();
  } catch {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  // Fire-and-forget processing — always respond 200 fast
  processPayload(payload).catch((e) =>
    console.error("webhook processing failed:", e),
  );

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

async function processPayload(payload: any) {
  const event = payload?.event;
  const data = payload?.data;
  if (!event || !data) return;

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const trackingNumber: string | undefined = data.number;
  const carrier: number | null = data.carrier ?? null;
  const tag: string | undefined = data.tag;

  if (!trackingNumber) return;

  // Resolve cargo & preregistration
  let cargoId: string | null = null;
  let preregId: string | null = null;
  if (tag?.startsWith("prereg:")) preregId = tag.slice(7);
  if (tag?.startsWith("cargo:")) cargoId = tag.slice(6);

  if (!cargoId) {
    const { data: c } = await admin
      .from("cargo")
      .select("id, status")
      .eq("track_number", trackingNumber)
      .maybeSingle();
    cargoId = c?.id ?? null;
  }
  if (!preregId) {
    const { data: p } = await admin
      .from("cargo_preregistrations")
      .select("id")
      .eq("track_number", trackingNumber)
      .maybeSingle();
    preregId = p?.id ?? null;
  }

  if (event === "TRACKING_STOPPED") {
    if (cargoId) {
      await admin
        .from("cargo")
        .update({
          tracking_status_17track: "TRACKING_STOPPED",
          tracking_last_sync_at: new Date().toISOString(),
        })
        .eq("id", cargoId);
    }
    return;
  }

  if (event !== "TRACKING_UPDATED") return;

  const trackInfo = data.track_info;
  if (!trackInfo) return;

  const events = normalize17TrackEvents(trackingNumber, carrier, trackInfo);
  const latest = trackInfo?.latest_event;
  const latestStatus = trackInfo?.latest_status?.status ?? null;
  const subStatus = trackInfo?.latest_status?.sub_status ?? null;
  const mapped = map17TrackStatusToCargoChinaStatus(latestStatus);

  // Insert events
  if (events.length > 0) {
    const rows = events.map((e) => ({
      ...e,
      cargo_id: cargoId,
      preregistration_id: preregId,
    }));
    await admin
      .from("tracking_events")
      .upsert(rows, {
        onConflict:
          "tracking_number,event_time,description,location,provider_key",
        ignoreDuplicates: true,
      });
  }

  // Ereen candidate?
  const ereenEv = detectEreenCandidateFromTrackingEvents(events);

  // Auto-mark feature flag
  const { data: flagRow } = await admin
    .from("site_settings")
    .select("value")
    .eq("key", "auto_mark_ereen_received")
    .maybeSingle();
  const autoMark = flagRow?.value === true;

  if (preregId) {
    await admin
      .from("cargo_preregistrations")
      .update({
        tracking_status_17track: mapped.code,
        tracking_last_sync_at: new Date().toISOString(),
        ...(carrier ? { tracking_carrier: carrier } : {}),
      })
      .eq("id", preregId);
  }

  if (cargoId) {
    // Get current cargo status to decide whether to auto-advance
    const { data: cargoRow } = await admin
      .from("cargo")
      .select("status, ereen_received_detected_at")
      .eq("id", cargoId)
      .maybeSingle();

    const update: Record<string, unknown> = {
      tracking_status_17track: mapped.code,
      tracking_sub_status_17track: subStatus,
      tracking_latest_event_description: latest?.description ?? null,
      tracking_latest_event_location:
        latest?.location ||
        latest?.address?.city ||
        latest?.address?.country ||
        null,
      tracking_latest_event_time: latest?.time_utc
        ? new Date(latest.time_utc).toISOString()
        : null,
      tracking_raw: trackInfo,
      tracking_last_sync_at: new Date().toISOString(),
      ...(carrier ? { tracking_carrier: carrier } : {}),
    };

    if (ereenEv && !cargoRow?.ereen_received_detected_at) {
      update.ereen_received_detected_at = new Date().toISOString();
    }

    // Auto-promote to 'received_ereen' only if flag enabled AND current status is still pre-ereen
    if (
      autoMark &&
      ereenEv &&
      cargoRow &&
      !MN_LOCKED_STATUSES.has(cargoRow.status) &&
      cargoRow.status === "registered"
    ) {
      update.status = "received_ereen";
      update.auto_status_source = "17track";
    }

    await admin.from("cargo").update(update).eq("id", cargoId);
  }
}
