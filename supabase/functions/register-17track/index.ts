// Register a tracking number with 17TRACK from a user pre-registration
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  corsHeaders,
  track17Register,
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
    const { preregistration_id, cargo_id, tracking_number, carrier } = body;

    if (!tracking_number || (!preregistration_id && !cargo_id)) {
      return json({ error: "tracking_number and id required" }, 400);
    }

    const tag = preregistration_id
      ? `prereg:${preregistration_id}`
      : `cargo:${cargo_id}`;

    // Call 17TRACK register
    const regRes = await track17Register(tracking_number, tag, carrier ?? null);
    const accepted = regRes?.data?.accepted ?? [];
    const rejected = regRes?.data?.rejected ?? [];

    const updateTarget = preregistration_id
      ? { table: "cargo_preregistrations", id: preregistration_id }
      : { table: "cargo", id: cargo_id };

    if (rejected.length > 0) {
      const errMsg =
        rejected[0]?.error?.message ?? "Tracking бүртгэхэд алдаа гарлаа";
      await admin
        .from(updateTarget.table)
        .update({
          tracking_registered: false,
          tracking_register_error: errMsg,
          tracking_last_sync_at: new Date().toISOString(),
        })
        .eq("id", updateTarget.id);
      return json({ ok: false, error: errMsg, raw: regRes });
    }

    const acceptedCarrier = accepted[0]?.carrier ?? carrier ?? null;
    await admin
      .from(updateTarget.table)
      .update({
        tracking_registered: true,
        tracking_register_error: null,
        tracking_carrier: acceptedCarrier,
        tracking_status_17track: "Registered",
        tracking_last_sync_at: new Date().toISOString(),
      })
      .eq("id", updateTarget.id);

    // Try fetching initial info (may be empty initially)
    try {
      const info = await track17GetInfo(tracking_number, acceptedCarrier);
      const trackInfo = info?.data?.accepted?.[0]?.track_info;
      if (trackInfo) {
        const events = normalize17TrackEvents(
          tracking_number,
          acceptedCarrier,
          trackInfo,
        );
        const latest = trackInfo?.latest_event;
        const latestStatus = trackInfo?.latest_status?.status ?? null;
        const subStatus = trackInfo?.latest_status?.sub_status ?? null;
        const mapped = map17TrackStatusToCargoChinaStatus(latestStatus);

        await admin
          .from(updateTarget.table)
          .update({
            tracking_status_17track: mapped.code,
            ...(updateTarget.table === "cargo"
              ? {
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
                }
              : {}),
          })
          .eq("id", updateTarget.id);

        // Insert events (dedupe by unique index)
        if (events.length > 0) {
          // Find any cargo that already matches this tracking number
          const { data: matchedCargo } = await admin
            .from("cargo")
            .select("id")
            .eq("track_number", tracking_number)
            .maybeSingle();

          const rows = events.map((e) => ({
            ...e,
            cargo_id: matchedCargo?.id ?? null,
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
      }
    } catch (e) {
      console.warn("initial gettrackinfo failed:", e);
    }

    return json({ ok: true, accepted, carrier: acceptedCarrier });
  } catch (err) {
    console.error("register-17track error:", err);
    return json({ error: String(err) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
