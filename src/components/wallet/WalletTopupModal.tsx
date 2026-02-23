import { useState, useEffect, useRef } from "react";
import {
  QrCode,
  RefreshCw,
  CheckCircle,
  XCircle,
  Smartphone,
  AlertTriangle,
  Loader2,
  Wallet,
  CreditCard,
  Phone,
  ShieldCheck,
  Banknote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatPrice } from "@/lib/priceCalculation";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSiteSettings } from "@/hooks/useSiteSettings";

interface WalletTopupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface QPayBankApp {
  name: string;
  description: string;
  logo: string;
  link: string;
}

interface TopupRecord {
  id: string;
  provider: "qpay" | "omniway";
  // QPay fields
  qpay_qr_image?: string;
  qpay_urls?: QPayBankApp[];
  // OmniWay fields
  omniway_image_base64?: string;
  omniway_qr_content?: string;
}

type TopupState = "input" | "provider_select" | "creating" | "pending" | "checking" | "completed" | "failed" | "storepay_phone" | "storepay_credit_check" | "storepay_credit_result" | "storepay_creating" | "storepay_pending" | "storepay_checking";
type PaymentProvider = "qpay" | "omniway" | "storepay";

export function WalletTopupModal({ open, onOpenChange, onSuccess }: WalletTopupModalProps) {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { paymentIcons } = useSiteSettings();
  const [amount, setAmount] = useState("");
  const [topupState, setTopupState] = useState<TopupState>("input");
  const [topupRecord, setTopupRecord] = useState<TopupRecord | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<PaymentProvider | null>(null);
  const autoCheckRef = useRef<NodeJS.Timeout | null>(null);
  // Storepay-specific state
  const [storepayPhone, setStorepayPhone] = useState("");
  const [storepayEligible, setStorepayEligible] = useState(false);
  const [storepayLimit, setStorepayLimit] = useState(0);
  const [storepayTopupId, setStorepayTopupId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setAmount("");
      setTopupState("input");
      setTopupRecord(null);
      setErrorMessage(null);
      setIsDemoMode(false);
      setSelectedProvider(null);
      setStorepayPhone("");
      setStorepayEligible(false);
      setStorepayLimit(0);
      setStorepayTopupId(null);
    }
    return () => {
      if (autoCheckRef.current) clearInterval(autoCheckRef.current);
    };
  }, [open]);

  useEffect(() => {
    if (topupState !== "pending" && topupState !== "storepay_pending") {
      if (autoCheckRef.current) {
        clearInterval(autoCheckRef.current);
        autoCheckRef.current = null;
      }
      return;
    }
    const interval = topupState === "storepay_pending" ? 5000 : 10000;
    autoCheckRef.current = setInterval(() => {
      if (topupState === "storepay_pending") {
        checkStorepayTopupStatus(true);
      } else {
        checkTopupStatus(true);
      }
    }, interval);
    return () => {
      if (autoCheckRef.current) clearInterval(autoCheckRef.current);
    };
  }, [topupState, topupRecord, storepayTopupId]);

  const proceedToProviderSelect = () => {
    const amountNum = parseInt(amount);
    if (!amountNum || amountNum < 1000) {
      toast({ title: "Хамгийн багадаа 1,000₮", variant: "destructive" });
      return;
    }
    setTopupState("provider_select");
  };

  const createTopup = async (provider: PaymentProvider) => {
    setSelectedProvider(provider);
    setTopupState("creating");
    setErrorMessage(null);

    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) throw new Error("Нэвтэрнэ үү");

      const amountNum = parseInt(amount);

      if (provider === "qpay") {
        await createQPayTopup(token, amountNum);
      } else if (provider === "omniway") {
        await createOmniWayTopup(token, amountNum);
      } else if (provider === "storepay") {
        setTopupState("storepay_phone");
        return; // Storepay needs phone input first
      }
    } catch (error) {
      console.error("Topup creation error:", error);
      setTopupState("provider_select");
      setErrorMessage(error instanceof Error ? error.message : "Алдаа гарлаа");
      toast({ title: "Нэхэмжлэх үүсгэхэд алдаа гарлаа", variant: "destructive" });
    }
  };

  const createQPayTopup = async (token: string, amountNum: number) => {
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/qpay-wallet-topup`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ amount: amountNum }),
    });
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.error || "QPay нэхэмжлэх үүсгэхэд алдаа");

    setIsDemoMode(result.demo_mode || false);
    setTopupRecord({
      id: result.topup_id,
      provider: "qpay",
      qpay_qr_image: result.qr_image,
      qpay_urls: result.urls || [],
    });
    setTopupState("pending");
    toast({ title: "QPay нэхэмжлэх үүсгэгдлээ" });
  };

  const createOmniWayTopup = async (token: string, amountNum: number) => {
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/omniway-wallet-topup`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ amount: amountNum }),
    });
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.error || "OmniWay нэхэмжлэх үүсгэхэд алдаа");

    setTopupRecord({
      id: result.topup_id,
      provider: "omniway",
      omniway_image_base64: result.image_base64,
      omniway_qr_content: result.qr_content,
    });
    setTopupState("pending");
    toast({ title: "OmniWay нэхэмжлэх үүсгэгдлээ" });
  };

  const checkTopupStatus = async (isAutoCheck = false) => {
    if (!topupRecord) return;
    if (!isAutoCheck) setTopupState("checking");

    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) return;

      const endpoint = topupRecord.provider === "omniway" ? "omniway-wallet-check" : "qpay-wallet-check";

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ topup_id: topupRecord.id }),
      });
      const result = await response.json();

      if (result.status === "completed") {
        setTopupState("completed");
        toast({ title: "Цэнэглэлт амжилттай!", description: "Хэтэвч цэнэглэгдлээ" });
        onSuccess?.();
      } else if (result.status === "failed") {
        setTopupState("failed");
        toast({ title: "Цэнэглэлт амжилтгүй", variant: "destructive" });
      } else if (!isAutoCheck) {
        setTopupState("pending");
      }
    } catch (error) {
      console.error("Status check error:", error);
      if (!isAutoCheck) setTopupState("pending");
    }
  };

  // ─── Storepay functions ───
  const callStorepayFn = async (body: Record<string, unknown>) => {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    if (!token) throw new Error("Нэвтэрнэ үү");
    const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/storepay`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const result = await resp.json();
    if (!resp.ok || result.success === false) throw new Error(result.error || "Storepay алдаа");
    return result;
  };

  const handleStorepayCheckCredit = async () => {
    if (!storepayPhone || !/^[6-9]\d{7}$/.test(storepayPhone)) {
      toast({ title: "Утасны дугаараа зөв оруулна уу", variant: "destructive" });
      return;
    }
    setTopupState("storepay_credit_check");
    setErrorMessage(null);
    try {
      const result = await callStorepayFn({ action: "checkCredit", phone: storepayPhone });
      setStorepayEligible(result.eligible);
      setStorepayLimit(result.limit || 0);
      setTopupState("storepay_credit_result");
      if (!result.eligible) setErrorMessage(result.error || "Зээлийн эрх хүрэлцэхгүй");
    } catch (err) {
      setTopupState("storepay_credit_result");
      setStorepayEligible(false);
      setErrorMessage(err instanceof Error ? err.message : "Алдаа гарлаа");
    }
  };

  const handleStorepayCreateTopup = async () => {
    setTopupState("storepay_creating");
    setErrorMessage(null);
    try {
      const result = await callStorepayFn({
        action: "createWalletTopup",
        phone: storepayPhone,
        amount: parseInt(amount),
      });
      setStorepayTopupId(result.topup_id);
      setTopupState("storepay_pending");
      toast({ title: "Storepay нэхэмжлэл илгээгдлээ" });
    } catch (err) {
      setTopupState("storepay_credit_result");
      setErrorMessage(err instanceof Error ? err.message : "Алдаа гарлаа");
    }
  };

  const checkStorepayTopupStatus = async (isAutoCheck = false) => {
    if (!storepayTopupId) return;
    if (!isAutoCheck) setTopupState("storepay_checking");
    try {
      const result = await callStorepayFn({ action: "checkTopup", topup_id: storepayTopupId });
      if (result.status === "completed") {
        setTopupState("completed");
        toast({ title: "Цэнэглэлт амжилттай!", description: "Storepay зээлээр цэнэглэгдлээ" });
        onSuccess?.();
      } else if (!isAutoCheck) {
        setTopupState("storepay_pending");
      }
    } catch {
      if (!isAutoCheck) setTopupState("storepay_pending");
    }
  };

  const quickAmounts = [5000, 10000, 20000, 50000, 100000];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Хэтэвч цэнэглэх
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto flex-1 pr-1">
          {isDemoMode && (
            <Alert
              variant="default"
              className="border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-900/20"
            >
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-700 dark:text-yellow-400">
                Демо горим - QPay холболт тохируулаагүй
              </AlertDescription>
            </Alert>
          )}

          {errorMessage && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          {/* Step 1: Amount input */}
          {topupState === "input" && (
            <>
              <div className="space-y-2">
                <Label>Цэнэглэх дүн (₮)</Label>
                <Input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="10000"
                  min="1000"
                  step="1000"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {quickAmounts.map((amt) => (
                  <Button
                    key={amt}
                    variant={amount === String(amt) ? "default" : "outline"}
                    size="sm"
                    onClick={() => setAmount(String(amt))}
                  >
                    {formatPrice(amt)}
                  </Button>
                ))}
              </div>
              <Button
                onClick={proceedToProviderSelect}
                className="w-full"
                disabled={!amount || parseInt(amount) < 1000}
              >
                Үргэлжлүүлэх
              </Button>
            </>
          )}

          {/* Step 2: Provider selection */}
          {topupState === "provider_select" && (
            <>
              <Card>
                <CardContent className="p-4">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Цэнэглэх дүн:</span>
                    <span className="text-xl font-bold text-primary">{formatPrice(parseInt(amount))}</span>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-2">
                <Label>Төлбөрийн хэрэгсэл сонгох</Label>
                <div className="space-y-3">
                  <button
                    onClick={() => createTopup("qpay")}
                    className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-border hover:border-primary hover:bg-accent transition-all text-left"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30 overflow-hidden">
                      {paymentIcons.qpay_icon_url ? (
                        <img src={paymentIcons.qpay_icon_url} alt="QPay" className="h-8 w-8 object-contain" />
                      ) : (
                        <QrCode className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold">QPay</p>
                      <p className="text-sm text-muted-foreground">Банкны аппаар QR уншуулж төлөх</p>
                    </div>
                  </button>

                  <button
                    onClick={() => createTopup("omniway")}
                    className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-border hover:border-primary hover:bg-accent transition-all text-left"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30 overflow-hidden">
                      {paymentIcons.omniway_icon_url ? (
                        <img src={paymentIcons.omniway_icon_url} alt="OmniWay" className="h-8 w-8 object-contain" />
                      ) : (
                        <CreditCard className="h-6 w-6 text-green-600 dark:text-green-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold">OmniWay</p>
                      <p className="text-sm text-muted-foreground">OmniWay аппаар QR уншуулж төлөх</p>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setSelectedProvider("storepay");
                      setTopupState("storepay_phone");
                    }}
                    className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-border hover:border-primary hover:bg-accent transition-all text-left"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/30 overflow-hidden">
                      {paymentIcons.storepay_icon_url ? (
                        <img src={paymentIcons.storepay_icon_url} alt="Storepay" className="h-8 w-8 object-contain" />
                      ) : (
                        <Banknote className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold">Storepay</p>
                      <p className="text-sm text-muted-foreground">Storepay зээлээр төлөх</p>
                    </div>
                  </button>
                </div>
              </div>

              <Button variant="outline" onClick={() => setTopupState("input")} className="w-full">
                Буцах
              </Button>
            </>
          )}

          {topupState === "creating" && (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="mt-2 text-sm text-muted-foreground">Нэхэмжлэх үүсгэж байна...</p>
            </div>
          )}

          {/* Pending/Checking - QPay */}
          {(topupState === "pending" || topupState === "checking") && topupRecord?.provider === "qpay" && (
            <>
              <Card>
                <CardContent className="p-4">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Цэнэглэх дүн:</span>
                    <span className="text-xl font-bold text-primary">{formatPrice(parseInt(amount))}</span>
                  </div>
                </CardContent>
              </Card>

              {topupRecord.qpay_qr_image && (
                <div className="flex justify-center">
                  <div className="p-4 bg-white rounded-lg shadow-inner border">
                    <img src={topupRecord.qpay_qr_image} alt="QPay QR" className="w-48 h-48 object-contain" />
                  </div>
                </div>
              )}

              {topupRecord.qpay_urls && topupRecord.qpay_urls.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Банкны апп-аар нээх:</p>
                  <div className="max-h-[200px] overflow-y-auto">
                    <div className="grid grid-cols-4 gap-2 p-1">
                      {topupRecord.qpay_urls.map((app, index) => (
                        <a
                          key={`${app.name}-${index}`}
                          href={app.link}
                          className="flex flex-col items-center gap-1 p-2 rounded-lg border hover:bg-muted transition-colors text-center"
                        >
                          {app.logo ? (
                            <img src={app.logo} alt={app.name} className="h-8 w-8 object-contain" />
                          ) : (
                            <Smartphone className="h-6 w-6" />
                          )}
                          <span className="text-[10px] leading-tight line-clamp-2">{app.name}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <Button
                onClick={() => checkTopupStatus(false)}
                variant="outline"
                className="w-full"
                disabled={topupState === "checking"}
              >
                {topupState === "checking" ? (
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
              <p className="text-xs text-center text-muted-foreground">10 секунд тутамд автоматаар шалгана</p>
            </>
          )}

          {/* Pending/Checking - OmniWay */}
          {(topupState === "pending" || topupState === "checking") && topupRecord?.provider === "omniway" && (
            <>
              <Card>
                <CardContent className="p-4">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Цэнэглэх дүн:</span>
                    <span className="text-xl font-bold text-primary">{formatPrice(parseInt(amount))}</span>
                  </div>
                </CardContent>
              </Card>

              {/* QR Code or Deep Link based on device */}
              {isMobile && topupRecord.omniway_qr_content ? (
                <div className="space-y-3">
                  <a
                    href={topupRecord.omniway_qr_content}
                    className="flex items-center justify-center gap-2 w-full p-4 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold transition-colors"
                  >
                    <Smartphone className="h-5 w-5" />
                    OmniWay апп-аар нээх
                  </a>
                  <p className="text-xs text-center text-muted-foreground">
                    Дээрх товчийг дарж OmniWay апп руу шилжинэ
                  </p>
                </div>
              ) : (
                topupRecord.omniway_image_base64 && (
                  <div className="flex justify-center">
                    <div className="p-4 bg-white rounded-lg shadow-inner border">
                      <img
                        src={topupRecord.omniway_image_base64}
                        alt="OmniWay QR"
                        className="w-48 h-48 object-contain"
                      />
                    </div>
                  </div>
                )
              )}

              <Button
                onClick={() => checkTopupStatus(false)}
                variant="outline"
                className="w-full"
                disabled={topupState === "checking"}
              >
                {topupState === "checking" ? (
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
              <p className="text-xs text-center text-muted-foreground">10 секунд тутамд автоматаар шалгана</p>
            </>
          )}

          {/* Storepay phone input */}
          {topupState === "storepay_phone" && (
            <div className="space-y-3">
              <Card>
                <CardContent className="p-4">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Цэнэглэх дүн:</span>
                    <span className="text-xl font-bold text-primary">{formatPrice(parseInt(amount))}</span>
                  </div>
                </CardContent>
              </Card>
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Phone className="h-4 w-4" />
                  Storepay утасны дугаар
                </Label>
                <Input
                  type="tel"
                  value={storepayPhone}
                  onChange={(e) => setStorepayPhone(e.target.value.replace(/\D/g, "").slice(0, 8))}
                  placeholder="99112233"
                  maxLength={8}
                  inputMode="numeric"
                />
                <p className="text-xs text-muted-foreground">Storepay-д бүртгэлтэй дугаараа оруулна уу</p>
              </div>
              <Button onClick={handleStorepayCheckCredit} className="w-full" disabled={storepayPhone.length !== 8}>
                <ShieldCheck className="mr-2 h-4 w-4" />
                Зээлийн эрх шалгах
              </Button>
              <Button variant="outline" onClick={() => setTopupState("provider_select")} className="w-full">
                Буцах
              </Button>
            </div>
          )}

          {/* Storepay credit check loading */}
          {topupState === "storepay_credit_check" && (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="mt-2 text-sm text-muted-foreground">Зээлийн эрх шалгаж байна...</p>
            </div>
          )}

          {/* Storepay credit result */}
          {topupState === "storepay_credit_result" && (
            <div className="space-y-3">
              {storepayEligible ? (
                <Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-900/20">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <span className="font-medium text-green-700 dark:text-green-400">Зээлийн эрх бий</span>
                    </div>
                    <p className="text-sm text-green-600 dark:text-green-500">
                      Боломжит лимит: {formatPrice(storepayLimit)}
                    </p>
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
                <Button variant="outline" className="flex-1" onClick={() => setTopupState("storepay_phone")}>
                  Буцах
                </Button>
                {storepayEligible && (
                  <Button className="flex-1" onClick={handleStorepayCreateTopup}>
                    Нэхэмжлэх илгээх
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Storepay creating */}
          {topupState === "storepay_creating" && (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="mt-2 text-sm text-muted-foreground">Storepay нэхэмжлэх үүсгэж байна...</p>
            </div>
          )}

          {/* Storepay pending */}
          {(topupState === "storepay_pending" || topupState === "storepay_checking") && (
            <div className="space-y-3">
              <Card className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-900/20">
                <CardContent className="p-4 text-center">
                  <CheckCircle className="mx-auto h-10 w-10 text-blue-500 mb-2" />
                  <p className="font-medium text-blue-700 dark:text-blue-400">Нэхэмжлэл илгээгдлээ</p>
                  <p className="text-sm text-blue-600 dark:text-blue-500 mt-1">
                    Storepay апп-аас баталгаажуулна уу
                  </p>
                </CardContent>
              </Card>
              <Button
                onClick={() => checkStorepayTopupStatus(false)}
                variant="outline"
                className="w-full"
                disabled={topupState === "storepay_checking"}
              >
                {topupState === "storepay_checking" ? (
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

          {topupState === "completed" && (
            <Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-900/20">
              <CardContent className="p-4 text-center">
                <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-2" />
                <p className="font-medium text-green-700 dark:text-green-400">Цэнэглэлт амжилттай!</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-500 mt-2">
                  +{formatPrice(parseInt(amount))}
                </p>
                <Button onClick={() => onOpenChange(false)} className="mt-4">
                  Хаах
                </Button>
              </CardContent>
            </Card>
          )}

          {topupState === "failed" && (
            <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-900/20">
              <CardContent className="p-4 text-center">
                <XCircle className="mx-auto h-12 w-12 text-red-500 mb-2" />
                <p className="font-medium text-red-700 dark:text-red-400">Цэнэглэлт амжилтгүй</p>
                <Button
                  onClick={() => {
                    setTopupRecord(null);
                    setTopupState("input");
                    setAmount("");
                    setSelectedProvider(null);
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
      </DialogContent>
    </Dialog>
  );
}
