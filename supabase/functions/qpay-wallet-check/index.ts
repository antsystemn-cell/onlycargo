import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const QPAY_BASE_URL = "https://merchant.qpay.mn/v2";

interface CheckTopupRequest {
  topup_id: string;
}

interface QPayPaymentCheckResponse {
  count: number;
  paid_amount: number;
  rows: Array<{
    payment_id: string;
    payment_status: "NEW" | "FAILED" | "PAID" | "REFUNDED";
    payment_date: string;
    payment_amount: string;
  }>;
}

async function getQPayToken(username: string, password: string): Promise<{ access_token: string; refresh_token: string }> {
  const credentials = btoa(`${username}:${password}`);
  
  const response = await fetch(`${QPAY_BASE_URL}/auth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Basic ${credentials}`,
    },
  });

  if (!response.ok) {
    throw new Error("QPay authentication failed");
  }

  const data = await response.json();
  return { access_token: data.access_token, refresh_token: data.refresh_token };
}

async function checkQPayPayment(accessToken: string, invoiceId: string): Promise<QPayPaymentCheckResponse | null> {
  const response = await fetch(`${QPAY_BASE_URL}/payment/check`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      object_type: "INVOICE",
      object_id: invoiceId,
      offset: { page_number: 1, page_limit: 100 },
    }),
  });

  if (response.status === 401) {
    return null; // Token expired
  }

  if (!response.ok) {
    throw new Error("QPay payment check failed");
  }

  return await response.json();
}

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
    
    const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    const { topup_id }: CheckTopupRequest = await req.json();

    if (!topup_id) {
      throw new Error("Missing topup_id");
    }

    // Fetch topup record
    const { data: topup, error: topupError } = await supabase
      .from("wallet_topups")
      .select("*")
      .eq("id", topup_id)
      .maybeSingle();

    if (topupError || !topup) {
      throw new Error("Topup record not found");
    }

    // Verify ownership
    if (topup.user_id !== user.id) {
      throw new Error("Unauthorized - not owner");
    }

    // Already finalized
    if (topup.status === "completed" || topup.status === "failed") {
      return new Response(
        JSON.stringify({
          success: true,
          status: topup.status,
          finalized: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const qpayUsername = Deno.env.get("QPAY_USERNAME");
    const qpayPassword = Deno.env.get("QPAY_PASSWORD");
    
    let newStatus = topup.status;
    let paidAt: string | null = null;

    // Demo mode check
    const isDemoMode = topup.qpay_invoice_id?.startsWith("DEMO-");

    if (qpayUsername && qpayPassword && !isDemoMode) {
      // Production - check QPay
      const tokens = await getQPayToken(qpayUsername, qpayPassword);
      const checkResult = await checkQPayPayment(tokens.access_token, topup.qpay_invoice_id);

      if (checkResult && checkResult.rows && checkResult.rows.length > 0) {
        const paidPayment = checkResult.rows.find(r => r.payment_status === "PAID");
        if (paidPayment) {
          newStatus = "completed";
          paidAt = paidPayment.payment_date || new Date().toISOString();
        }
      }
    } else if (isDemoMode) {
      // Demo - simulate after 30s
      const elapsed = Date.now() - new Date(topup.created_at).getTime();
      if (elapsed > 30000 && Math.random() > 0.3) {
        newStatus = "completed";
        paidAt = new Date().toISOString();
      }
    }

    // Update if status changed
    if (newStatus !== topup.status) {
      console.log("[Wallet Check] Status change:", topup.status, "->", newStatus);

      const { error: updateError } = await supabase
        .from("wallet_topups")
        .update({ status: newStatus, paid_at: paidAt })
        .eq("id", topup_id);

      if (updateError) {
        console.error("[Wallet Check] Update error:", updateError);
      }

      // If completed, add to wallet balance
      if (newStatus === "completed") {
        // Get current wallet
        const { data: wallet } = await supabase
          .from("wallets")
          .select("*")
          .eq("id", topup.wallet_id)
          .single();

        if (wallet) {
          const newBalance = (wallet.balance || 0) + topup.amount;

          // Update wallet balance
          await supabase
            .from("wallets")
            .update({ balance: newBalance, updated_at: new Date().toISOString() })
            .eq("id", wallet.id);

          // Create transaction record
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
              description: `QPay цэнэглэлт - ${topup.amount.toLocaleString()}₮`,
            });

          console.log("[Wallet Check] Balance updated:", wallet.balance, "->", newBalance);
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
    console.error("[Wallet Check Error]", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
