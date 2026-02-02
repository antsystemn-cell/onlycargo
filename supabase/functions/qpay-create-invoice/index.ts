import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateInvoiceRequest {
  amount: number;
  cargo_ids: string[];
  description?: string;
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
    const { amount, cargo_ids, description }: CreateInvoiceRequest = await req.json();

    if (!amount || amount <= 0) {
      throw new Error("Invalid amount");
    }

    if (!cargo_ids || cargo_ids.length === 0) {
      throw new Error("No cargo selected");
    }

    // Check if any cargo already has a paid payment
    const { data: existingPayments } = await supabase
      .from("payment_cargo")
      .select("payment_id, payments!inner(status)")
      .in("cargo_id", cargo_ids);

    const hasPaidPayment = existingPayments?.some(
      (pc: any) => pc.payments?.status === "paid"
    );

    if (hasPaidPayment) {
      throw new Error("Some cargo already has a paid payment");
    }

    // Get QPay credentials from secrets
    const qpayUsername = Deno.env.get("QPAY_USERNAME");
    const qpayPassword = Deno.env.get("QPAY_PASSWORD");
    const qpayInvoiceCode = Deno.env.get("QPAY_INVOICE_CODE") || "ONLYCARGO_INVOICE";

    // For now, create a mock payment if QPay credentials not configured
    // In production, this would call the QPay API
    let qpayInvoiceId = null;
    let qpayQrText = null;
    let qpayQrImage = null;
    let qpayUrls = null;

    if (qpayUsername && qpayPassword) {
      // Get QPay auth token
      const tokenResponse = await fetch("https://merchant.qpay.mn/v2/auth/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Basic ${btoa(`${qpayUsername}:${qpayPassword}`)}`,
        },
      });

      if (!tokenResponse.ok) {
        console.error("QPay auth failed:", await tokenResponse.text());
        throw new Error("QPay authentication failed");
      }

      const tokenData = await tokenResponse.json();
      const accessToken = tokenData.access_token;

      // Create invoice
      const invoiceResponse = await fetch("https://merchant.qpay.mn/v2/invoice", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          invoice_code: qpayInvoiceCode,
          sender_invoice_no: `OC-${Date.now()}`,
          invoice_receiver_code: user.id.substring(0, 8),
          invoice_description: description || `OnlyCargo payment - ${cargo_ids.length} items`,
          amount: amount,
          callback_url: `${supabaseUrl}/functions/v1/qpay-callback`,
        }),
      });

      if (!invoiceResponse.ok) {
        console.error("QPay invoice creation failed:", await invoiceResponse.text());
        throw new Error("QPay invoice creation failed");
      }

      const invoiceData = await invoiceResponse.json();
      qpayInvoiceId = invoiceData.invoice_id;
      qpayQrText = invoiceData.qr_text;
      qpayQrImage = invoiceData.qr_image;
      qpayUrls = invoiceData.urls?.reduce((acc: any, url: any) => {
        acc[url.name] = url.link;
        return acc;
      }, {});
    } else {
      // Demo mode - create mock data
      qpayInvoiceId = `DEMO-${Date.now()}`;
      qpayQrText = `Demo QR for ${amount} MNT`;
      // Generate a placeholder QR image (base64 encoded)
      qpayQrImage = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiB2aWV3Qm94PSIwIDAgMjAwIDIwMCI+PHJlY3Qgd2lkdGg9IjIwMCIgaGVpZ2h0PSIyMDAiIGZpbGw9IiNmZmYiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iIGZvbnQtc2l6ZT0iMTYiIGZpbGw9IiM2NjYiPkRlbW8gUVIgQ29kZTwvdGV4dD48L3N2Zz4=";
      qpayUrls = {
        "Khan Bank": "#demo",
        "TDB": "#demo",
        "Golomt": "#demo",
      };
    }

    // Create payment record
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .insert({
        user_id: user.id,
        amount: amount,
        payment_method: "qpay",
        status: "pending",
        qpay_invoice_id: qpayInvoiceId,
        qpay_qr_text: qpayQrText,
        qpay_qr_image: qpayQrImage,
        qpay_urls: qpayUrls,
        created_by: user.id,
      })
      .select()
      .single();

    if (paymentError) {
      console.error("Payment creation error:", paymentError);
      throw new Error("Failed to create payment record");
    }

    // Link payment to cargo
    const paymentCargoLinks = cargo_ids.map((cargo_id) => ({
      payment_id: payment.id,
      cargo_id,
    }));

    const { error: linkError } = await supabase
      .from("payment_cargo")
      .insert(paymentCargoLinks);

    if (linkError) {
      console.error("Payment-cargo link error:", linkError);
      // Don't throw - payment was created
    }

    // Update cargo with payment_id
    await supabase
      .from("cargo")
      .update({ payment_id: payment.id })
      .in("id", cargo_ids);

    return new Response(
      JSON.stringify({
        success: true,
        payment_id: payment.id,
        qr_image: qpayQrImage,
        qr_text: qpayQrText,
        urls: qpayUrls,
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
