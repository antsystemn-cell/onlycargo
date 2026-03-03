import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// SHA-256 hash
async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function maskPhone(phone: string): string {
  if (!phone || phone.length < 4) return "****";
  return phone.slice(0, 4) + "****";
}

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
}

async function validateApiKey(
  supabase: any,
  rawKey: string
): Promise<{ valid: false; error: string; status: number } | { valid: true; apiKey: ApiKeyRecord }> {
  const keyHash = await hashKey(rawKey);

  const { data, error } = await supabase
    .from("api_keys")
    .select("*")
    .eq("key_hash", keyHash)
    .single();

  if (error || !data) {
    return { valid: false, error: "Invalid API key", status: 401 };
  }

  if (!data.is_active) {
    return { valid: false, error: "API key is disabled", status: 401 };
  }

  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return { valid: false, error: "API key has expired", status: 401 };
  }

  return { valid: true, apiKey: data as ApiKeyRecord };
}

async function checkRateLimit(
  supabase: any,
  apiKeyId: string,
  perMinute: number,
  perDay: number
): Promise<boolean> {
  const now = new Date();
  const oneMinuteAgo = new Date(now.getTime() - 60000).toISOString();
  const oneDayAgo = new Date(now.getTime() - 86400000).toISOString();

  // Check per-minute
  const { count: minuteCount } = await supabase
    .from("api_key_usage_logs")
    .select("*", { count: "exact", head: true })
    .eq("api_key_id", apiKeyId)
    .gte("created_at", oneMinuteAgo);

  if ((minuteCount || 0) >= perMinute) return false;

  // Check per-day
  const { count: dayCount } = await supabase
    .from("api_key_usage_logs")
    .select("*", { count: "exact", head: true })
    .eq("api_key_id", apiKeyId)
    .gte("created_at", oneDayAgo);

  if ((dayCount || 0) >= perDay) return false;

  return true;
}

async function logUsage(
  supabase: any,
  apiKeyId: string,
  endpoint: string,
  statusCode: number,
  req: Request
) {
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";
  const userAgent = req.headers.get("user-agent") || "unknown";

  await supabase.from("api_key_usage_logs").insert({
    api_key_id: apiKeyId,
    endpoint,
    status_code: statusCode,
    ip_address: ip,
    user_agent: userAgent,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Extract API key from header
  const authHeader = req.headers.get("authorization");
  const xApiKey = req.headers.get("x-api-key");
  let rawKey = "";

  if (authHeader?.startsWith("Bearer ")) {
    rawKey = authHeader.slice(7);
  } else if (xApiKey) {
    rawKey = xApiKey;
  }

  if (!rawKey) {
    return jsonResponse({ error: "Missing API key. Use Authorization: Bearer {key} or X-API-Key header" }, 401);
  }

  // Validate API key
  const validation = await validateApiKey(supabase, rawKey);
  if (!validation.valid) {
    return jsonResponse({ error: validation.error }, validation.status);
  }

  const apiKey = validation.apiKey;

  // Check rate limit
  const withinLimit = await checkRateLimit(
    supabase,
    apiKey.id,
    apiKey.rate_limit_per_minute,
    apiKey.rate_limit_per_day
  );
  if (!withinLimit) {
    await logUsage(supabase, apiKey.id, "rate_limited", 429, req);
    return jsonResponse({ error: "Rate limit exceeded. Please try again later." }, 429);
  }

  // Parse URL path
  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  // /external-api/{resource}/{action}
  const resource = pathParts[1] || "";
  const action = pathParts[2] || "";

  try {
    // GET /external-api/health
    if (resource === "health") {
      await logUsage(supabase, apiKey.id, "/health", 200, req);
      return jsonResponse({ status: "ok", timestamp: new Date().toISOString() });
    }

    // GET /external-api/cargo/by-tracking?trackNumber=XXX
    if (resource === "cargo" && action === "by-tracking" && req.method === "GET") {
      const trackNumber = url.searchParams.get("trackNumber");
      if (!trackNumber) {
        await logUsage(supabase, apiKey.id, "/cargo/by-tracking", 400, req);
        return jsonResponse({ error: "trackNumber query parameter is required" }, 400);
      }

      let query = supabase
        .from("cargo")
        .select("id, track_number, phone_number, status, status_date, weight, length, width, height, price, branch_id, created_at, updated_at")
        .eq("track_number", trackNumber);

      // Branch scoping
      if (apiKey.allowed_branches && apiKey.allowed_branches.length > 0) {
        query = query.in("branch_id", apiKey.allowed_branches);
      }

      const { data, error } = await query.limit(1).maybeSingle();
      if (error) throw error;

      if (!data) {
        await logUsage(supabase, apiKey.id, "/cargo/by-tracking", 404, req);
        return jsonResponse({ error: "Cargo not found" }, 404);
      }

      // Apply privacy rules
      const result: Record<string, any> = {
        trackNumber: data.track_number,
        status: data.status,
        statusUpdatedAt: data.status_date,
        weight: data.weight,
        dimensions: data.length && data.width && data.height
          ? { length: data.length, width: data.width, height: data.height }
          : null,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };

      // Mask phone
      result.phone = maskPhone(data.phone_number);

      // Price only if allowed
      if (apiKey.allow_price) {
        result.price = data.price;
      }

      await logUsage(supabase, apiKey.id, "/cargo/by-tracking", 200, req);
      return jsonResponse({ data: result });
    }

    // GET /external-api/cargo/by-phone?phone=XXXXXXXX
    if (resource === "cargo" && action === "by-phone" && req.method === "GET") {
      if (!apiKey.allow_phone_search) {
        await logUsage(supabase, apiKey.id, "/cargo/by-phone", 403, req);
        return jsonResponse({ error: "Phone search is not enabled for this API key" }, 403);
      }

      const phone = url.searchParams.get("phone");
      if (!phone) {
        await logUsage(supabase, apiKey.id, "/cargo/by-phone", 400, req);
        return jsonResponse({ error: "phone query parameter is required" }, 400);
      }

      let query = supabase
        .from("cargo")
        .select("id, track_number, phone_number, status, status_date, weight, price, branch_id, created_at")
        .eq("phone_number", phone);

      if (apiKey.allowed_branches && apiKey.allowed_branches.length > 0) {
        query = query.in("branch_id", apiKey.allowed_branches);
      }

      const { data, error } = await query.order("created_at", { ascending: false }).limit(50);
      if (error) throw error;

      const results = (data || []).map((c: any) => ({
        trackNumber: c.track_number,
        status: c.status,
        statusUpdatedAt: c.status_date,
        phone: maskPhone(c.phone_number),
        weight: c.weight,
        price: apiKey.allow_price ? c.price : undefined,
        createdAt: c.created_at,
      }));

      await logUsage(supabase, apiKey.id, "/cargo/by-phone", 200, req);
      return jsonResponse({ data: results, total: results.length });
    }

    // GET /external-api/cargo/history?trackNumber=XXX
    if (resource === "cargo" && action === "history" && req.method === "GET") {
      const trackNumber = url.searchParams.get("trackNumber");
      if (!trackNumber) {
        await logUsage(supabase, apiKey.id, "/cargo/history", 400, req);
        return jsonResponse({ error: "trackNumber query parameter is required" }, 400);
      }

      // First find cargo and check branch access
      let cargoQuery = supabase
        .from("cargo")
        .select("id, branch_id")
        .eq("track_number", trackNumber);

      if (apiKey.allowed_branches && apiKey.allowed_branches.length > 0) {
        cargoQuery = cargoQuery.in("branch_id", apiKey.allowed_branches);
      }

      const { data: cargo } = await cargoQuery.maybeSingle();
      if (!cargo) {
        await logUsage(supabase, apiKey.id, "/cargo/history", 404, req);
        return jsonResponse({ error: "Cargo not found" }, 404);
      }

      const { data: history, error } = await supabase
        .from("cargo_status_history")
        .select("status, created_at, notes")
        .eq("cargo_id", cargo.id)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const results = (history || []).map((h: any) => ({
        status: h.status,
        timestamp: h.created_at,
        notes: null, // Don't expose admin notes externally
      }));

      await logUsage(supabase, apiKey.id, "/cargo/history", 200, req);
      return jsonResponse({ data: results });
    }

    // GET /external-api/cargo/search (legacy, keep backward compat)
    if (resource === "cargo" && req.method === "GET" && !action) {
      const trackNumber = url.searchParams.get("track_number");
      const phone = url.searchParams.get("phone");

      if (!trackNumber && !phone) {
        await logUsage(supabase, apiKey.id, "/cargo/search", 400, req);
        return jsonResponse({ error: "Provide track_number or phone query parameter" }, 400);
      }

      let query = supabase
        .from("cargo")
        .select("id, track_number, phone_number, status, status_date, weight, length, width, height, price, created_at");

      if (trackNumber) query = query.eq("track_number", trackNumber);
      if (phone) {
        if (!apiKey.allow_phone_search) {
          await logUsage(supabase, apiKey.id, "/cargo/search", 403, req);
          return jsonResponse({ error: "Phone search not enabled for this key" }, 403);
        }
        query = query.eq("phone_number", phone);
      }

      if (apiKey.allowed_branches && apiKey.allowed_branches.length > 0) {
        query = query.in("branch_id", apiKey.allowed_branches);
      }

      const { data, error } = await query.limit(50);
      if (error) throw error;

      const results = (data || []).map((c: any) => ({
        ...c,
        phone_number: maskPhone(c.phone_number),
        price: apiKey.allow_price ? c.price : undefined,
      }));

      await logUsage(supabase, apiKey.id, "/cargo/search", 200, req);
      return jsonResponse({ data: results });
    }

    // POST /external-api/cargo/status - Update cargo status
    if (resource === "cargo" && action === "status" && req.method === "POST") {
      const body = await req.json();
      const { track_number, status } = body;

      if (!track_number || !status) {
        await logUsage(supabase, apiKey.id, "/cargo/status", 400, req);
        return jsonResponse({ error: "track_number and status are required" }, 400);
      }

      const validStatuses = [
        "registered", "received_ereen", "transporting",
        "warehouse_processing", "ready_warehouse", "completed",
      ];

      if (!validStatuses.includes(status)) {
        await logUsage(supabase, apiKey.id, "/cargo/status", 400, req);
        return jsonResponse({ error: `Invalid status. Valid: ${validStatuses.join(", ")}` }, 400);
      }

      let updateQuery = supabase
        .from("cargo")
        .update({ status, status_date: new Date().toISOString() })
        .eq("track_number", track_number);

      if (apiKey.allowed_branches && apiKey.allowed_branches.length > 0) {
        updateQuery = updateQuery.in("branch_id", apiKey.allowed_branches);
      }

      const { data, error } = await updateQuery.select("id, track_number, status, status_date");

      if (error) throw error;
      if (!data || data.length === 0) {
        await logUsage(supabase, apiKey.id, "/cargo/status", 404, req);
        return jsonResponse({ error: "Cargo not found or no branch access" }, 404);
      }

      await logUsage(supabase, apiKey.id, "/cargo/status", 200, req);
      return jsonResponse({ data: data[0] });
    }

    await logUsage(supabase, apiKey.id, "/not-found", 404, req);
    return jsonResponse(
      {
        error: "Not found",
        available_endpoints: [
          "GET /external-api/cargo/by-tracking?trackNumber=XXX",
          "GET /external-api/cargo/by-phone?phone=XXXXXXXX",
          "GET /external-api/cargo/history?trackNumber=XXX",
          "POST /external-api/cargo/status { track_number, status }",
          "GET /external-api/health",
        ],
      },
      404
    );
  } catch (err) {
    console.error("External API error:", err);
    await logUsage(supabase, apiKey.id, "error", 500, req).catch(() => {});
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
