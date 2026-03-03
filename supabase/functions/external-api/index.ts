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

async function validateApiKey(supabase: any, apiKey: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", "api_keys")
    .single();

  if (error || !data?.value) return false;

  const storedKeys = data.value as Record<string, string>;
  return Object.values(storedKeys).some((v) => v === apiKey);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Validate API key from header
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) {
    return jsonResponse({ error: "Missing x-api-key header" }, 401);
  }

  const isValid = await validateApiKey(supabase, apiKey);
  if (!isValid) {
    return jsonResponse({ error: "Invalid API key" }, 403);
  }

  // Parse URL path for routing
  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  // Path: /external-api/{resource}/{action}
  const resource = pathParts[1] || "";
  const action = pathParts[2] || "";

  try {
    // GET /external-api/cargo/search?track_number=XXX
    if (resource === "cargo" && req.method === "GET") {
      const trackNumber = url.searchParams.get("track_number");
      const phone = url.searchParams.get("phone");

      if (!trackNumber && !phone) {
        return jsonResponse(
          { error: "Provide track_number or phone query parameter" },
          400
        );
      }

      let query = supabase
        .from("cargo")
        .select("id, track_number, phone_number, status, status_date, weight, length, width, height, price, created_at");

      if (trackNumber) query = query.eq("track_number", trackNumber);
      if (phone) query = query.eq("phone_number", phone);

      const { data, error } = await query.limit(50);
      if (error) throw error;

      return jsonResponse({ data });
    }

    // POST /external-api/cargo/status - Update cargo status
    if (resource === "cargo" && action === "status" && req.method === "POST") {
      const body = await req.json();
      const { track_number, status } = body;

      if (!track_number || !status) {
        return jsonResponse(
          { error: "track_number and status are required" },
          400
        );
      }

      const validStatuses = [
        "registered",
        "received_ereen",
        "transporting",
        "warehouse_processing",
        "ready_warehouse",
        "completed",
      ];

      if (!validStatuses.includes(status)) {
        return jsonResponse(
          { error: `Invalid status. Valid: ${validStatuses.join(", ")}` },
          400
        );
      }

      const { data, error } = await supabase
        .from("cargo")
        .update({ status, status_date: new Date().toISOString() })
        .eq("track_number", track_number)
        .select("id, track_number, status, status_date");

      if (error) throw error;
      if (!data || data.length === 0) {
        return jsonResponse({ error: "Cargo not found" }, 404);
      }

      return jsonResponse({ data: data[0] });
    }

    // GET /external-api/health - Health check
    if (resource === "health") {
      return jsonResponse({ status: "ok", timestamp: new Date().toISOString() });
    }

    return jsonResponse(
      {
        error: "Not found",
        available_endpoints: [
          "GET /external-api/cargo/search?track_number=XXX",
          "GET /external-api/cargo/search?phone=XXXXXXXX",
          "POST /external-api/cargo/status { track_number, status }",
          "GET /external-api/health",
        ],
      },
      404
    );
  } catch (err) {
    console.error("External API error:", err);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
