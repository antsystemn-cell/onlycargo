import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const STOREPAY_BASE = "https://service.storepay.mn:8778";

// ─── Token cache ───
let cachedToken: string | null = null;
let tokenExpiresAt = 0;

function json(status: number, data: unknown) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

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
  const params = new URLSearchParams({
    grant_type: "password",
    username,
    password,
  });

  console.log("[Storepay] Requesting new token...");

  const resp = await fetch(`${STOREPAY_BASE}/merchant-uaa/oauth/token?${params.toString()}`, {
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

// ─── Actions ───

async function checkCredit(phone: string) {
  const token = await getStorepayToken();

  const resp = await fetch(`${STOREPAY_BASE}/lend-merchant/merchant/loan/check`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ mobileNumber: phone }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    console.error("[Storepay] Credit check error:", resp.status, errText);

    if (resp.status === 401) {
      // Token expired, clear cache and retry once
      cachedToken = null;
      tokenExpiresAt = 0;
      const newToken = await getStorepayToken();
      const retryResp = await fetch(`${STOREPAY_BASE}/lend-merchant/merchant/loan/check`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${newToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mobileNumber: phone }),
      });
      if (!retryResp.ok) {
        throw new Error("Storepay credit check failed");
      }
      return await retryResp.json();
    }
    throw new Error("Storepay credit check failed");
  }

  return await resp.json();
}

async function createLoan(
  phone: string,
  amount: number,
  description: string,
  callbackUrl: string,
  requestId: string,
) {
  const token = await getStorepayToken();
  const storeId = Deno.env.get("STOREPAY_STORE_ID") || "18735";

  const body = {
    storeId: parseInt(storeId),
    mobileNumber: phone,
    amount,
    description,
    callbackUrl,
    requestId,
  };

  console.log("[Storepay] Creating loan:", { phone, amount, requestId });

  const resp = await fetch(`${STOREPAY_BASE}/lend-merchant/merchant/loan`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    console.error("[Storepay] Loan creation error:", resp.status, errText);

    if (resp.status === 401) {
      cachedToken = null;
      tokenExpiresAt = 0;
      const newToken = await getStorepayToken();
      const retryResp = await fetch(`${STOREPAY_BASE}/lend-merchant/merchant/loan`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${newToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (!retryResp.ok) {
        const retryErr = await retryResp.text();
        console.error("[Storepay] Loan retry error:", retryErr);
        throw new Error("Storepay зээл үүсгэхэд алдаа");
      }
      return await retryResp.json();
    }

    throw new Error("Storepay зээл үүсгэхэд алдаа");
  }

  return await resp.json();
}

async function checkRequest(requestId: string) {
  const token = await getStorepayToken();

  const resp = await fetch(
    `${STOREPAY_BASE}/lend-merchant/merchant/loan/checkRequest/${requestId}`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    },
  );

  if (!resp.ok) {
    if (resp.status === 401) {
      cachedToken = null;
      tokenExpiresAt = 0;
      const newToken = await getStorepayToken();
      const retryResp = await fetch(
        `${STOREPAY_BASE}/lend-merchant/merchant/loan/checkRequest/${requestId}`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${newToken}` },
        },
      );
      if (!retryResp.ok) throw new Error("Storepay check failed");
      return await retryResp.json();
    }
    throw new Error("Storepay check failed");
  }

  return await resp.json();
}

// ─── Main handler ───

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Parse body safely
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
    if (action === "checkCredit") {
      const phone = body.phone as string;
      if (!phone || !/^[6-9]\d{7}$/.test(phone)) {
        return json(400, { success: false, error: "Утасны дугаар буруу (8 оронтой)" });
      }

      try {
        const result = await checkCredit(phone);
        console.log("[Storepay] Credit check result:", JSON.stringify(result));

        return json(200, {
          success: true,
          eligible: result?.eligible === true || result?.isActive === true,
          limit: result?.availableLimit || result?.limit || 0,
          data: result,
        });
      } catch (err) {
        console.error("[Storepay] Credit check error:", err);
        return json(200, {
          success: true,
          eligible: false,
          limit: 0,
          error: "Storepay-д бүртгэлгүй эсвэл зээлийн эрх хүрэлцэхгүй",
        });
      }
    }

    // ─── createInvoice (for cargo payments) ───
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
      const callbackUrl = `${supabaseUrl}/functions/v1/storepay?action=webhook`;

      const result = await createLoan(phone, amount, description, callbackUrl, requestId);
      console.log("[Storepay] Loan created:", JSON.stringify(result));

      const loanId = result?.loanId || result?.id || null;

      // Create payment record
      const { data: payment, error: paymentError } = await supabase
        .from("payments")
        .insert({
          user_id: user.id,
          amount,
          payment_method: "storepay",
          status: "pending",
          storepay_loan_id: loanId ? String(loanId) : null,
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

      // Link cargo items if provided
      if (cargoIds && cargoIds.length > 0) {
        const cargoLinks = cargoIds.map((cid) => ({
          payment_id: payment.id,
          cargo_id: cid,
        }));
        await supabase.from("payment_cargo").insert(cargoLinks);
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

      // Get/create wallet
      let { data: wallet } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!wallet) {
        const { data: newWallet, error: createErr } = await supabase
          .from("wallets")
          .insert({ user_id: user.id, balance: 0 })
          .select()
          .single();
        if (createErr) throw createErr;
        wallet = newWallet;
      }

      const requestId = crypto.randomUUID();
      const callbackUrl = `${supabaseUrl}/functions/v1/storepay?action=webhook`;

      const result = await createLoan(
        phone,
        amount,
        `OnlyCargo Хэтэвч цэнэглэлт - ${amount.toLocaleString()}₮`,
        callbackUrl,
        requestId,
      );

      const loanId = result?.loanId || result?.id || null;

      const { data: topup, error: topupError } = await supabase
        .from("wallet_topups")
        .insert({
          wallet_id: wallet.id,
          user_id: user.id,
          amount,
          status: "pending",
          provider: "storepay",
          storepay_loan_id: loanId ? String(loanId) : null,
          storepay_request_id: requestId,
          storepay_phone: phone,
          invoice_ref: requestId,
        })
        .select()
        .single();

      if (topupError) throw topupError;

      return json(200, {
        success: true,
        topup_id: topup.id,
        request_id: requestId,
        loan_id: loanId,
      });
    }

    // ─── checkPayment (cargo) ───
    if (action === "checkPayment") {
      const paymentId = body.payment_id as string;
      if (!paymentId) {
        return json(400, { success: false, error: "payment_id шаардлагатай" });
      }

      const { data: payment } = await supabase
        .from("payments")
        .select("*")
        .eq("id", paymentId)
        .single();

      if (!payment) return json(404, { success: false, error: "Төлбөр олдсонгүй" });
      if (payment.status === "paid") return json(200, { success: true, status: "completed" });
      if (!payment.storepay_request_id) return json(200, { success: true, status: "pending" });

      try {
        const result = await checkRequest(payment.storepay_request_id);
        console.log("[Storepay] Check payment result:", JSON.stringify(result));

        const isConfirmed =
          (result?.status === "success" || result?.status === "SUCCESS") &&
          result?.isConfirmed === true;

        if (isConfirmed) {
          await supabase
            .from("payments")
            .update({ status: "paid", paid_at: new Date().toISOString() })
            .eq("id", paymentId);

          // Update cargo status
          const { data: cargoLinks } = await supabase
            .from("payment_cargo")
            .select("cargo_id")
            .eq("payment_id", paymentId);

          if (cargoLinks && cargoLinks.length > 0) {
            const cargoIdsList = cargoLinks.map((c) => c.cargo_id);
            await supabase
              .from("cargo")
              .update({ payment_id: paymentId })
              .in("id", cargoIdsList);
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
      if (!topupId) {
        return json(400, { success: false, error: "topup_id шаардлагатай" });
      }

      const { data: topup } = await supabase
        .from("wallet_topups")
        .select("*")
        .eq("id", topupId)
        .single();

      if (!topup) return json(404, { success: false, error: "Цэнэглэлт олдсонгүй" });
      if (topup.status === "completed") return json(200, { success: true, status: "completed" });
      if (!topup.storepay_request_id) return json(200, { success: true, status: "pending" });

      try {
        const result = await checkRequest(topup.storepay_request_id);
        console.log("[Storepay] Check topup result:", JSON.stringify(result));

        const isConfirmed =
          (result?.status === "success" || result?.status === "SUCCESS") &&
          result?.isConfirmed === true;

        if (isConfirmed) {
          // Update topup
          await supabase
            .from("wallet_topups")
            .update({ status: "completed", paid_at: new Date().toISOString() })
            .eq("id", topupId);

          // Update wallet balance
          const { data: wallet } = await supabase
            .from("wallets")
            .select("*")
            .eq("id", topup.wallet_id)
            .single();

          if (wallet) {
            const newBalance = (wallet.balance || 0) + topup.amount;
            await supabase
              .from("wallets")
              .update({ balance: newBalance })
              .eq("id", wallet.id);

            // Record transaction
            await supabase.from("wallet_transactions").insert({
              wallet_id: wallet.id,
              user_id: topup.user_id,
              type: "topup",
              amount: topup.amount,
              balance_after: newBalance,
              reference_id: topupId,
              reference_type: "storepay_topup",
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

    // ─── webhook ───
    if (action === "webhook") {
      console.log("[Storepay] Webhook received:", JSON.stringify(body));

      const loanId = body.loanId as string;
      if (!loanId) {
        return json(200, { success: true, message: "No loanId" });
      }

      // Check payments table
      const { data: payment } = await supabase
        .from("payments")
        .select("*")
        .eq("storepay_loan_id", String(loanId))
        .maybeSingle();

      if (payment && payment.status !== "paid") {
        try {
          const result = await checkRequest(payment.storepay_request_id!);
          const isConfirmed =
            (result?.status === "success" || result?.status === "SUCCESS") &&
            result?.isConfirmed === true;

          if (isConfirmed) {
            await supabase
              .from("payments")
              .update({ status: "paid", paid_at: new Date().toISOString() })
              .eq("id", payment.id);

            const { data: cargoLinks } = await supabase
              .from("payment_cargo")
              .select("cargo_id")
              .eq("payment_id", payment.id);

            if (cargoLinks && cargoLinks.length > 0) {
              await supabase
                .from("cargo")
                .update({ payment_id: payment.id })
                .in("id", cargoLinks.map((c) => c.cargo_id));
            }
          }
        } catch (e) {
          console.error("[Storepay] Webhook verify error:", e);
        }
      }

      // Check wallet_topups table
      const { data: topup } = await supabase
        .from("wallet_topups")
        .select("*")
        .eq("storepay_loan_id", String(loanId))
        .maybeSingle();

      if (topup && topup.status !== "completed") {
        try {
          const result = await checkRequest(topup.storepay_request_id!);
          const isConfirmed =
            (result?.status === "success" || result?.status === "SUCCESS") &&
            result?.isConfirmed === true;

          if (isConfirmed) {
            await supabase
              .from("wallet_topups")
              .update({ status: "completed", paid_at: new Date().toISOString() })
              .eq("id", topup.id);

            const { data: wallet } = await supabase
              .from("wallets")
              .select("*")
              .eq("id", topup.wallet_id)
              .single();

            if (wallet) {
              const newBalance = (wallet.balance || 0) + topup.amount;
              await supabase.from("wallets").update({ balance: newBalance }).eq("id", wallet.id);
              await supabase.from("wallet_transactions").insert({
                wallet_id: wallet.id,
                user_id: topup.user_id,
                type: "topup",
                amount: topup.amount,
                balance_after: newBalance,
                reference_id: topup.id,
                reference_type: "storepay_topup",
                description: `Storepay цэнэглэлт - ${topup.amount.toLocaleString()}₮`,
              });
            }
          }
        } catch (e) {
          console.error("[Storepay] Webhook topup verify error:", e);
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
