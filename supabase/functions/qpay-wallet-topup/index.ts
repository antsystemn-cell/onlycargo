import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// QPay API v2 endpoints (production)
const QPAY_BASE_URL = "https://merchant.qpay.mn/v2";

interface WalletTopupRequest {
  amount: number;
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

interface QPayBankApp {
  name: string;
  description: string;
  logo: string;
  link: string;
}

interface QPayInvoiceResponse {
  invoice_id: string;
  qr_text: string;
  qr_image: string;
  urls: QPayBankApp[];
}

/**
 * Get QPay access token using Basic Auth
 */
async function getQPayToken(username: string, password: string): Promise<{ access_token: string; refresh_token: string }> {
  console.log("[QPay Wallet] Requesting access token...");
  
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
    console.error("[QPay Wallet] Auth failed:", response.status, errorText);
    throw new Error(`QPay authentication failed: ${response.status}`);
  }

  const data: QPayTokenResponse = await response.json();
  
  if (!data.access_token) {
    throw new Error("QPay returned empty access token");
  }
  
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  };
}

/**
 * Refresh QPay access token
 */
async function refreshQPayToken(refreshToken: string): Promise<{ access_token: string; refresh_token: string }> {
  console.log("[QPay Wallet] Refreshing access token...");
  
  const response = await fetch(`${QPAY_BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${refreshToken}`,
    },
  });

  if (!response.ok) {
    throw new Error("QPay token refresh failed");
  }

  const data: QPayTokenResponse = await response.json();
  
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  };
}

/**
 * Create QPay invoice for wallet top-up
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
  console.log("[QPay Wallet] Creating invoice:", { senderInvoiceNo, amount });
  
  const requestBody = {
    invoice_code: invoiceCode,
    sender_invoice_no: senderInvoiceNo,
    invoice_receiver_code: invoiceReceiverCode,
    invoice_description: description,
    amount: amount,
    callback_url: callbackUrl,
  };

  const response = await fetch(`${QPAY_BASE_URL}/invoice`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${accessToken}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (response.status === 401) {
    throw new Error("TOKEN_EXPIRED");
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[QPay Wallet] Invoice failed:", response.status, errorText);
    throw new Error(`QPay invoice creation failed: ${response.status}`);
  }

  const data: QPayInvoiceResponse = await response.json();
  console.log("[QPay Wallet] Invoice created:", data.invoice_id);
  
  return data;
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
      throw new Error("Supabase configuration missing");
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    console.log("[Wallet Topup] User:", user.id);

    // Parse request
    const { amount }: WalletTopupRequest = await req.json();

    if (!amount || typeof amount !== 'number' || amount < 1000) {
      throw new Error("Invalid amount: minimum 1000₮");
    }

    if (amount > 10000000) {
      throw new Error("Invalid amount: maximum 10,000,000₮");
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

    if (!wallet) {
      throw new Error("Failed to get/create wallet");
    }

    // Get QPay credentials
    const qpayUsername = Deno.env.get("QPAY_USERNAME");
    const qpayPassword = Deno.env.get("QPAY_PASSWORD");
    const qpayInvoiceCode = Deno.env.get("QPAY_INVOICE_CODE");

    const senderInvoiceNo = `WALLET-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const callbackUrl = `${supabaseUrl}/functions/v1/qpay-wallet-callback?ref=${senderInvoiceNo}`;

    let qpayInvoiceId: string;
    let qrImage: string;
    let qrText: string;
    let bankUrls: QPayBankApp[] = [];
    let isDemoMode = false;

    if (!qpayUsername || !qpayPassword || !qpayInvoiceCode) {
      console.log("[Wallet Topup] Demo mode - no QPay credentials");
      isDemoMode = true;
      qpayInvoiceId = `DEMO-WALLET-${Date.now()}`;
      qrImage = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiB2aWV3Qm94PSIwIDAgMjAwIDIwMCI+PHJlY3Qgd2lkdGg9IjIwMCIgaGVpZ2h0PSIyMDAiIGZpbGw9IiNmZmYiLz48cmVjdCB4PSIyMCIgeT0iMjAiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgZmlsbD0iIzMzMyIvPjxyZWN0IHg9IjE0MCIgeT0iMjAiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgZmlsbD0iIzMzMyIvPjxyZWN0IHg9IjIwIiB5PSIxNDAiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgZmlsbD0iIzMzMyIvPjx0ZXh0IHg9IjUwJSIgeT0iNTUlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LXNpemU9IjE0IiBmaWxsPSIjNjY2Ij5EZW1vIFdhbGxldDwvdGV4dD48dGV4dCB4PSI1MCUiIHk9IjY1JSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1zaXplPSIxMiIgZmlsbD0iIzk5OSI+VG9wLXVwIFFSPC90ZXh0Pjwvc3ZnPg==";
      qrText = `Demo Wallet Topup - ${amount}₮`;
      bankUrls = [
        { name: "Khan Bank", description: "Demo", logo: "", link: "#demo" },
        { name: "TDB", description: "Demo", logo: "", link: "#demo" },
      ];
    } else {
      // Production QPay
      let tokens = await getQPayToken(qpayUsername, qpayPassword);
      let accessToken = tokens.access_token;
      let refreshToken = tokens.refresh_token;

      const description = `OnlyCargo Түрийвч цэнэглэлт - ${amount.toLocaleString()}₮`;

      let qpayInvoice: QPayInvoiceResponse;
      try {
        qpayInvoice = await createQPayInvoice(
          accessToken,
          qpayInvoiceCode,
          senderInvoiceNo,
          user.id.substring(0, 20),
          description.substring(0, 255),
          amount,
          callbackUrl
        );
      } catch (error) {
        if (error instanceof Error && error.message === "TOKEN_EXPIRED") {
          const refreshedTokens = await refreshQPayToken(refreshToken);
          accessToken = refreshedTokens.access_token;
          
          qpayInvoice = await createQPayInvoice(
            accessToken,
            qpayInvoiceCode,
            senderInvoiceNo,
            user.id.substring(0, 20),
            description.substring(0, 255),
            amount,
            callbackUrl
          );
        } else {
          throw error;
        }
      }

      qpayInvoiceId = qpayInvoice.invoice_id;
      qrText = qpayInvoice.qr_text;
      bankUrls = qpayInvoice.urls || [];
      
      // Format QR image as data URL
      qrImage = qpayInvoice.qr_image;
      if (qrImage && !qrImage.startsWith('data:')) {
        qrImage = `data:image/png;base64,${qrImage}`;
      }
    }

    // Create wallet topup record
    const { data: topupRecord, error: topupError } = await supabase
      .from("wallet_topups")
      .insert({
        wallet_id: wallet.id,
        user_id: user.id,
        amount: amount,
        status: "pending",
        qpay_invoice_id: qpayInvoiceId,
        qpay_qr_text: qrText,
        qpay_qr_image: qrImage,
        qpay_urls: bankUrls,
        invoice_ref: senderInvoiceNo,
      })
      .select()
      .single();

    if (topupError) {
      console.error("[Wallet Topup] DB error:", topupError);
      throw new Error("Failed to create topup record");
    }

    console.log("[Wallet Topup] Created:", topupRecord.id);

    return new Response(
      JSON.stringify({
        success: true,
        demo_mode: isDemoMode,
        topup_id: topupRecord.id,
        qr_image: qrImage,
        qr_text: qrText,
        urls: bankUrls,
        invoice_id: qpayInvoiceId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error) {
    console.error("[Wallet Topup Error]", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
