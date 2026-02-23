import { useState, useEffect, useRef, useCallback } from "react";
import { CheckCircle, XCircle, Loader2, Phone, ShieldCheck, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatPrice } from "@/lib/priceCalculation";

interface StorepayPaymentProps {
  cargoIds: string[];
  totalAmount: number;
  userId: string;
  branchId: string | null;
  onSuccess?: () => void;
  onClose?: () => void;
}

type StorepayState =
  | "phone_input"
  | "checking_credit"
  | "credit_result"
  | "creating"
  | "pending"
  | "checking"
  | "completed"
  | "failed";

export default function StorepayPayment({
  cargoIds,
  totalAmount,
  userId,
  branchId,
  onSuccess,
  onClose,
}: StorepayPaymentProps) {
  const { toast } = useToast();
  const [phone, setPhone] = useState("");
  const [state, setState] = useState<StorepayState>("phone_input");
  const [creditEligible, setCreditEligible] = useState(false);
  const [creditLimit, setCreditLimit] = useState(0);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const autoCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (autoCheckRef.current) clearInterval(autoCheckRef.current);
    };
  }, []);

  // Auto-polling when pending
  useEffect(() => {
    if (state !== "pending" || !paymentId) {
      if (autoCheckRef.current) {
        clearInterval(autoCheckRef.current);
        autoCheckRef.current = null;
      }
      return;
    }
    autoCheckRef.current = setInterval(() => {
      checkPaymentStatus(true);
    }, 5000);
    return () => {
      if (autoCheckRef.current) clearInterval(autoCheckRef.current);
    };
  }, [state, paymentId]);

  const callStorepay = async (body: Record<string, unknown>) => {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    if (!token) throw new Error("Нэвтэрнэ үү");

    const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/storepay`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    const result = await resp.json();
    if (!resp.ok || result.success === false) {
      throw new Error(result.error || "Storepay алдаа");
    }
    return result;
  };

  const handleCheckCredit = async () => {
    if (!phone || !/^[6-9]\d{7}$/.test(phone)) {
      toast({ title: "Утасны дугаараа зөв оруулна уу (8 оронтой)", variant: "destructive" });
      return;
    }
    setState("checking_credit");
    setErrorMessage(null);

    try {
      const result = await callStorepay({ action: "checkCredit", phone });
      setCreditEligible(result.eligible);
      setCreditLimit(result.limit || 0);
      setState("credit_result");

      if (!result.eligible) {
        setErrorMessage(result.error || "Зээлийн эрх хүрэлцэхгүй эсвэл бүртгэлгүй");
      }
    } catch (err) {
      console.error("Credit check error:", err);
      setState("credit_result");
      setCreditEligible(false);
      setErrorMessage(err instanceof Error ? err.message : "Алдаа гарлаа");
    }
  };

  const handleCreateInvoice = async () => {
    setState("creating");
    setErrorMessage(null);

    try {
      const result = await callStorepay({
        action: "createInvoice",
        phone,
        amount: totalAmount,
        description: `OnlyCargo - ${cargoIds.length} ачаа төлбөр`,
        cargo_ids: cargoIds,
      });

      setPaymentId(result.payment_id);
      setRequestId(result.request_id);
      setState("pending");
      toast({ title: "Storepay нэхэмжлэл илгээгдлээ" });
    } catch (err) {
      console.error("Invoice creation error:", err);
      setState("credit_result");
      setErrorMessage(err instanceof Error ? err.message : "Нэхэмжлэх үүсгэхэд алдаа");
      toast({ title: "Алдаа гарлаа", variant: "destructive" });
    }
  };

  const checkPaymentStatus = useCallback(
    async (isAutoCheck = false) => {
      if (!paymentId) return;
      if (!isAutoCheck) setState("checking");

      try {
        const result = await callStorepay({
          action: "checkPayment",
          payment_id: paymentId,
        });

        if (result.status === "completed") {
          setState("completed");
          toast({ title: "Төлбөр амжилттай!", description: "Storepay-ээр төлөгдлөө" });
          onSuccess?.();
        } else if (result.status === "failed") {
          setState("failed");
        } else if (!isAutoCheck) {
          setState("pending");
        }
      } catch (err) {
        console.error("Status check error:", err);
        if (!isAutoCheck) setState("pending");
      }
    },
    [paymentId, toast, onSuccess],
  );

  return (
    <div className="space-y-4">
      {errorMessage && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      {/* Amount summary */}
      <Card>
        <CardContent className="p-4">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Нийт дүн:</span>
            <span className="text-xl font-bold text-primary">{formatPrice(totalAmount)}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{cargoIds.length} ачаа сонгогдсон • Storepay зээл</p>
        </CardContent>
      </Card>

      {/* Step 1: Phone input */}
      {state === "phone_input" && (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Phone className="h-4 w-4" />
              Storepay утасны дугаар
            </Label>
            <Input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 8))}
              placeholder="99112233"
              maxLength={8}
              inputMode="numeric"
            />
            <p className="text-xs text-muted-foreground">Storepay-д бүртгэлтэй утасны дугаараа оруулна уу</p>
          </div>
          <Button onClick={handleCheckCredit} className="w-full" disabled={phone.length !== 8}>
            <ShieldCheck className="mr-2 h-4 w-4" />
            Зээлийн эрх шалгах
          </Button>
        </div>
      )}

      {/* Checking credit */}
      {state === "checking_credit" && (
        <div className="flex flex-col items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="mt-2 text-sm text-muted-foreground">Зээлийн эрх шалгаж байна...</p>
        </div>
      )}

      {/* Credit result */}
      {state === "credit_result" && (
        <div className="space-y-3">
          {creditEligible ? (
            <Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-900/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="font-medium text-green-700 dark:text-green-400">Зээлийн эрх бий</span>
                </div>
                <p className="text-sm text-green-600 dark:text-green-500">Боломжит лимит: {formatPrice(creditLimit)}</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-900/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-red-500" />
                  <span className="font-medium text-red-700 dark:text-red-400">Зээлийн эрх хүрэлцэхгүй</span>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setState("phone_input");
                setErrorMessage(null);
              }}
            >
              Буцах
            </Button>
            {creditEligible && (
              <Button className="flex-1" onClick={handleCreateInvoice}>
                Нэхэмжлэх илгээх
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Creating */}
      {state === "creating" && (
        <div className="flex flex-col items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="mt-2 text-sm text-muted-foreground">Нэхэмжлэх үүсгэж байна...</p>
        </div>
      )}

      {/* Pending */}
      {(state === "pending" || state === "checking") && (
        <div className="space-y-3">
          <Card className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-900/20">
            <CardContent className="p-4 text-center">
              <CheckCircle className="mx-auto h-10 w-10 text-blue-500 mb-2" />
              <p className="font-medium text-blue-700 dark:text-blue-400">Нэхэмжлэл илгээгдлээ</p>
              <p className="text-sm text-blue-600 dark:text-blue-500 mt-1">
                Storepay апп-аас төлбөрөө баталгаажуулна уу
              </p>
            </CardContent>
          </Card>

          <Button
            onClick={() => checkPaymentStatus(false)}
            variant="outline"
            className="w-full"
            disabled={state === "checking"}
          >
            {state === "checking" ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Шалгаж байна...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Төлөв шалгах
              </>
            )}
          </Button>
          <p className="text-xs text-center text-muted-foreground">5 секунд тутамд автоматаар шалгана</p>
        </div>
      )}

      {/* Completed */}
      {state === "completed" && (
        <Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-900/20">
          <CardContent className="p-4 text-center">
            <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-2" />
            <p className="font-medium text-green-700 dark:text-green-400">Төлбөр амжилттай!</p>
            <p className="text-sm text-green-600 dark:text-green-500 mt-1">Storepay-ээр төлөгдлөө</p>
          </CardContent>
        </Card>
      )}

      {/* Failed */}
      {state === "failed" && (
        <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-900/20">
          <CardContent className="p-4 text-center">
            <XCircle className="mx-auto h-12 w-12 text-red-500 mb-2" />
            <p className="font-medium text-red-700 dark:text-red-400">Төлбөр амжилтгүй</p>
            <Button
              onClick={() => {
                setState("phone_input");
                setPaymentId(null);
                setRequestId(null);
                setErrorMessage(null);
              }}
              variant="outline"
              className="mt-4"
            >
              Дахин оролдох
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
