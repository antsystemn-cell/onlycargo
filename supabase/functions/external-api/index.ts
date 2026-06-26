import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key, idempotency-key",
};

function jsonResponse(data: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extraHeaders },
  });
}

async function hashKey(key: string): Promise<string> {
  const data = new TextEncoder().encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function maskPhone(phone: string | null): string {
  if (!phone || phone.length < 4) return "****";
  return phone.slice(0, 4) + "****";
}

// ===== Status mapping (internal <-> external) =====
type InternalStatus =
  | "registered" | "received_ereen" | "transporting"
  | "warehouse_processing" | "ready_warehouse" | "completed";

type ExternalStatus =
  | "created" | "received" | "processing" | "in_transit"
  | "arrived" | "ready_for_pickup" | "completed" | "archived";

const INTERNAL_TO_EXTERNAL: Record<InternalStatus, ExternalStatus> = {
  registered: "created",
  received_ereen: "received",
  transporting: "in_transit",
  warehouse_processing: "processing",
  ready_warehouse: "ready_for_pickup",
  completed: "completed",
};

const EXTERNAL_TO_INTERNAL: Record<ExternalStatus, InternalStatus | null> = {
  created: "registered",
  received: "received_ereen",
  processing: "warehouse_processing",
  in_transit: "transporting",
  arrived: "ready_warehouse",
  ready_for_pickup: "ready_warehouse",
  completed: "completed",
  archived: null, // not applied internally
};

const STATUS_LOCATION: Record<InternalStatus, string> = {
  registered: "Эрээн агуулах (бүртгэл)",
  received_ereen: "Эрээн агуулах",
  transporting: "Замд",
  warehouse_processing: "УБ агуулах (боловсруулж байна)",
  ready_warehouse: "УБ агуулах (бэлэн)",
  completed: "Хүлээлгэж өгсөн",
};

interface ApiKeyRecord {
  id: string;
  name: string;
  key_hash: string;
  is_active: boolean;
  allowed_branches: string[];
  allow_phone_search: boolean;
  allow_price: boolean;
  rate_limit_per_minute: number;
  rate_limit_per_day: number;
  expires_at: string | null;
  merchant_id: string | null;
  allowed_customer_codes: string[];
  verified_phone: string | null;
  verified_phone_at: string | null;
  pending_phone: string | null;
  pending_otp_hash: string | null;
  pending_otp_expires_at: string | null;
  pending_otp_attempts: number;
  pending_otp_last_sent_at: string | null;
}

async function validateApiKey(supabase: any, rawKey: string) {
  const keyHash = await hashKey(rawKey);
  const { data, error } = await supabase
    .from("api_keys")
    .select("*")
    .eq("key_hash", keyHash)
    .maybeSingle();

  if (error || !data) return { valid: false as const, error: "Invalid API key", status: 401 };
  if (!data.is_active) return { valid: false as const, error: "API key is disabled", status: 401 };
  if (data.expires_at && new Date(data.expires_at) < new Date())
    return { valid: false as const, error: "API key has expired", status: 401 };

  return { valid: true as const, apiKey: data as ApiKeyRecord };
}

async function checkRateLimit(supabase: any, apiKeyId: string, perMinute: number, perDay: number) {
  const now = Date.now();
  const oneMinuteAgo = new Date(now - 60_000).toISOString();
  const oneDayAgo = new Date(now - 86_400_000).toISOString();

  const [{ count: minCount }, { count: dayCount }] = await Promise.all([
    supabase.from("api_key_usage_logs").select("*", { count: "exact", head: true })
      .eq("api_key_id", apiKeyId).gte("created_at", oneMinuteAgo),
    supabase.from("api_key_usage_logs").select("*", { count: "exact", head: true })
      .eq("api_key_id", apiKeyId).gte("created_at", oneDayAgo),
  ]);

  if ((minCount || 0) >= perMinute) return { ok: false, retryAfter: 60 };
  if ((dayCount || 0) >= perDay) return { ok: false, retryAfter: 3600 };
  return { ok: true, retryAfter: 0 };
}

async function logUsage(supabase: any, apiKeyId: string, endpoint: string, statusCode: number, req: Request) {
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";
  const userAgent = req.headers.get("user-agent") || "unknown";
  await supabase.from("api_key_usage_logs").insert({
    api_key_id: apiKeyId,
    endpoint,
    status_code: statusCode,
    ip_address: ip,
    user_agent: userAgent,
  });
  await supabase.from("api_keys")
    .update({ last_used_at: new Date().toISOString(), last_used_ip: ip })
    .eq("id", apiKeyId);
}

// Normalize a phone number for matching: strip spaces/+/976/non-digits and keep last 8 digits (MN format).
function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null;
  const digits = String(input).replace(/\D/g, "");
  if (!digits) return null;
  const stripped = digits.startsWith("976") ? digits.slice(3) : digits;
  return stripped.slice(-8);
}

// Merchant-scoped keys MUST have a verified phone before cargo data can flow.
function requiresVerifiedPhone(apiKey: ApiKeyRecord) {
  return !!apiKey.merchant_id;
}


function applyKeyScope(query: any, apiKey: ApiKeyRecord) {
  // Phone verification trumps every other scope: only cargo for the verified phone is visible.
  if (apiKey.verified_phone) query = query.eq("phone_number", apiKey.verified_phone);
  if (apiKey.allowed_branches?.length) query = query.in("branch_id", apiKey.allowed_branches);
  if (apiKey.merchant_id) query = query.eq("merchant_id", apiKey.merchant_id);
  if (apiKey.allowed_customer_codes?.length) query = query.in("customer_code", apiKey.allowed_customer_codes);
  return query;
}

function configError(message: string) {
  return jsonResponse({
    error: "configuration_error",
    message,
    requiredFlow: [
      "POST /verify-phone/request { phone }",
      "POST /verify-phone/confirm { phone, otp }",
    ],
  }, 412);
}

function shipmentDto(c: any, apiKey: ApiKeyRecord) {
  const internal = c.status as InternalStatus;
  const ext = INTERNAL_TO_EXTERNAL[internal] ?? c.status;
  const dims = c.length && c.width && c.height
    ? { length: c.length, width: c.width, height: c.height }
    : null;
  const dto: Record<string, any> = {
    // camelCase (primary)
    trackNumber: c.track_number,
    status: ext,
    statusUpdatedAt: c.status_date,
    phone: maskPhone(c.phone_number),
    merchantId: c.merchant_id ?? null,
    customerCode: c.customer_code ?? null,
    externalRef: c.external_ref ?? null,
    weight: c.weight,
    dimensions: dims,
    location: STATUS_LOCATION[internal] ?? null,
    branchId: c.branch_id,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
    // snake_case mirrors for naming consistency
    track_number: c.track_number,
    status_updated_at: c.status_date,
    merchant_id: c.merchant_id ?? null,
    customer_code: c.customer_code ?? null,
    external_ref: c.external_ref ?? null,
    branch_id: c.branch_id,
    created_at: c.created_at,
    updated_at: c.updated_at,
  };
  if (apiKey.allow_price) {
    const fee = {
      total: c.price,
      cubicMeters: c.total_cubic_meters,
      weightPrice: c.weight && c.kg_price ? Number(c.weight) * Number(c.kg_price) : null,
      volumePrice: c.total_cubic_meters && c.cubic_meter_price
        ? Number(c.total_cubic_meters) * Number(c.cubic_meter_price) : null,
    };
    dto.fee = fee;
  }
  return dto;
}

const SHIPMENT_COLUMNS =
  "id, track_number, phone_number, status, status_date, weight, length, width, height, " +
  "price, cubic_meter_price, kg_price, total_cubic_meters, branch_id, merchant_id, " +
  "customer_code, external_ref, created_at, updated_at";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Auth
  const authHeader = req.headers.get("authorization");
  const xApiKey = req.headers.get("x-api-key");
  let rawKey = "";
  if (authHeader?.startsWith("Bearer ")) rawKey = authHeader.slice(7);
  else if (xApiKey) rawKey = xApiKey;

  if (!rawKey) {
    return jsonResponse({ error: "Missing API key. Use Authorization: Bearer {key} or X-API-Key header" }, 401);
  }

  const validation = await validateApiKey(supabase, rawKey);
  if (!validation.valid) return jsonResponse({ error: validation.error }, validation.status);
  const apiKey = validation.apiKey;

  const rl = await checkRateLimit(supabase, apiKey.id, apiKey.rate_limit_per_minute, apiKey.rate_limit_per_day);
  if (!rl.ok) {
    await logUsage(supabase, apiKey.id, "rate_limited", 429, req);
    return jsonResponse({ error: "Rate limit exceeded" }, 429, { "Retry-After": String(rl.retryAfter) });
  }

  const url = new URL(req.url);
  // Path layout: /external-api/<resource>/<...>
  const parts = url.pathname.split("/").filter(Boolean);
  // strip the function name
  const idx = parts.indexOf("external-api");
  const route = idx >= 0 ? parts.slice(idx + 1) : parts;
  const [resource, sub, subsub] = route;

  try {
    // GET /health
    if (resource === "health") {
      await logUsage(supabase, apiKey.id, "/health", 200, req);
      return jsonResponse({ status: "ok", timestamp: new Date().toISOString() });
    }

    // ===== /verify-phone (OTP flow) =====
    if (resource === "verify-phone") {
      const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || null;

      // GET /verify-phone — status of the current key's verification
      if (!sub && req.method === "GET") {
        await logUsage(supabase, apiKey.id, "/verify-phone", 200, req);
        return jsonResponse({
          verified: !!apiKey.verified_phone,
          verifiedPhone: apiKey.verified_phone ? maskPhone(apiKey.verified_phone) : null,
          verifiedAt: apiKey.verified_phone_at,
          pendingPhone: apiKey.pending_phone ? maskPhone(apiKey.pending_phone) : null,
          pendingExpiresAt: apiKey.pending_otp_expires_at,
        });
      }

      // POST /verify-phone/request { phone }
      if (sub === "request" && req.method === "POST") {
        const body = await req.json().catch(() => ({} as any));
        const phone = String(body.phone || "").trim();
        if (!/^[6-9][0-9]{7}$/.test(phone)) {
          await logUsage(supabase, apiKey.id, "/verify-phone/request", 400, req);
          return jsonResponse({ error: "Invalid phone. Must be 8 digits starting with 6/7/8/9." }, 400);
        }
        // Resend cooldown: 60 seconds for the same pending phone
        if (apiKey.pending_phone === phone && apiKey.pending_otp_last_sent_at) {
          const elapsed = Date.now() - new Date(apiKey.pending_otp_last_sent_at).getTime();
          if (elapsed < 60_000) {
            const retry = Math.ceil((60_000 - elapsed) / 1000);
            await logUsage(supabase, apiKey.id, "/verify-phone/request", 429, req);
            return jsonResponse({ error: "Resend cooldown active", retryAfterSec: retry }, 429, {
              "Retry-After": String(retry),
            });
          }
        }

        const otp = String(Math.floor(100000 + Math.random() * 900000));
        const otpHash = await hashKey(otp);
        const now = new Date();
        const expires = new Date(now.getTime() + 5 * 60_000);

        const { error: upErr } = await supabase.from("api_keys").update({
          pending_phone: phone,
          pending_otp_hash: otpHash,
          pending_otp_expires_at: expires.toISOString(),
          pending_otp_attempts: 0,
          pending_otp_last_sent_at: now.toISOString(),
        }).eq("id", apiKey.id);
        if (upErr) throw upErr;

        await supabase.from("api_key_otp_logs").insert({
          api_key_id: apiKey.id, phone, event: "requested", ip: clientIp,
        });

        // SMS delivery is not wired yet — log server-side so an operator can read it,
        // and (only if explicitly enabled) return the OTP for dev/testing.
        console.log(`[OTP] api_key=${apiKey.id} phone=${phone} otp=${otp} expires=${expires.toISOString()}`);
        const devReturn = Deno.env.get("OTP_RETURN_IN_RESPONSE") === "true";

        await logUsage(supabase, apiKey.id, "/verify-phone/request", 200, req);
        return jsonResponse({
          success: true,
          message: "OTP issued. Expires in 5 minutes.",
          expiresInSec: 300,
          ...(devReturn ? { devOtp: otp } : {}),
        });
      }

      // POST /verify-phone/confirm { phone, otp }
      if (sub === "confirm" && req.method === "POST") {
        const body = await req.json().catch(() => ({} as any));
        const phone = String(body.phone || "").trim();
        const otp = String(body.otp || "").trim();

        if (!apiKey.pending_phone || apiKey.pending_phone !== phone) {
          await logUsage(supabase, apiKey.id, "/verify-phone/confirm", 400, req);
          return jsonResponse({ error: "No pending verification for this phone" }, 400);
        }
        if (!apiKey.pending_otp_expires_at || new Date(apiKey.pending_otp_expires_at) < new Date()) {
          await supabase.from("api_key_otp_logs").insert({
            api_key_id: apiKey.id, phone, event: "expired", ip: clientIp,
          });
          await logUsage(supabase, apiKey.id, "/verify-phone/confirm", 400, req);
          return jsonResponse({ error: "OTP expired. Request a new one." }, 400);
        }
        if ((apiKey.pending_otp_attempts || 0) >= 5) {
          await logUsage(supabase, apiKey.id, "/verify-phone/confirm", 429, req);
          return jsonResponse({ error: "Too many attempts. Request a new OTP." }, 429);
        }

        const otpHash = await hashKey(otp);
        if (otpHash !== apiKey.pending_otp_hash) {
          await supabase.from("api_keys")
            .update({ pending_otp_attempts: (apiKey.pending_otp_attempts || 0) + 1 })
            .eq("id", apiKey.id);
          await supabase.from("api_key_otp_logs").insert({
            api_key_id: apiKey.id, phone, event: "failed", ip: clientIp,
          });
          await logUsage(supabase, apiKey.id, "/verify-phone/confirm", 400, req);
          return jsonResponse({ error: "Invalid OTP" }, 400);
        }

        // Success — promote pending to verified. Old verified phone is replaced atomically.
        const { error: promErr } = await supabase.from("api_keys").update({
          verified_phone: phone,
          verified_phone_at: new Date().toISOString(),
          pending_phone: null,
          pending_otp_hash: null,
          pending_otp_expires_at: null,
          pending_otp_attempts: 0,
          pending_otp_last_sent_at: null,
        }).eq("id", apiKey.id);
        if (promErr) throw promErr;

        await supabase.from("api_key_otp_logs").insert({
          api_key_id: apiKey.id, phone, event: "verified", ip: clientIp,
        });
        await logUsage(supabase, apiKey.id, "/verify-phone/confirm", 200, req);
        return jsonResponse({
          success: true,
          verifiedPhone: maskPhone(phone),
          verifiedAt: new Date().toISOString(),
        });
      }

      await logUsage(supabase, apiKey.id, "/verify-phone", 404, req);
      return jsonResponse({
        error: "Not found",
        endpoints: [
          "GET /verify-phone",
          "POST /verify-phone/request { phone }",
          "POST /verify-phone/confirm { phone, otp }",
        ],
      }, 404);
    }

    // For merchant-scoped keys: cargo endpoints require a verified phone first.
    if ((resource === "shipments" || resource === "cargo") && requiresVerifiedPhone(apiKey) && !apiKey.verified_phone) {
      await logUsage(supabase, apiKey.id, `/${resource}[unverified]`, 412, req);
      return configError("Verified phone is required before shipment data is accessible.");
    }


    // ===== /shipments =====
    if (resource === "shipments") {
      // GET /shipments
      if (!sub && req.method === "GET") {
        const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
        const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("pageSize") || "20", 10)));
        const sort = ["created_at", "status_date"].includes(url.searchParams.get("sort") || "")
          ? url.searchParams.get("sort")! : "created_at";
        const order = url.searchParams.get("order") === "asc";
        const extStatus = url.searchParams.get("status") as ExternalStatus | null;
        const q = url.searchParams.get("q");
        const merchantId = url.searchParams.get("merchant_id");


        const merchantId = url.searchParams.get("merchant_id");
        const customerCode = url.searchParams.get("customer_code");
        const from = url.searchParams.get("from");
        const to = url.searchParams.get("to");
        const phoneParam =
          url.searchParams.get("phone") ||
          url.searchParams.get("phone_number") ||
          url.searchParams.get("customer_phone");
        const normalizedPhone = normalizePhone(phoneParam);
        // If the key is bound to a verified phone, it always wins (applyKeyScope enforces it).
        // Otherwise honor the requested phone filter.
        const effectivePhone = normalizePhone(apiKey.verified_phone) || normalizedPhone;

        let query = supabase.from("cargo").select(SHIPMENT_COLUMNS, { count: "exact" });
        query = applyKeyScope(query, apiKey);

        if (extStatus) {
          const internal = EXTERNAL_TO_INTERNAL[extStatus];
          if (internal) query = query.eq("status", internal);
        }
        if (merchantId) query = query.eq("merchant_id", merchantId);
        if (customerCode) query = query.eq("customer_code", customerCode);
        if (from) query = query.gte("created_at", from);
        if (to) query = query.lte("created_at", to);
        if (effectivePhone) {
          // Match by last-8 digits to be tolerant to +976/spacing variations stored historically.
          query = query.ilike("phone_number", `%${effectivePhone}`);
        }
        if (q) {
          if (apiKey.allow_phone_search) {
            query = query.or(`track_number.ilike.%${q}%,phone_number.ilike.%${q}%`);
          } else {
            query = query.ilike("track_number", `%${q}%`);
          }
        }

        const fromIdx = (page - 1) * pageSize;
        const toIdx = fromIdx + pageSize - 1;
        const { data, count, error } = await query.order(sort, { ascending: order }).range(fromIdx, toIdx);
        if (error) throw error;

        const items = (data || []).map((c: any) => shipmentDto(c, apiKey));
        const phoneTag = effectivePhone ? `***${effectivePhone.slice(-4)}` : "none";
        console.log(`[external-api] GET /shipments key=${apiKey.id} phone=${phoneTag} returned=${items.length} total=${count || 0} status=200`);
        await logUsage(supabase, apiKey.id, "/shipments", 200, req);
        return jsonResponse({
          data: items,
          meta: { page, pageSize, total: count || 0, hasMore: (count || 0) > page * pageSize },
        });
      }


      // POST /shipments  (create a new shipment for the merchant)
      if (!sub && req.method === "POST") {
        if (!apiKey.merchant_id) {
          await logUsage(supabase, apiKey.id, "/shipments[POST]", 403, req);
          return jsonResponse({ error: "This API key is not allowed to create shipments. A merchant-scoped key is required." }, 403);
        }
        const body = await req.json().catch(() => ({} as any));
        // Phone is always derived from the verified phone on the API key — the merchant's
        // frontend can never override which user receives the cargo.
        const phone = apiKey.verified_phone
          ? apiKey.verified_phone
          : String(body.phone || body.phone_number || "").trim();
        if (apiKey.verified_phone && body.phone && body.phone !== apiKey.verified_phone) {
          await logUsage(supabase, apiKey.id, "/shipments[POST]", 403, req);
          return jsonResponse({
            error: "Phone mismatch. This API key is bound to a verified phone; do not pass a different phone in the body.",
          }, 403);
        }
        if (phone && !/^[6-9][0-9]{7}$/.test(phone)) {
          await logUsage(supabase, apiKey.id, "/shipments[POST]", 400, req);
          return jsonResponse({ error: "Invalid phone. Must be 8 digits starting with 6/7/8/9." }, 400);
        }
        const trackNumber = String(body.trackNumber || body.track_number || "").trim();
        if (!trackNumber) {
          await logUsage(supabase, apiKey.id, "/shipments[POST]", 400, req);
          return jsonResponse({ error: "trackNumber is required" }, 400);
        }
        const customerCode = String(body.customerCode || body.customer_code || "").trim() || null;
        if (apiKey.allowed_customer_codes?.length) {
          if (!customerCode || !apiKey.allowed_customer_codes.includes(customerCode)) {
            await logUsage(supabase, apiKey.id, "/shipments[POST]", 403, req);
            return jsonResponse({
              error: "customer_code is required and must be one of allowed_customer_codes",
              allowed: apiKey.allowed_customer_codes,
            }, 403);
          }
        }

        // Idempotency: if a row with the same track_number already exists for this merchant, return it
        let existQ = supabase.from("cargo").select(SHIPMENT_COLUMNS).eq("track_number", trackNumber);
        existQ = applyKeyScope(existQ, apiKey);
        const { data: existing } = await existQ.maybeSingle();
        if (existing) {
          await logUsage(supabase, apiKey.id, "/shipments[POST]", 200, req);
          return jsonResponse({ data: shipmentDto(existing, apiKey), idempotent: true });
        }

        // Try to find a registered user by phone so cargo appears in their "Миний ачаа" immediately
        let resolvedUserId: string | null = null;
        if (phone) {
          const { data: prof } = await supabase
            .from("profiles").select("id").eq("phone", phone).maybeSingle();
          if (prof?.id) resolvedUserId = prof.id;
        }

        const insertRow: Record<string, any> = {
          track_number: trackNumber,
          phone_number: phone,
          user_id: resolvedUserId,
          merchant_id: apiKey.merchant_id,
          customer_code: customerCode,
          external_ref: body.externalRef || body.external_ref || null,
          description: body.description ?? body.notes ?? null,
          weight: body.weight ?? null,
          length: body.dimensions?.length ?? body.length ?? null,
          width: body.dimensions?.width ?? body.width ?? null,
          height: body.dimensions?.height ?? body.height ?? null,
          notes: body.notes ?? null,
          branch_id: apiKey.allowed_branches?.length === 1 ? apiKey.allowed_branches[0] : (body.branchId || body.branch_id || null),
        };

        const { data: created, error: insErr } = await supabase
          .from("cargo")
          .insert(insertRow)
          .select(SHIPMENT_COLUMNS)
          .single();
        if (insErr) {
          await logUsage(supabase, apiKey.id, "/shipments[POST]", 400, req);
          return jsonResponse({ error: insErr.message }, 400);
        }
        await logUsage(supabase, apiKey.id, "/shipments[POST]", 201, req);
        return jsonResponse({ data: shipmentDto(created, apiKey) }, 201);
      }

      // /shipments/:trackNumber/...

      if (sub) {
        // Resolve cargo with scoping
        let lookup = supabase.from("cargo").select(SHIPMENT_COLUMNS).eq("track_number", sub);
        lookup = applyKeyScope(lookup, apiKey);
        const { data: cargo, error: lookupErr } = await lookup.maybeSingle();
        if (lookupErr) throw lookupErr;
        if (!cargo) {
          await logUsage(supabase, apiKey.id, `/shipments/${subsub || "detail"}`, 404, req);
          return jsonResponse({ error: "Shipment not found" }, 404);
        }

        // GET /shipments/:track
        if (!subsub && req.method === "GET") {
          await logUsage(supabase, apiKey.id, "/shipments/:track", 200, req);
          return jsonResponse({ data: shipmentDto(cargo, apiKey) });
        }

        // GET /shipments/:track/status
        if (subsub === "status" && req.method === "GET") {
          const internal = cargo.status as InternalStatus;
          await logUsage(supabase, apiKey.id, "/shipments/:track/status", 200, req);
          return jsonResponse({
            data: {
              trackNumber: cargo.track_number,
              status: INTERNAL_TO_EXTERNAL[internal] ?? cargo.status,
              statusUpdatedAt: cargo.status_date,
            },
          });
        }

        // GET /shipments/:track/fee
        if (subsub === "fee" && req.method === "GET") {
          if (!apiKey.allow_price) {
            await logUsage(supabase, apiKey.id, "/shipments/:track/fee", 403, req);
            return jsonResponse({ error: "Fee access is not enabled for this API key" }, 403);
          }
          const dto = shipmentDto(cargo, apiKey);
          await logUsage(supabase, apiKey.id, "/shipments/:track/fee", 200, req);
          return jsonResponse({ data: { trackNumber: cargo.track_number, fee: dto.fee } });
        }

        // GET /shipments/:track/location
        if (subsub === "location" && req.method === "GET") {
          const internal = cargo.status as InternalStatus;
          let branchInfo: any = null;
          if (cargo.branch_id) {
            const { data: br } = await supabase.from("branches")
              .select("name, code").eq("id", cargo.branch_id).maybeSingle();
            branchInfo = br;
          }
          await logUsage(supabase, apiKey.id, "/shipments/:track/location", 200, req);
          return jsonResponse({
            data: {
              trackNumber: cargo.track_number,
              status: INTERNAL_TO_EXTERNAL[internal] ?? cargo.status,
              location: STATUS_LOCATION[internal] ?? null,
              branch: branchInfo,
              updatedAt: cargo.status_date,
            },
          });
        }

        // GET /shipments/:track/history
        if (subsub === "history" && req.method === "GET") {
          const { data: hist, error } = await supabase
            .from("cargo_status_history")
            .select("status, created_at")
            .eq("cargo_id", cargo.id)
            .order("created_at", { ascending: true });
          if (error) throw error;
          const items = (hist || []).map((h: any) => ({
            status: INTERNAL_TO_EXTERNAL[h.status as InternalStatus] ?? h.status,
            timestamp: h.created_at,
          }));
          await logUsage(supabase, apiKey.id, "/shipments/:track/history", 200, req);
          return jsonResponse({ data: items });
        }

        // GET /shipments/:track/images
        if (subsub === "images" && req.method === "GET") {
          const { data: photos, error } = await supabase
            .from("cargo_photos")
            .select("photo_url, created_at")
            .eq("cargo_id", cargo.id)
            .order("created_at", { ascending: true });
          if (error) throw error;
          const items = (photos || []).map((p: any) => ({ url: p.photo_url, uploadedAt: p.created_at }));
          await logUsage(supabase, apiKey.id, "/shipments/:track/images", 200, req);
          return jsonResponse({ data: items });
        }

        // POST /shipments/:track/status
        if (subsub === "status" && req.method === "POST") {
          const body = await req.json().catch(() => ({}));
          const extStatus = body.status as ExternalStatus;
          if (!extStatus || !(extStatus in EXTERNAL_TO_INTERNAL)) {
            await logUsage(supabase, apiKey.id, "/shipments/:track/status", 400, req);
            return jsonResponse({
              error: "Invalid status",
              accepted: Object.keys(EXTERNAL_TO_INTERNAL),
            }, 400);
          }
          const internalStatus = EXTERNAL_TO_INTERNAL[extStatus];
          if (!internalStatus) {
            await logUsage(supabase, apiKey.id, "/shipments/:track/status", 400, req);
            return jsonResponse({ error: `Status '${extStatus}' cannot be applied via API` }, 400);
          }

          const { data, error } = await supabase
            .from("cargo")
            .update({ status: internalStatus, status_date: new Date().toISOString() })
            .eq("id", cargo.id)
            .select("id, track_number, status, status_date")
            .maybeSingle();
          if (error) throw error;

          await logUsage(supabase, apiKey.id, "/shipments/:track/status", 200, req);
          return jsonResponse({
            data: {
              trackNumber: data!.track_number,
              status: INTERNAL_TO_EXTERNAL[data!.status as InternalStatus],
              statusUpdatedAt: data!.status_date,
            },
          });
        }

        // PATCH /shipments/:track  (update merchant-editable fields)
        if (!subsub && (req.method === "PATCH" || req.method === "PUT")) {
          if (!apiKey.merchant_id) {
            await logUsage(supabase, apiKey.id, "/shipments/:track[PATCH]", 403, req);
            return jsonResponse({ error: "Merchant-scoped API key required" }, 403);
          }
          const body = await req.json().catch(() => ({} as any));
          const patch: Record<string, any> = {};
          if (body.weight !== undefined) patch.weight = body.weight;
          if (body.length !== undefined) patch.length = body.length;
          if (body.width !== undefined) patch.width = body.width;
          if (body.height !== undefined) patch.height = body.height;
          if (body.dimensions) {
            if (body.dimensions.length !== undefined) patch.length = body.dimensions.length;
            if (body.dimensions.width !== undefined) patch.width = body.dimensions.width;
            if (body.dimensions.height !== undefined) patch.height = body.dimensions.height;
          }
          if (body.notes !== undefined) patch.notes = body.notes;
          if (body.externalRef !== undefined) patch.external_ref = body.externalRef;
          if (body.external_ref !== undefined) patch.external_ref = body.external_ref;
          if (body.phone !== undefined || body.phone_number !== undefined) {
            const np = String(body.phone ?? body.phone_number).trim();
            if (np && !/^[6-9][0-9]{7}$/.test(np)) {
              await logUsage(supabase, apiKey.id, "/shipments/:track[PATCH]", 400, req);
              return jsonResponse({ error: "Invalid phone format" }, 400);
            }
            patch.phone_number = np;
          }
          if (Object.keys(patch).length === 0) {
            return jsonResponse({ error: "No editable fields provided" }, 400);
          }
          const { data: updated, error: updErr } = await supabase
            .from("cargo").update(patch).eq("id", cargo.id)
            .select(SHIPMENT_COLUMNS).single();
          if (updErr) {
            await logUsage(supabase, apiKey.id, "/shipments/:track[PATCH]", 400, req);
            return jsonResponse({ error: updErr.message }, 400);
          }
          await logUsage(supabase, apiKey.id, "/shipments/:track[PATCH]", 200, req);
          return jsonResponse({ data: shipmentDto(updated, apiKey) });
        }

        // POST /shipments/:track/cancel  (only while still in 'registered' state)
        if (subsub === "cancel" && req.method === "POST") {
          if (!apiKey.merchant_id) {
            await logUsage(supabase, apiKey.id, "/shipments/:track/cancel", 403, req);
            return jsonResponse({ error: "Merchant-scoped API key required" }, 403);
          }
          if (cargo.status !== "registered") {
            await logUsage(supabase, apiKey.id, "/shipments/:track/cancel", 409, req);
            return jsonResponse({
              error: "Only shipments in 'created' status can be cancelled",
              currentStatus: INTERNAL_TO_EXTERNAL[cargo.status as InternalStatus] ?? cargo.status,
            }, 409);
          }
          const { error: delErr } = await supabase.from("cargo").delete().eq("id", cargo.id);
          if (delErr) {
            await logUsage(supabase, apiKey.id, "/shipments/:track/cancel", 400, req);
            return jsonResponse({ error: delErr.message }, 400);
          }
          await logUsage(supabase, apiKey.id, "/shipments/:track/cancel", 200, req);
          return jsonResponse({ data: { trackNumber: cargo.track_number, cancelled: true } });
        }
      }

    }

    // ===== Backward compatible /cargo/* routes =====
    if (resource === "cargo") {
      // GET /cargo/by-tracking
      if (sub === "by-tracking" && req.method === "GET") {
        const trackNumber = url.searchParams.get("trackNumber");
        if (!trackNumber) return jsonResponse({ error: "trackNumber required" }, 400);
        let q = supabase.from("cargo").select(SHIPMENT_COLUMNS).eq("track_number", trackNumber);
        q = applyKeyScope(q, apiKey);
        const { data } = await q.maybeSingle();
        if (!data) return jsonResponse({ error: "Cargo not found" }, 404);
        await logUsage(supabase, apiKey.id, "/cargo/by-tracking", 200, req);
        return jsonResponse({ data: shipmentDto(data, apiKey) });
      }
      // GET /cargo/by-phone
      if (sub === "by-phone" && req.method === "GET") {
        if (!apiKey.allow_phone_search && !apiKey.verified_phone) {
          return jsonResponse({ error: "Phone search not enabled" }, 403);
        }
        const requested = url.searchParams.get("phone");
        // If the key has a verified phone, ignore the query param and force the verified phone.
        const phone = apiKey.verified_phone || requested;
        if (!phone) return jsonResponse({ error: "phone required" }, 400);
        if (apiKey.verified_phone && requested && requested !== apiKey.verified_phone) {
          return jsonResponse({ error: "Phone mismatch. Key is bound to a verified phone." }, 403);
        }
        let q = supabase.from("cargo").select(SHIPMENT_COLUMNS).eq("phone_number", phone);
        q = applyKeyScope(q, apiKey);
        const { data } = await q.order("created_at", { ascending: false }).limit(50);
        await logUsage(supabase, apiKey.id, "/cargo/by-phone", 200, req);
        return jsonResponse({ data: (data || []).map((c: any) => shipmentDto(c, apiKey)) });
      }
      // GET /cargo/history
      if (sub === "history" && req.method === "GET") {
        const trackNumber = url.searchParams.get("trackNumber");
        if (!trackNumber) return jsonResponse({ error: "trackNumber required" }, 400);
        let lookup = supabase.from("cargo").select("id").eq("track_number", trackNumber);
        lookup = applyKeyScope(lookup, apiKey);
        const { data: cargo } = await lookup.maybeSingle();
        if (!cargo) return jsonResponse({ error: "Cargo not found" }, 404);
        const { data: hist } = await supabase
          .from("cargo_status_history")
          .select("status, created_at")
          .eq("cargo_id", cargo.id)
          .order("created_at", { ascending: true });
        await logUsage(supabase, apiKey.id, "/cargo/history", 200, req);
        return jsonResponse({
          data: (hist || []).map((h: any) => ({
            status: INTERNAL_TO_EXTERNAL[h.status as InternalStatus] ?? h.status,
            timestamp: h.created_at,
          })),
        });
      }
      // POST /cargo/status
      if (sub === "status" && req.method === "POST") {
        const body = await req.json().catch(() => ({}));
        const { track_number, status } = body;
        if (!track_number || !status) return jsonResponse({ error: "track_number and status required" }, 400);
        const internal =
          (EXTERNAL_TO_INTERNAL as any)[status] ?? (status in INTERNAL_TO_EXTERNAL ? status : null);
        if (!internal) return jsonResponse({ error: "Invalid status" }, 400);

        let q = supabase.from("cargo").update({
          status: internal, status_date: new Date().toISOString(),
        }).eq("track_number", track_number);
        q = applyKeyScope(q, apiKey);
        const { data, error } = await q.select("id, track_number, status, status_date");
        if (error) throw error;
        if (!data?.length) return jsonResponse({ error: "Cargo not found" }, 404);
        await logUsage(supabase, apiKey.id, "/cargo/status", 200, req);
        return jsonResponse({
          data: {
            trackNumber: data[0].track_number,
            status: INTERNAL_TO_EXTERNAL[data[0].status as InternalStatus],
            statusUpdatedAt: data[0].status_date,
          },
        });
      }
    }

    await logUsage(supabase, apiKey.id, "/not-found", 404, req);
    return jsonResponse(
      {
        error: "Not found",
        available_endpoints: [
          "GET /shipments?page=&pageSize=&sort=&order=&status=&q=&merchant_id=&customer_code=&from=&to=",
          "GET /shipments/:trackNumber",
          "GET /shipments/:trackNumber/status",
          "GET /shipments/:trackNumber/fee",
          "GET /shipments/:trackNumber/history",
          "GET /shipments/:trackNumber/images",
          "GET /shipments/:trackNumber/location",
          "POST /shipments/:trackNumber/status { status }",
          "POST /shipments { trackNumber, phone, customerCode?, weight?, dimensions?, notes?, externalRef? }",
          "PATCH /shipments/:trackNumber { weight?, dimensions?, notes?, externalRef?, phone? }",
          "POST /shipments/:trackNumber/cancel",
          "GET /verify-phone",
          "POST /verify-phone/request { phone }",
          "POST /verify-phone/confirm { phone, otp }",
          "GET /health",
        ],
      },
      404,
    );
  } catch (err) {
    console.error("External API error:", err);
    await logUsage(supabase, apiKey.id, "error", 500, req).catch(() => {});
    return jsonResponse({ error: "Internal server error" }, 500, { "Retry-After": "1" });
  }
});
