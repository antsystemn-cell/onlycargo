import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OMNIWAY_BASE_URL = "https://payment.omnitech.mn";

// OmniWay status codes
const STATUS_UNPAID = 301;
const STATUS_PAID = 302;
const STATUS_CANCELLED = 303;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Server configuration missing");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    const { topup_id } = await req.json();
    if (!topup_id) throw new Error("Missing topup_id");

    // Fetch topup record
    const { data: topup, error: topupError } = await supabase
      .from("wallet_topups")
      .select("*")
      .eq("id", topup_id)
      .maybeSingle();

    if (topupError || !topup) throw new Error("Topup record not found");
    if (topup.user_id !== user.id) throw new Error("Unauthorized - not owner");

    // Already finalized
    if (topup.status === "completed" || topup.status === "failed") {
      return new Response(
        JSON.stringify({ success: true, status: topup.status, finalized: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const omniUsername = Deno.env.get("OMNIWAY_USERNAME");
    const omniPassword = Deno.env.get("OMNIWAY_PASSWORD");
    if (!omniUsername || !omniPassword) {
      throw new Error("OmniWay credentials not configured");
    }

    const invoiceNumber = topup.omniway_invoice_number;
    if (!invoiceNumber) throw new Error("No OmniWay invoice number found");

    // Check status via OmniWay API
    const credentials = btoa(`${omniUsername}:${omniPassword}`);
    const statusResponse = await fetch(
      `${OMNIWAY_BASE_URL}/ecommerce/invoices/${invoiceNumber}`,
      {
        method: "GET",
        headers: {
          "Accept": "application/json",
          "Authorization": `Basic ${credentials}`,
        },
      }
    );

    if (!statusResponse.ok) {
      const errData = await statusResponse.json();
      console.error("[OmniWay Check] Status check failed:", errData);
      throw new Error("Failed to check invoice status");
    }

    const statusData = await statusResponse.json();
    console.log("[OmniWay Check] Status:", statusData);

    let newStatus = topup.status;
    let paidAt: string | null = null;

    if (statusData.statusId === STATUS_PAID) {
      newStatus = "completed";
      paidAt = new Date().toISOString();
    } else if (statusData.statusId === STATUS_CANCELLED) {
      newStatus = "failed";
    }
    // STATUS_UNPAID (301) = still pending, no change

    // Update if status changed
    if (newStatus !== topup.status) {
      console.log("[OmniWay Check] Status change:", topup.status, "->", newStatus);

      await supabase
        .from("wallet_topups")
        .update({ status: newStatus, paid_at: paidAt })
        .eq("id", topup_id);

      // If completed, credit wallet
      if (newStatus === "completed") {
        const { data: wallet } = await supabase
          .from("wallets")
          .select("*")
          .eq("id", topup.wallet_id)
          .single();

        if (wallet) {
          const newBalance = (wallet.balance || 0) + topup.amount;

          await supabase
            .from("wallets")
            .update({ balance: newBalance, updated_at: new Date().toISOString() })
            .eq("id", wallet.id);

          await supabase
            .from("wallet_transactions")
            .insert({
              wallet_id: wallet.id,
              user_id: user.id,
              type: "topup",
              amount: topup.amount,
              balance_after: newBalance,
              reference_type: "wallet_topup",
              reference_id: topup_id,
              description: `OmniWay цэнэглэлт - ${topup.amount.toLocaleString()}₮`,
            });

          console.log("[OmniWay Check] Balance updated:", wallet.balance, "->", newBalance);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        status: newStatus,
        paid_at: paidAt,
        changed: newStatus !== topup.status,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[OmniWay Check Error]", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
