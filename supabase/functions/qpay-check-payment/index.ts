import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CheckPaymentRequest {
  payment_id: string;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    // Parse request
    const { payment_id }: CheckPaymentRequest = await req.json();

    if (!payment_id) {
      throw new Error("Missing payment_id");
    }

    // Get payment
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .select("*")
      .eq("id", payment_id)
      .single();

    if (paymentError || !payment) {
      throw new Error("Payment not found");
    }

    // Check ownership
    if (payment.user_id !== user.id) {
      // Check if admin
      const { data: isAdmin } = await supabase.rpc("is_admin");
      if (!isAdmin) {
        throw new Error("Unauthorized");
      }
    }

    // If already paid or failed, just return current status
    if (payment.status !== "pending") {
      return new Response(
        JSON.stringify({
          success: true,
          status: payment.status,
          paid_at: payment.paid_at,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // Get QPay credentials
    const qpayUsername = Deno.env.get("QPAY_USERNAME");
    const qpayPassword = Deno.env.get("QPAY_PASSWORD");

    let newStatus = payment.status;
    let paidAt = null;

    if (qpayUsername && qpayPassword && payment.qpay_invoice_id) {
      // Get QPay auth token
      const tokenResponse = await fetch("https://merchant.qpay.mn/v2/auth/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Basic ${btoa(`${qpayUsername}:${qpayPassword}`)}`,
        },
      });

      if (tokenResponse.ok) {
        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;

        // Check payment status
        const checkResponse = await fetch(
          `https://merchant.qpay.mn/v2/payment/check`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              object_type: "INVOICE",
              object_id: payment.qpay_invoice_id,
            }),
          }
        );

        if (checkResponse.ok) {
          const checkData = await checkResponse.json();
          
          // QPay returns rows array with payment info
          if (checkData.rows && checkData.rows.length > 0) {
            const qpayPayment = checkData.rows[0];
            if (qpayPayment.payment_status === "PAID") {
              newStatus = "paid";
              paidAt = new Date().toISOString();
            }
          }
        }
      }
    } else if (payment.qpay_invoice_id?.startsWith("DEMO-")) {
      // Demo mode - simulate random payment after some time
      const createdAt = new Date(payment.created_at).getTime();
      const now = Date.now();
      const elapsed = now - createdAt;
      
      // After 30 seconds in demo mode, randomly mark as paid (for testing)
      if (elapsed > 30000 && Math.random() > 0.5) {
        newStatus = "paid";
        paidAt = new Date().toISOString();
      }
    }

    // Update payment if status changed
    if (newStatus !== payment.status) {
      const { error: updateError } = await supabase
        .from("payments")
        .update({
          status: newStatus,
          paid_at: paidAt,
        })
        .eq("id", payment_id);

      if (updateError) {
        console.error("Update error:", updateError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        status: newStatus,
        paid_at: paidAt,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
