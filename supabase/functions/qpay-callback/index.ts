import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// QPay API v2 endpoints
const QPAY_BASE_URL = "https://merchant.qpay.mn/v2";

interface QPayTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

interface QPayPaymentCheckResponse {
  count: number;
  paid_amount: number;
  rows: Array<{
    payment_id: string;
    payment_status: "NEW" | "FAILED" | "PAID" | "REFUNDED";
    payment_date: string;
  }>;
}

/**
 * Get QPay access token using Basic Auth
 */
async function getQPayToken(username: string, password: string): Promise<{ access_token: string; refresh_token: string }> {
  console.log("[Callback] Requesting QPay access token...");
  
  const credentials = btoa(`${username}:${password}`);
  
  const response = await fetch(`${QPAY_BASE_URL}/auth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Basic ${credentials}`,
    },
  });

  if (!response.ok) {
    throw new Error(`QPay auth failed: ${response.status}`);
  }

  const data: QPayTokenResponse = await response.json();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  };
}

/**
 * Refresh QPay access token
 */
async function refreshQPayToken(refreshToken: string): Promise<{ access_token: string; refresh_token: string }> {
  console.log("[Callback] Refreshing QPay access token...");
  
  const response = await fetch(`${QPAY_BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${refreshToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`QPay token refresh failed: ${response.status}`);
  }

  const data: QPayTokenResponse = await response.json();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  };
}

/**
 * Check payment status via QPay API v2
 * POST /v2/payment/check with object_type=INVOICE
 */
async function checkPaymentStatus(
  accessToken: string,
  invoiceId: string
): Promise<{ data: QPayPaymentCheckResponse | null; tokenExpired: boolean }> {
  const response = await fetch(`${QPAY_BASE_URL}/payment/check`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      object_type: "INVOICE",
      object_id: invoiceId,
      offset: {
        page_number: 1,
        page_limit: 100,
      },
    }),
  });

  // Handle 401 - token expired
  if (response.status === 401) {
    return { data: null, tokenExpired: true };
  }

  if (!response.ok) {
    throw new Error(`QPay check failed: ${response.status}`);
  }

  const data: QPayPaymentCheckResponse = await response.json();
  return { data, tokenExpired: false };
}

/**
 * QPay Callback/Webhook Handler
 * 
 * This endpoint is called by QPay when a payment status changes.
 * QPay will POST to this URL when payment is completed.
 */
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Initialize Supabase with service role (no user auth for webhooks)
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase configuration missing");
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get query parameters
    const url = new URL(req.url);
    const paymentRef = url.searchParams.get("payment_ref");

    console.log("[Callback] Received QPay callback:", {
      method: req.method,
      payment_ref: paymentRef,
      url: req.url,
    });

    // Parse callback body
    let callbackData: any = {};
    if (req.method === "POST") {
      try {
        const bodyText = await req.text();
        console.log("[Callback] Raw body:", bodyText);
        
        if (bodyText) {
          callbackData = JSON.parse(bodyText);
        }
      } catch (e) {
        console.log("[Callback] Body parse error (non-JSON body):", e);
      }
    }

    console.log("[Callback] Callback data:", callbackData);

    // Find payment by reference (stored in notes field)
    let payment = null;
    
    if (paymentRef) {
      // Find by sender_invoice_no (stored in notes)
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("notes", paymentRef)
        .maybeSingle();
      
      if (!error && data) {
        payment = data;
      }
    }
    
    // If not found by ref, try by QPay invoice_id from callback body
    if (!payment && callbackData.invoice_id) {
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("qpay_invoice_id", callbackData.invoice_id)
        .maybeSingle();
      
      if (!error && data) {
        payment = data;
      }
    }

    if (!payment) {
      console.error("[Callback] Payment not found for ref:", paymentRef);
      // Return 200 to acknowledge receipt (QPay expects this)
      return new Response(
        JSON.stringify({ received: true, found: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    console.log("[Callback] Found payment:", payment.id);

    // If payment is already finalized, just acknowledge
    if (payment.status === "paid" || payment.status === "failed" || payment.status === "refunded") {
      console.log("[Callback] Payment already finalized:", payment.status);
      return new Response(
        JSON.stringify({ received: true, status: payment.status }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Verify payment status with QPay API v2
    const qpayUsername = Deno.env.get("QPAY_USERNAME");
    const qpayPassword = Deno.env.get("QPAY_PASSWORD");

    if (qpayUsername && qpayPassword && payment.qpay_invoice_id) {
      console.log("[Callback] Verifying with QPay API v2...");
      
      try {
        // Get access token
        let tokens = await getQPayToken(qpayUsername, qpayPassword);
        let accessToken = tokens.access_token;
        let refreshToken = tokens.refresh_token;

        // Check payment status
        let checkResult = await checkPaymentStatus(accessToken, payment.qpay_invoice_id);

        // Handle 401 - retry with refreshed token
        if (checkResult.tokenExpired) {
          console.log("[Callback] Token expired, refreshing...");
          const refreshedTokens = await refreshQPayToken(refreshToken);
          accessToken = refreshedTokens.access_token;
          checkResult = await checkPaymentStatus(accessToken, payment.qpay_invoice_id);
        }

        if (checkResult.data?.rows && checkResult.data.rows.length > 0) {
          const paidPayment = checkResult.data.rows.find(row => row.payment_status === "PAID");
          
          if (paidPayment) {
            console.log("[Callback] Payment confirmed PAID");
            
            // Update payment status
            const { error: updateError } = await supabase
              .from("payments")
              .update({
                status: "paid",
                paid_at: paidPayment.payment_date || new Date().toISOString(),
                notes: payment.notes 
                  ? `${payment.notes} | QPay Payment: ${paidPayment.payment_id}`
                  : `QPay Payment: ${paidPayment.payment_id}`,
              })
              .eq("id", payment.id);

            if (updateError) {
              console.error("[Callback] Update error:", updateError);
            } else {
              console.log("[Callback] Payment marked as paid");
            }
          }
        }
      } catch (qpayError) {
        console.error("[Callback] QPay verification error:", qpayError);
      }
    }

    // Always return 200 to acknowledge callback
    return new Response(
      JSON.stringify({ received: true, payment_id: payment.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error) {
    console.error("[Callback Error]", error);
    
    // Return 200 even on error to prevent QPay from retrying infinitely
    return new Response(
      JSON.stringify({ received: true, error: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  }
});
