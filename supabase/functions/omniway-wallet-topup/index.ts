import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OMNIWAY_BASE_URL = "https://payment.omnitech.mn";

interface OmniWayInvoiceResponse {
  invoiceNumber: string;
  qrContent: string;
  imageBase64: string;
}

interface OmniWayErrorResponse {
  code: number;
  message: string;
}

function getOmniWayErrorMessage(code: number): string {
  switch (code) {
    case 1001: return "Нэхэмжлэхийн дүн хоосон байна";
    case 1011: return "Нэхэмжлэхийн дүн буруу байна";
    case 1012: return "Захиалгын дугаар давхардсан байна";
    default: return "OmniWay алдаа гарлаа";
  }
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
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Server configuration missing");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    console.log("[OmniWay Topup] User:", user.id);

    const { amount } = await req.json();
    const amountNum = Number(amount);

    if (!amountNum || amountNum < 1000) {
      throw new Error("Хамгийн багадаа 1,000₮");
    }
    if (amountNum > 10000000) {
      throw new Error("Хамгийн ихдээ 10,000,000₮");
    }

    // Ensure wallet exists
    let { data: wallet, error: walletError } = await supabase
      .from("wallets")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!wallet && !walletError) {
      const { data: newWallet, error: createError } = await supabase
        .from("wallets")
        .insert({ user_id: user.id, balance: 0 })
        .select()
        .single();
      if (createError) throw createError;
      wallet = newWallet;
    }
    if (!wallet) throw new Error("Failed to get/create wallet");

    // OmniWay credentials
    const omniUsername = Deno.env.get("OMNIWAY_USERNAME");
    const omniPassword = Deno.env.get("OMNIWAY_PASSWORD");

    if (!omniUsername || !omniPassword) {
      throw new Error("OmniWay credentials not configured");
    }

    // Generate unique order number
    const orderNumber = `WALLET_TOPUP_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const callbackUrl = `${supabaseUrl}/functions/v1/omniway-callback`;

    // Get user profile for phone
    const { data: profile } = await supabase
      .from("profiles")
      .select("phone")
      .eq("id", user.id)
      .maybeSingle();

    // Create OmniWay invoice
    const credentials = btoa(`${omniUsername}:${omniPassword}`);
    
    const invoiceBody = {
      amount: amountNum,
      orderNumber: orderNumber,
      mobileNumber: profile?.phone || "",
      email: "",
      shippingAddress: "",
      description: `OnlyCargo Түрийвч цэнэглэлт - ${amountNum.toLocaleString()}₮`,
      callbackUrl: callbackUrl,
    };

    console.log("[OmniWay Topup] Creating invoice:", { orderNumber, amount: amountNum });

    const response = await fetch(`${OMNIWAY_BASE_URL}/ecommerce/invoices`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": `Basic ${credentials}`,
      },
      body: JSON.stringify(invoiceBody),
    });

    if (!response.ok) {
      const errorData: OmniWayErrorResponse = await response.json();
      console.error("[OmniWay Topup] Invoice error:", errorData);
      throw new Error(getOmniWayErrorMessage(errorData.code));
    }

    const invoiceData: OmniWayInvoiceResponse = await response.json();
    console.log("[OmniWay Topup] Invoice created:", invoiceData.invoiceNumber);

    // Save topup record
    const { data: topupRecord, error: topupError } = await supabase
      .from("wallet_topups")
      .insert({
        wallet_id: wallet.id,
        user_id: user.id,
        amount: amountNum,
        status: "pending",
        provider: "omniway",
        omniway_invoice_number: invoiceData.invoiceNumber,
        omniway_qr_content: invoiceData.qrContent,
        omniway_image_base64: invoiceData.imageBase64,
        invoice_ref: orderNumber,
      })
      .select()
      .single();

    if (topupError) {
      console.error("[OmniWay Topup] DB error:", topupError);
      throw new Error("Failed to create topup record");
    }

    return new Response(
      JSON.stringify({
        success: true,
        topup_id: topupRecord.id,
        invoice_number: invoiceData.invoiceNumber,
        qr_content: invoiceData.qrContent,
        image_base64: invoiceData.imageBase64,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error) {
    console.error("[OmniWay Topup Error]", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
