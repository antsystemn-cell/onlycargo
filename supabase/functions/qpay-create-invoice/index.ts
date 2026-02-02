import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// QPay API endpoints (production)
const QPAY_BASE_URL = "https://merchant.qpay.mn/v2";

interface CreateInvoiceRequest {
  amount: number;
  cargo_ids: string[];
  description?: string;
}

interface QPayTokenResponse {
  token_type: string;
  refresh_expires_in: number;
  refresh_token: string;
  access_token: string;
  expires_in: number;
  scope: string;
  session_state: string;
}

interface QPayInvoiceResponse {
  invoice_id: string;
  qr_text: string;
  qr_image: string;
  urls: Array<{
    name: string;
    description: string;
    link: string;
    logo?: string;
  }>;
}

/**
 * Get QPay access token using Basic Auth
 * Documentation: https://developer.qpay.mn/#токен-авах-хүсэлт
 */
async function getQPayToken(username: string, password: string): Promise<string> {
  console.log("[QPay] Requesting access token...");
  
  // Create Basic auth header (Base64 encoded username:password)
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
    throw new Error(`QPay authentication failed: ${response.status} - ${errorText}`);
  }

  const data: QPayTokenResponse = await response.json();
  console.log("[QPay] Token obtained, expires in:", data.expires_in, "seconds");
  
  if (!data.access_token) {
    throw new Error("QPay returned empty access token");
  }
  
  return data.access_token;
}

/**
 * Create QPay invoice
 * Documentation: https://developer.qpay.mn/#нэхэмжлэх-үүсгэх
 */
async function createQPayInvoice(
  accessToken: string,
  invoiceCode: string,
  senderInvoiceNo: string,
  invoiceReceiverCode: string,
  description: string,
  amount: number,
  callbackUrl: string
): Promise<QPayInvoiceResponse> {
  console.log("[QPay] Creating invoice:", { senderInvoiceNo, amount, description });
  
  const requestBody = {
    invoice_code: invoiceCode,
    sender_invoice_no: senderInvoiceNo,
    invoice_receiver_code: invoiceReceiverCode,
    invoice_description: description,
    amount: amount,
    callback_url: callbackUrl,
  };

  console.log("[QPay] Invoice request body:", JSON.stringify(requestBody));

  const response = await fetch(`${QPAY_BASE_URL}/invoice`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${accessToken}`,
    },
    body: JSON.stringify(requestBody),
  });

  const responseText = await response.text();
  
  if (!response.ok) {
    console.error("[QPay] Invoice creation failed:", response.status, responseText);
    throw new Error(`QPay invoice creation failed: ${response.status} - ${responseText}`);
  }

  let data: QPayInvoiceResponse;
  try {
    data = JSON.parse(responseText);
  } catch (e) {
    console.error("[QPay] Failed to parse invoice response:", responseText);
    throw new Error("Invalid QPay invoice response format");
  }

  console.log("[QPay] Invoice created:", data.invoice_id);
  
  if (!data.invoice_id) {
    throw new Error("QPay returned empty invoice_id");
  }
  
  return data;
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

    console.log("[Auth] User verified:", user.id);

    // Parse and validate request body
    const { amount, cargo_ids, description }: CreateInvoiceRequest = await req.json();

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      throw new Error("Invalid amount: must be a positive number");
    }

    if (!cargo_ids || !Array.isArray(cargo_ids) || cargo_ids.length === 0) {
      throw new Error("Invalid cargo_ids: must be a non-empty array");
    }

    // Validate cargo ownership and status
    const { data: cargoItems, error: cargoError } = await supabase
      .from("cargo")
      .select("id, track_number, price, status, phone_number")
      .in("id", cargo_ids);

    if (cargoError) {
      console.error("[DB] Cargo fetch error:", cargoError);
      throw new Error("Failed to fetch cargo items");
    }

    if (!cargoItems || cargoItems.length !== cargo_ids.length) {
      throw new Error("Some cargo items not found");
    }

    // Validate all cargo items are ready for payment
    for (const cargo of cargoItems) {
      if (cargo.status !== 'ready_warehouse') {
        throw new Error(`Cargo ${cargo.track_number} is not ready for payment (status: ${cargo.status})`);
      }
      if (!cargo.price || cargo.price <= 0) {
        throw new Error(`Cargo ${cargo.track_number} has no valid price`);
      }
    }

    // Calculate expected total and verify against provided amount
    const expectedTotal = cargoItems.reduce((sum, c) => sum + (c.price || 0), 0);
    if (expectedTotal !== amount) {
      throw new Error(`Amount mismatch: expected ${expectedTotal}, got ${amount}`);
    }

    // Check for existing pending/paid payments on these cargo items
    const { data: existingPayments } = await supabase
      .from("payment_cargo")
      .select(`
        payment_id,
        cargo_id,
        payments!inner(status)
      `)
      .in("cargo_id", cargo_ids);

    if (existingPayments && existingPayments.length > 0) {
      const paidOrPending = existingPayments.filter(
        (pc: any) => pc.payments?.status === "paid" || pc.payments?.status === "pending"
      );
      
      if (paidOrPending.length > 0) {
        const isPaid = paidOrPending.some((pc: any) => pc.payments?.status === "paid");
        throw new Error(isPaid 
          ? "Some cargo items already have completed payment"
          : "Some cargo items have pending payment - please complete or cancel first"
        );
      }
    }

    // Get QPay credentials
    const qpayUsername = Deno.env.get("QPAY_USERNAME");
    const qpayPassword = Deno.env.get("QPAY_PASSWORD");
    const qpayInvoiceCode = Deno.env.get("QPAY_INVOICE_CODE");

    if (!qpayUsername || !qpayPassword || !qpayInvoiceCode) {
      console.error("[QPay] Missing credentials - using demo mode");
      
      // Demo mode fallback
      const demoInvoiceId = `DEMO-${Date.now()}`;
      const demoPayment = await createDemoPayment(
        supabase, 
        user.id, 
        amount, 
        cargo_ids, 
        demoInvoiceId
      );
      
      return new Response(
        JSON.stringify({
          success: true,
          demo_mode: true,
          payment_id: demoPayment.id,
          qr_image: demoPayment.qpay_qr_image,
          qr_text: demoPayment.qpay_qr_text,
          urls: demoPayment.qpay_urls,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Production mode - QPay integration
    console.log("[QPay] Starting production invoice creation...");

    // Step 1: Get QPay access token
    const accessToken = await getQPayToken(qpayUsername, qpayPassword);

    // Step 2: Create unique invoice number
    const senderInvoiceNo = `OC-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    
    // Step 3: Create callback URL for webhook
    const callbackUrl = `${supabaseUrl}/functions/v1/qpay-callback?payment_ref=${senderInvoiceNo}`;
    
    // Step 4: Create QPay invoice
    const invoiceDescription = description || `OnlyCargo - ${cargo_ids.length} ачаа (${cargoItems.map(c => c.track_number).join(', ')})`;
    
    const qpayInvoice = await createQPayInvoice(
      accessToken,
      qpayInvoiceCode,
      senderInvoiceNo,
      user.id.substring(0, 20), // invoice_receiver_code - unique customer ID
      invoiceDescription.substring(0, 255), // max 255 chars
      amount,
      callbackUrl
    );

    // Step 5: Transform URLs to key-value format
    const qpayUrls: Record<string, string> = {};
    if (qpayInvoice.urls && Array.isArray(qpayInvoice.urls)) {
      for (const url of qpayInvoice.urls) {
        if (url.name && url.link) {
          qpayUrls[url.name] = url.link;
        }
      }
    }

    // Step 6: Create payment record in database
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .insert({
        user_id: user.id,
        amount: amount,
        payment_method: "qpay",
        status: "pending",
        qpay_invoice_id: qpayInvoice.invoice_id,
        qpay_qr_text: qpayInvoice.qr_text,
        qpay_qr_image: qpayInvoice.qr_image,
        qpay_urls: qpayUrls,
        notes: senderInvoiceNo, // Store sender_invoice_no for reference
        created_by: user.id,
      })
      .select()
      .single();

    if (paymentError) {
      console.error("[DB] Payment creation error:", paymentError);
      throw new Error("Failed to create payment record in database");
    }

    console.log("[DB] Payment record created:", payment.id);

    // Step 7: Link payment to cargo items
    const paymentCargoLinks = cargo_ids.map((cargo_id) => ({
      payment_id: payment.id,
      cargo_id,
    }));

    const { error: linkError } = await supabase
      .from("payment_cargo")
      .insert(paymentCargoLinks);

    if (linkError) {
      console.error("[DB] Payment-cargo link error:", linkError);
      // Don't throw - payment was created successfully
    }

    // Step 8: Update cargo with payment reference
    const { error: cargoUpdateError } = await supabase
      .from("cargo")
      .update({ payment_id: payment.id })
      .in("id", cargo_ids);

    if (cargoUpdateError) {
      console.error("[DB] Cargo update error:", cargoUpdateError);
    }

    console.log("[Success] Invoice created successfully:", {
      payment_id: payment.id,
      qpay_invoice_id: qpayInvoice.invoice_id,
      amount: amount,
      cargo_count: cargo_ids.length,
    });

    return new Response(
      JSON.stringify({
        success: true,
        payment_id: payment.id,
        qr_image: qpayInvoice.qr_image,
        qr_text: qpayInvoice.qr_text,
        urls: qpayUrls,
        invoice_id: qpayInvoice.invoice_id,
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

/**
 * Create demo payment when QPay credentials are not configured
 */
async function createDemoPayment(
  supabase: any,
  userId: string,
  amount: number,
  cargoIds: string[],
  invoiceId: string
) {
  const demoQrImage = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiB2aWV3Qm94PSIwIDAgMjAwIDIwMCI+PHJlY3Qgd2lkdGg9IjIwMCIgaGVpZ2h0PSIyMDAiIGZpbGw9IiNmZmYiLz48cmVjdCB4PSIyMCIgeT0iMjAiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgZmlsbD0iIzMzMyIvPjxyZWN0IHg9IjE0MCIgeT0iMjAiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgZmlsbD0iIzMzMyIvPjxyZWN0IHg9IjIwIiB5PSIxNDAiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgZmlsbD0iIzMzMyIvPjx0ZXh0IHg9IjUwJSIgeT0iNTUlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LXNpemU9IjE0IiBmaWxsPSIjNjY2Ij5EZW1vIFFSPC90ZXh0Pjx0ZXh0IHg9IjUwJSIgeT0iNjUlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LXNpemU9IjEyIiBmaWxsPSIjOTk5Ij5RUGFZIGNyZWRlbnRpYWxzPC90ZXh0Pjx0ZXh0IHg9IjUwJSIgeT0iNzUlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LXNpemU9IjEyIiBmaWxsPSIjOTk5Ij5ub3QgY29uZmlndXJlZDwvdGV4dD48L3N2Zz4=";

  const demoUrls = {
    "Khan Bank (Demo)": "#demo",
    "TDB (Demo)": "#demo",
    "Golomt (Demo)": "#demo",
  };

  const { data: payment, error } = await supabase
    .from("payments")
    .insert({
      user_id: userId,
      amount: amount,
      payment_method: "qpay",
      status: "pending",
      qpay_invoice_id: invoiceId,
      qpay_qr_text: `Demo QR - ${amount} MNT`,
      qpay_qr_image: demoQrImage,
      qpay_urls: demoUrls,
      notes: `DEMO-MODE-${Date.now()}`,
      created_by: userId,
    })
    .select()
    .single();

  if (error) {
    throw new Error("Failed to create demo payment");
  }

  // Link payment to cargo
  const links = cargoIds.map((cargo_id) => ({
    payment_id: payment.id,
    cargo_id,
  }));

  await supabase.from("payment_cargo").insert(links);
  await supabase.from("cargo").update({ payment_id: payment.id }).in("id", cargoIds);

  return payment;
}
