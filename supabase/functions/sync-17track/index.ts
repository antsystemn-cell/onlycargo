// Manually sync a tracking number from 17TRACK
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  corsHeaders,
  track17GetInfo,
  normalize17TrackEvents,
  map17TrackStatusToCargoChinaStatus,
} from "../_shared/track17.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claims } = await supabase.auth.getClaims(token);
    if (!claims?.claims?.sub) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    const { tracking_number, carrier, cargo_id, preregistration_id } = body;
    if (!tracking_number) return json({ error: "tracking_number required" }, 400);

    const info = await track17GetInfo(tracking_number, carrier ?? null);
    const accepted = info?.data?.accepted?.[0];
    if (!accepted?.track_info) {
      return json({ ok: false, raw: info, message: "No track_info" });
    }

    const trackInfo = accepted.track_info;
    const events = normalize17TrackEvents(
      tracking_number,
      carrier ?? null,
      trackInfo,
    );
    const latest = trackInfo?.latest_event;
    const latestStatus = trackInfo?.latest_status?.status ?? null;
    const subStatus = trackInfo?.latest_status?.sub_status ?? null;
    const mapped = map17TrackStatusToCargoChinaStatus(latestStatus);

    // Resolve cargo
    let resolvedCargoId: string | null = cargo_id ?? null;
    if (!resolvedCargoId) {
      const { data: c } = await admin
        .from("cargo")
        .select("id")
        .eq("track_number", tracking_number)
        .maybeSingle();
      resolvedCargoId = c?.id ?? null;
    }

    if (resolvedCargoId) {
      await admin
        .from("cargo")
        .update({
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
        })
        .eq("id", resolvedCargoId);
    }

    if (preregistration_id) {
      await admin
        .from("cargo_preregistrations")
        .update({
          tracking_status_17track: mapped.code,
          tracking_last_sync_at: new Date().toISOString(),
        })
        .eq("id", preregistration_id);
    }

    if (events.length > 0) {
      const rows = events.map((e) => ({
        ...e,
        cargo_id: resolvedCargoId,
        preregistration_id: preregistration_id ?? null,
      }));
      await admin
        .from("tracking_events")
        .upsert(rows, {
          onConflict:
            "tracking_number,event_time,description,location,provider_key",
          ignoreDuplicates: true,
        });
    }

    return json({
      ok: true,
      status: mapped,
      events_count: events.length,
    });
  } catch (err) {
    console.error("sync-17track error:", err);
    return json({ error: String(err) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
