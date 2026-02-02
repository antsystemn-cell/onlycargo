import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// QPay API endpoints (production)
const QPAY_BASE_URL = "https://merchant.qpay.mn/v2";

interface CheckPaymentRequest {
  payment_id: string;
}

interface QPayTokenResponse {
  access_token: string;
  expires_in: number;
}

interface QPayPaymentCheckResponse {
  count: number;
  paid_amount: number;
  rows: Array<{
    payment_id: string;
    payment_status: "NEW" | "FAILED" | "PAID" | "REFUNDED";
    payment_date: string;
    payment_fee: string;
    payment_amount: string;
    payment_currency: string;
    payment_wallet: string;
    transaction_type: string;
  }>;
}

/**
 * Get QPay access token
 * Documentation: https://developer.qpay.mn/#токен-авах-хүсэлт
 */
async function getQPayToken(username: string, password: string): Promise<string> {
  console.log("[QPay] Requesting access token for payment check...");
  
  const credentials = btoa(`${username}:${password}`);
  
  const response = await fetch(`${QPAY_BASE_URL}/auth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Basic ${credentials}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[QPay] Auth failed:", response.status, errorText);
    throw new Error(`QPay authentication failed: ${response.status}`);
  }

  const data: QPayTokenResponse = await response.json();
  
  if (!data.access_token) {
    throw new Error("QPay returned empty access token");
  }
  
  return data.access_token;
}

/**
 * Check payment status from QPay
 * Documentation: https://developer.qpay.mn/#төлбөр-шалгах
 */
async function checkQPayPayment(
  accessToken: string,
  invoiceId: string
): Promise<QPayPaymentCheckResponse> {
  console.log("[QPay] Checking payment status for invoice:", invoiceId);
  
  const requestBody = {
    object_type: "INVOICE",
    object_id: invoiceId,
    offset: {
      page_number: 1,
      page_limit: 100,
    },
  };

  const response = await fetch(`${QPAY_BASE_URL}/payment/check`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${accessToken}`,
    },
    body: JSON.stringify(requestBody),
  });

  const responseText = await response.text();

  if (!response.ok) {
    console.error("[QPay] Payment check failed:", response.status, responseText);
    throw new Error(`QPay payment check failed: ${response.status}`);
  }

  let data: QPayPaymentCheckResponse;
  try {
    data = JSON.parse(responseText);
  } catch (e) {
    console.error("[QPay] Failed to parse payment check response:", responseText);
    throw new Error("Invalid QPay payment check response format");
  }

  console.log("[QPay] Payment check result:", {
    count: data.count,
    paid_amount: data.paid_amount,
    rows_count: data.rows?.length || 0,
  });

  return data;
}

/**
 * Map QPay payment status to internal status
 */
function mapQPayStatus(qpayStatus: string): "pending" | "paid" | "failed" | "refunded" {
  switch (qpayStatus) {
    case "PAID":
      return "paid";
    case "FAILED":
      return "failed";
    case "REFUNDED":
      return "refunded";
    case "NEW":
    default:
      return "pending";
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Validate authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase configuration missing");
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user token
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      console.error("[Auth] User verification failed:", authError?.message);
      throw new Error("Unauthorized - invalid token");
    }

    // Parse request
    const { payment_id }: CheckPaymentRequest = await req.json();

    if (!payment_id) {
      throw new Error("Missing payment_id");
    }

    // Fetch payment from database
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .select("*")
      .eq("id", payment_id)
      .maybeSingle();

    if (paymentError) {
      console.error("[DB] Payment fetch error:", paymentError);
      throw new Error("Failed to fetch payment");
    }

    if (!payment) {
      throw new Error("Payment not found");
    }

    // Verify ownership or admin access
    if (payment.user_id !== user.id) {
      const { data: isAdmin } = await supabase.rpc("is_admin");
      if (!isAdmin) {
        throw new Error("Unauthorized - not payment owner");
      }
    }

    // If already finalized, return current status
    if (payment.status === "paid" || payment.status === "failed" || payment.status === "refunded") {
      console.log("[Status] Payment already finalized:", payment.status);
      return new Response(
        JSON.stringify({
          success: true,
          status: payment.status,
          paid_at: payment.paid_at,
          finalized: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Get QPay credentials
    const qpayUsername = Deno.env.get("QPAY_USERNAME");
    const qpayPassword = Deno.env.get("QPAY_PASSWORD");

    let newStatus = payment.status;
    let paidAt: string | null = null;
    let qpayPaymentId: string | null = null;

    // Check if this is a demo payment
    const isDemoPayment = payment.qpay_invoice_id?.startsWith("DEMO-");

    if (qpayUsername && qpayPassword && payment.qpay_invoice_id && !isDemoPayment) {
      // Production mode - check with QPay API
      console.log("[QPay] Checking payment status via API...");
      
      try {
        const accessToken = await getQPayToken(qpayUsername, qpayPassword);
        const checkResult = await checkQPayPayment(accessToken, payment.qpay_invoice_id);

        // Process QPay response
        if (checkResult.rows && checkResult.rows.length > 0) {
          // Find the most recent payment with PAID status
          const paidPayment = checkResult.rows.find(row => row.payment_status === "PAID");
          
          if (paidPayment) {
            newStatus = "paid";
            paidAt = paidPayment.payment_date || new Date().toISOString();
            qpayPaymentId = paidPayment.payment_id;
            console.log("[QPay] Payment confirmed PAID:", qpayPaymentId);
          } else {
            // Check for failed
            const failedPayment = checkResult.rows.find(row => row.payment_status === "FAILED");
            if (failedPayment) {
              newStatus = "failed";
              console.log("[QPay] Payment FAILED");
            }
            
            // Check for refunded
            const refundedPayment = checkResult.rows.find(row => row.payment_status === "REFUNDED");
            if (refundedPayment) {
              newStatus = "refunded";
              console.log("[QPay] Payment REFUNDED");
            }
          }
        } else {
          console.log("[QPay] No payment rows found - still pending");
        }
      } catch (qpayError) {
        console.error("[QPay] API error:", qpayError);
        // Don't throw - return current status
        return new Response(
          JSON.stringify({
            success: true,
            status: payment.status,
            paid_at: payment.paid_at,
            error_checking: true,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }
    } else if (isDemoPayment) {
      // Demo mode - simulate payment after 30 seconds (for testing)
      const createdAt = new Date(payment.created_at).getTime();
      const elapsed = Date.now() - createdAt;
      
      if (elapsed > 30000) {
        // 50% chance of being paid after 30 seconds in demo mode
        if (Math.random() > 0.5) {
          newStatus = "paid";
          paidAt = new Date().toISOString();
          console.log("[Demo] Simulated payment success");
        }
      }
    }

    // Update payment if status changed
    if (newStatus !== payment.status) {
      console.log("[DB] Updating payment status:", payment.status, "->", newStatus);
      
      const updateData: any = {
        status: newStatus,
      };
      
      if (paidAt) {
        updateData.paid_at = paidAt;
      }
      
      if (qpayPaymentId) {
        updateData.notes = payment.notes 
          ? `${payment.notes} | QPay Payment: ${qpayPaymentId}`
          : `QPay Payment: ${qpayPaymentId}`;
      }

      const { error: updateError } = await supabase
        .from("payments")
        .update(updateData)
        .eq("id", payment_id);

      if (updateError) {
        console.error("[DB] Payment update error:", updateError);
      } else {
        console.log("[DB] Payment status updated successfully");
        
        // If payment is now paid, update cargo status
        if (newStatus === "paid") {
          const { data: paymentCargos } = await supabase
            .from("payment_cargo")
            .select("cargo_id")
            .eq("payment_id", payment_id);

          if (paymentCargos && paymentCargos.length > 0) {
            const cargoIds = paymentCargos.map((pc: any) => pc.cargo_id);
            console.log("[DB] Marking cargo as payment complete:", cargoIds);
            
            // Optionally update cargo status or add payment flag
            // This depends on business logic - cargo might still need to be handed over
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        status: newStatus,
        paid_at: paidAt,
        changed: newStatus !== payment.status,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error) {
    console.error("[Error]", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
