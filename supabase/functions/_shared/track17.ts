// Shared helpers for 17TRACK integration
export const TRACK17_BASE = "https://api.17track.net/track/v2.4";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

export interface NormalizedEvent {
  tracking_number: string;
  carrier: number | null;
  event_time: string | null;
  event_time_raw: string | null;
  description: string | null;
  description_translation: string | null;
  location: string | null;
  stage: string | null;
  sub_status: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
  provider_name: string | null;
  provider_key: string | null;
  raw_event: unknown;
}

export function track17Headers() {
  const key = Deno.env.get("TRACK17_API_KEY");
  if (!key) throw new Error("TRACK17_API_KEY not configured");
  return {
    "17token": key,
    "Content-Type": "application/json",
  };
}

export async function track17Register(
  trackingNumber: string,
  tag: string,
  carrier?: number | null,
) {
  const body = [
    {
      number: trackingNumber,
      tag,
      lang: "en",
      ...(carrier ? { carrier } : {}),
    },
  ];
  const res = await fetch(`${TRACK17_BASE}/register`, {
    method: "POST",
    headers: track17Headers(),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  return await res.json();
}

export async function track17GetInfo(
  trackingNumber: string,
  carrier?: number | null,
) {
  const body = [
    {
      number: trackingNumber,
      ...(carrier ? { carrier } : {}),
    },
  ];
  const res = await fetch(`${TRACK17_BASE}/gettrackinfo`, {
    method: "POST",
    headers: track17Headers(),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  return await res.json();
}

export function normalize17TrackEvents(
  trackingNumber: string,
  carrier: number | null,
  trackInfo: any,
): NormalizedEvent[] {
  const events: NormalizedEvent[] = [];
  const providers = trackInfo?.tracking?.providers ?? [];
  for (const provider of providers) {
    const pName = provider?.provider?.name ?? null;
    const pKey = provider?.provider?.key ?? provider?.key ?? null;
    const evs = provider?.events ?? [];
    for (const ev of evs) {
      const time =
        ev.time_utc || ev.time_iso || ev.time_raw?.date || null;
      events.push({
        tracking_number: trackingNumber,
        carrier,
        event_time: time ? new Date(time).toISOString() : null,
        event_time_raw: ev.time_raw?.date ?? ev.time_iso ?? null,
        description:
          ev.description_translation?.description ?? ev.description ?? null,
        description_translation:
          ev.description_translation?.description ?? null,
        location:
          ev.location ||
          ev.address?.city ||
          ev.address?.state ||
          ev.address?.country ||
          null,
        stage: ev.stage ?? null,
        sub_status: ev.sub_status ?? null,
        country: ev.address?.country ?? null,
        state: ev.address?.state ?? null,
        city: ev.address?.city ?? null,
        provider_name: pName,
        provider_key: pKey,
        raw_event: ev,
      });
    }
  }
  return events;
}

// 17TRACK main status → internal china-side status code
export function map17TrackStatusToCargoChinaStatus(status: string | null) {
  switch (status) {
    case "NotFound":
      return { code: "tracking_not_found", label: "Мэдээлэл олдсонгүй" };
    case "InfoReceived":
      return {
        code: "china_info_received",
        label: "Тээврийн мэдээлэл үүссэн",
      };
    case "InTransit":
      return {
        code: "china_in_transit",
        label: "Хятад дотор тээвэрлэгдэж байна",
      };
    case "Expired":
      return { code: "china_tracking_expired", label: "Удаан шинэчлэгдээгүй" };
    case "Exception":
      return {
        code: "china_tracking_exception",
        label: "Тээврийн асуудал гарсан",
      };
    case "Delivered":
      return {
        code: "possible_china_delivered",
        label: "Хятад дахь хүргэлт дууссан байж магадгүй",
      };
    case "AvailableForPickup":
      return {
        code: "possible_ereen_ready_or_pickup",
        label: "Хүлээн авах цэг дээр ирсэн байж магадгүй",
      };
    case "DeliveryFailure":
      return { code: "china_delivery_failure", label: "Хүргэлт амжилтгүй" };
    case "OutForDelivery":
      return { code: "china_out_for_delivery", label: "Хүргэлтэнд гарсан" };
    default:
      return { code: status ?? "unknown", label: status ?? "Тодорхойгүй" };
  }
}

const EREEN_KEYWORDS = [
  "erenhot",
  "erlian",
  "erlianhot",
  "ereen",
  "eren ",
  "二连浩特",
  "二连",
];

export function detectEreenCandidateFromTrackingEvents(
  events: NormalizedEvent[],
): NormalizedEvent | null {
  for (const ev of events) {
    const hay = `${ev.description ?? ""} ${ev.location ?? ""} ${
      ev.city ?? ""
    } ${ev.state ?? ""}`.toLowerCase();
    if (EREEN_KEYWORDS.some((kw) => hay.includes(kw))) {
      return ev;
    }
  }
  return null;
}
