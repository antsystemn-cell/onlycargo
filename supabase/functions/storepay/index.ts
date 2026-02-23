import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// API doc: BASE_URL = https://service.storepay.mn:8778/lend-merchant/
const STOREPAY_BASE = "https://service.storepay.mn:8778";
const LEND_BASE = `${STOREPAY_BASE}/lend-merchant`;

// ─── Token cache ───
let cachedToken: string | null = null;
let tokenExpiresAt = 0;

function json(status: number, data: unknown) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ─── 1. OAuth2 Token ───
// POST https://service.storepay.mn:8778/merchant-uaa/oauth/token?grant_type=password&username={}&password={}
// Authorization: Basic base64(app_username:app_password)
async function getStorepayToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt - 30_000) {
    return cachedToken;
  }

  const clientId = Deno.env.get("STOREPAY_CLIENT_ID");
  const clientSecret = Deno.env.get("STOREPAY_CLIENT_SECRET");
  const username = Deno.env.get("STOREPAY_USERNAME");
  const password = Deno.env.get("STOREPAY_PASSWORD");

  if (!clientId || !clientSecret || !username || !password) {
    throw new Error("Storepay credentials not configured");
  }

  const basicAuth = btoa(`${clientId}:${clientSecret}`);
  const params = new URLSearchParams({ grant_type: "password", username, password });
  const url = `${STOREPAY_BASE}/merchant-uaa/oauth/token?${params.toString()}`;

  console.log("[Storepay] Requesting token...", url);

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  if (!resp.ok) {
    const errText = await resp.text();
    console.error("[Storepay] Token error:", resp.status, errText);
    throw new Error(`Storepay auth failed (${resp.status})`);
  }

  const tokenData = await resp.json();
  cachedToken = tokenData.access_token;
  tokenExpiresAt = now + (tokenData.expires_in || 3600) * 1000;
  console.log("[Storepay] Token obtained, expires in", tokenData.expires_in, "s");
  return cachedToken!;
}

// Helper: fetch with auto 401 retry
async function storepayFetch(url: string, options: RequestInit): Promise<Response> {
  let token = await getStorepayToken();
  const headers = { ...options.headers as Record<string, string>, Authorization: `Bearer ${token}` };
  
  let resp = await fetch(url, { ...options, headers });
  
  if (resp.status === 401) {
    console.log("[Storepay] 401 received, refreshing token...");
    cachedToken = null;
    tokenExpiresAt = 0;
    token = await getStorepayToken();
    headers.Authorization = `Bearer ${token}`;
    resp = await fetch(url, { ...options, headers });
  }
  
  return resp;
}

// ─── 5. Credit check (possibleAmount) ───
// POST /user/possibleAmount  body: { mobileNumber: "99112233" }
// Response: { value: 500000.0, msgList: [], attrs: {}, status: "Success" }
// value = 0 means no credit
async function checkCredit(phone: string) {
  const url = `${LEND_BASE}/user/possibleAmount`;
  console.log("[Storepay] Credit check:", url, "phone:", phone);

  const resp = await storepayFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mobileNumber: phone }),
  });

  const respText = await resp.text();
  console.log("[Storepay] Credit check response:", resp.status, respText);

  if (!resp.ok) {
    throw new Error(`Credit check failed (${resp.status}): ${respText}`);
  }

  try {
    return JSON.parse(respText);
  } catch {
    throw new Error(`Invalid credit check response: ${respText}`);
  }
}

// ─── 2. Create loan ───
// POST /merchant/loan
// Body: { storeId, mobileNumber, description, amount, callbackUrl, requestId }
// Response success: { value: 9272, msgList: [], attrs: {}, status: "Success" }
// Response fail: { value: null, msgList: [...], attrs: {}, status: "Failed" }
async function createLoan(
  phone: string,
  amount: number,
  description: string,
  callbackUrl: string,
  requestId: string,
) {
  const storeId = Deno.env.get("STOREPAY_STORE_ID") || "18735";
  const url = `${LEND_BASE}/merchant/loan`;

  const payload = {
    storeId: parseInt(storeId),
    mobileNumber: phone,
    amount,
    description,
    callbackUrl,
    requestId,
  };

  console.log("[Storepay] Creating loan:", JSON.stringify(payload));

  const resp = await storepayFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const respText = await resp.text();
  console.log("[Storepay] Loan response:", resp.status, respText);

  if (!resp.ok) {
    throw new Error(`Loan creation failed (${resp.status}): ${respText}`);
  }

  const result = JSON.parse(respText);

  // API returns status: "Failed" with msgList on error
  if (result.status === "Failed") {
    const msg = result.msgList?.[0]?.code || result.msgList?.[0]?.text || "Нэхэмжлэл үүсгэхэд алдаа";
    throw new Error(msg);
  }

  return result;
}

// ─── 3. Check loan by loanId ───
// GET /merchant/loan/check/{loanId}
// Response: { value: true/false, msgList: [], attrs: {}, status: "Success" }
async function checkLoanById(loanId: string) {
  const url = `${LEND_BASE}/merchant/loan/check/${loanId}`;
  console.log("[Storepay] Check loan by ID:", url);

  const resp = await storepayFetch(url, { method: "GET", headers: {} });
  const respText = await resp.text();
  console.log("[Storepay] Check loan response:", resp.status, respText);

  if (!resp.ok) {
    throw new Error(`Check loan failed (${resp.status})`);
  }

  return JSON.parse(respText);
}

// ─── 4. Check loan by requestId ───
// GET /merchant/loan/checkRequest/{requestId}
// Response: { value: { loanId, isExist, isConfirmed }, msgList: [], attrs: {}, status: "Success" }
async function checkByRequestId(requestId: string) {
  const url = `${LEND_BASE}/merchant/loan/checkRequest/${requestId}`;
  console.log("[Storepay] Check by requestId:", url);

  const resp = await storepayFetch(url, { method: "GET", headers: {} });
  const respText = await resp.text();
  console.log("[Storepay] Check requestId response:", resp.status, respText);

  if (!resp.ok) {
    throw new Error(`Check request failed (${resp.status})`);
  }

  return JSON.parse(respText);
}

// ─── Main handler ───
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return json(400, { success: false, error: "JSON өгөгдөл буруу байна" });
    }

    const action = body?.action as string;
    if (!action) {
      return json(400, { success: false, error: "action шаардлагатай" });
    }

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json(401, { success: false, error: "Нэвтэрнэ үү" });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (authError || !user) {
      return json(401, { success: false, error: "Нэвтэрнэ үү" });
    }

    // ─── checkCredit ───
    // API 5: POST /user/possibleAmount → { value: amount, status: "Success" }
    if (action === "checkCredit") {
      const phone = body.phone as string;
      if (!phone || !/^[6-9]\d{7}$/.test(phone)) {
        return json(400, { success: false, error: "Утасны дугаар буруу (8 оронтой)" });
      }

      try {
        const result = await checkCredit(phone);
        console.log("[Storepay] Credit result:", JSON.stringify(result));

        // value = available credit amount, 0 = no credit
        const availableAmount = typeof result?.value === "number" ? result.value : 0;
        const isEligible = availableAmount > 0 && result?.status === "Success";

        return json(200, {
          success: true,
          eligible: isEligible,
          limit: availableAmount,
          data: result,
        });
      } catch (err) {
        console.error("[Storepay] Credit check error:", err);
        return json(200, {
          success: true,
          eligible: false,
          limit: 0,
          error: err instanceof Error ? err.message : "Storepay шалгахад алдаа гарлаа",
        });
      }
    }

    // ─── createInvoice (cargo payments) ───
    // API 2: POST /merchant/loan → { value: loanId, status: "Success" }
    if (action === "createInvoice") {
      const phone = body.phone as string;
      const amount = Number(body.amount);
      const description = (body.description as string) || "Cargo payment";
      const cargoIds = body.cargo_ids as string[] | undefined;

      if (!phone || !/^[6-9]\d{7}$/.test(phone)) {
        return json(400, { success: false, error: "Утасны дугаар буруу" });
      }
      if (!amount || amount <= 0) {
        return json(400, { success: false, error: "Дүн буруу" });
      }

      const requestId = crypto.randomUUID();
      const callbackUrl = `${supabaseUrl}/functions/v1/storepay`;

      const result = await createLoan(phone, amount, description, callbackUrl, requestId);
      const loanId = result?.value ? String(result.value) : null;

      const { data: payment, error: paymentError } = await supabase
        .from("payments")
        .insert({
          user_id: user.id,
          amount,
          payment_method: "storepay",
          status: "pending",
          storepay_loan_id: loanId,
          storepay_request_id: requestId,
          storepay_phone: phone,
          notes: description,
        })
        .select()
        .single();

      if (paymentError) {
        console.error("[Storepay] Payment record error:", paymentError);
        throw new Error("Төлбөрийн бүртгэл үүсгэхэд алдаа");
      }

      if (cargoIds && cargoIds.length > 0) {
        await supabase.from("payment_cargo").insert(
          cargoIds.map((cid) => ({ payment_id: payment.id, cargo_id: cid })),
        );
      }

      return json(200, {
        success: true,
        payment_id: payment.id,
        request_id: requestId,
        loan_id: loanId,
      });
    }

    // ─── createWalletTopup ───
    if (action === "createWalletTopup") {
      const phone = body.phone as string;
      const amount = Number(body.amount);

      if (!phone || !/^[6-9]\d{7}$/.test(phone)) {
        return json(400, { success: false, error: "Утасны дугаар буруу" });
      }
      if (!amount || amount < 1000) {
        return json(400, { success: false, error: "Хамгийн багадаа 1,000₮" });
      }

      let { data: wallet } = await supabase
        .from("wallets").select("*").eq("user_id", user.id).maybeSingle();

      if (!wallet) {
        const { data: newWallet, error: createErr } = await supabase
          .from("wallets").insert({ user_id: user.id, balance: 0 }).select().single();
        if (createErr) throw createErr;
        wallet = newWallet;
      }

      const requestId = crypto.randomUUID();
      const callbackUrl = `${supabaseUrl}/functions/v1/storepay`;

      const result = await createLoan(
        phone, amount,
        `OnlyCargo Хэтэвч цэнэглэлт - ${amount.toLocaleString()}₮`,
        callbackUrl, requestId,
      );
      const loanId = result?.value ? String(result.value) : null;

      const { data: topup, error: topupError } = await supabase
        .from("wallet_topups")
        .insert({
          wallet_id: wallet.id, user_id: user.id, amount,
          status: "pending", provider: "storepay",
          storepay_loan_id: loanId, storepay_request_id: requestId,
          storepay_phone: phone, invoice_ref: requestId,
        })
        .select().single();

      if (topupError) throw topupError;

      return json(200, {
        success: true, topup_id: topup.id,
        request_id: requestId, loan_id: loanId,
      });
    }

    // ─── checkPayment (cargo) ───
    // Uses API 4: checkRequest/{requestId} or API 3: check/{loanId}
    if (action === "checkPayment") {
      const paymentId = body.payment_id as string;
      if (!paymentId) return json(400, { success: false, error: "payment_id шаардлагатай" });

      const { data: payment } = await supabase
        .from("payments").select("*").eq("id", paymentId).single();

      if (!payment) return json(404, { success: false, error: "Төлбөр олдсонгүй" });
      if (payment.status === "paid") return json(200, { success: true, status: "completed" });

      try {
        let isConfirmed = false;

        if (payment.storepay_request_id) {
          // API 4: check by requestId
          const result = await checkByRequestId(payment.storepay_request_id);
          isConfirmed = result?.status === "Success" && result?.value?.isConfirmed === true;
          
          // Save loanId if we got it
          if (result?.value?.loanId && !payment.storepay_loan_id) {
            await supabase.from("payments")
              .update({ storepay_loan_id: String(result.value.loanId) })
              .eq("id", paymentId);
          }
        } else if (payment.storepay_loan_id) {
          // API 3: check by loanId
          const result = await checkLoanById(payment.storepay_loan_id);
          isConfirmed = result?.status === "Success" && result?.value === true;
        }

        if (isConfirmed) {
          await supabase.from("payments")
            .update({ status: "paid", paid_at: new Date().toISOString() })
            .eq("id", paymentId);

          const { data: cargoLinks } = await supabase
            .from("payment_cargo").select("cargo_id").eq("payment_id", paymentId);

          if (cargoLinks && cargoLinks.length > 0) {
            await supabase.from("cargo")
              .update({ payment_id: paymentId })
              .in("id", cargoLinks.map((c) => c.cargo_id));
          }

          return json(200, { success: true, status: "completed" });
        }

        return json(200, { success: true, status: "pending" });
      } catch (err) {
        console.error("[Storepay] Check error:", err);
        return json(200, { success: true, status: "pending" });
      }
    }

    // ─── checkTopup (wallet) ───
    if (action === "checkTopup") {
      const topupId = body.topup_id as string;
      if (!topupId) return json(400, { success: false, error: "topup_id шаардлагатай" });

      const { data: topup } = await supabase
        .from("wallet_topups").select("*").eq("id", topupId).single();

      if (!topup) return json(404, { success: false, error: "Цэнэглэлт олдсонгүй" });
      if (topup.status === "completed") return json(200, { success: true, status: "completed" });

      try {
        let isConfirmed = false;

        if (topup.storepay_request_id) {
          const result = await checkByRequestId(topup.storepay_request_id);
          isConfirmed = result?.status === "Success" && result?.value?.isConfirmed === true;

          if (result?.value?.loanId && !topup.storepay_loan_id) {
            await supabase.from("wallet_topups")
              .update({ storepay_loan_id: String(result.value.loanId) })
              .eq("id", topupId);
          }
        } else if (topup.storepay_loan_id) {
          const result = await checkLoanById(topup.storepay_loan_id);
          isConfirmed = result?.status === "Success" && result?.value === true;
        }

        if (isConfirmed) {
          await supabase.from("wallet_topups")
            .update({ status: "completed", paid_at: new Date().toISOString() })
            .eq("id", topupId);

          const { data: wallet } = await supabase
            .from("wallets").select("*").eq("id", topup.wallet_id).single();

          if (wallet) {
            const newBalance = (wallet.balance || 0) + topup.amount;
            await supabase.from("wallets").update({ balance: newBalance }).eq("id", wallet.id);
            await supabase.from("wallet_transactions").insert({
              wallet_id: wallet.id, user_id: topup.user_id,
              type: "topup", amount: topup.amount, balance_after: newBalance,
              reference_id: topupId, reference_type: "storepay_topup",
              description: `Storepay цэнэглэлт - ${topup.amount.toLocaleString()}₮`,
            });
          }

          return json(200, { success: true, status: "completed" });
        }

        return json(200, { success: true, status: "pending" });
      } catch (err) {
        console.error("[Storepay] Check topup error:", err);
        return json(200, { success: true, status: "pending" });
      }
    }

    // ─── webhook (callback from Storepay) ───
    // Storepay calls: callbackUrl?id={loanId}
    if (action === "webhook") {
      console.log("[Storepay] Webhook received:", JSON.stringify(body));

      // Storepay sends loanId via query param "id" or in body
      const loanId = (body.id || body.loanId) as string;
      if (!loanId) return json(200, { success: true, message: "No loanId" });

      // Verify via API 3
      try {
        const checkResult = await checkLoanById(String(loanId));
        const isConfirmed = checkResult?.status === "Success" && checkResult?.value === true;

        if (!isConfirmed) {
          return json(200, { success: true, message: "Not confirmed yet" });
        }
      } catch (e) {
        console.error("[Storepay] Webhook verify error:", e);
        return json(200, { success: true, message: "Verify failed" });
      }

      // Check payments table
      const { data: payment } = await supabase
        .from("payments").select("*")
        .eq("storepay_loan_id", String(loanId)).maybeSingle();

      if (payment && payment.status !== "paid") {
        await supabase.from("payments")
          .update({ status: "paid", paid_at: new Date().toISOString() })
          .eq("id", payment.id);

        const { data: cargoLinks } = await supabase
          .from("payment_cargo").select("cargo_id").eq("payment_id", payment.id);

        if (cargoLinks && cargoLinks.length > 0) {
          await supabase.from("cargo")
            .update({ payment_id: payment.id })
            .in("id", cargoLinks.map((c) => c.cargo_id));
        }
      }

      // Check wallet_topups table
      const { data: topup } = await supabase
        .from("wallet_topups").select("*")
        .eq("storepay_loan_id", String(loanId)).maybeSingle();

      if (topup && topup.status !== "completed") {
        await supabase.from("wallet_topups")
          .update({ status: "completed", paid_at: new Date().toISOString() })
          .eq("id", topup.id);

        const { data: wallet } = await supabase
          .from("wallets").select("*").eq("id", topup.wallet_id).single();

        if (wallet) {
          const newBalance = (wallet.balance || 0) + topup.amount;
          await supabase.from("wallets").update({ balance: newBalance }).eq("id", wallet.id);
          await supabase.from("wallet_transactions").insert({
            wallet_id: wallet.id, user_id: topup.user_id,
            type: "topup", amount: topup.amount, balance_after: newBalance,
            reference_id: topup.id, reference_type: "storepay_topup",
            description: `Storepay цэнэглэлт - ${topup.amount.toLocaleString()}₮`,
          });
        }
      }

      return json(200, { success: true, message: "Webhook processed" });
    }

    return json(400, { success: false, error: `Unknown action: ${action}` });
  } catch (err) {
    console.error("[Storepay] Fatal error:", err);
    return json(500, {
      success: false,
      error: err instanceof Error ? err.message : "Дотоод алдаа гарлаа",
    });
  }
});
