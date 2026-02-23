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

type TopupState = "input" | "provider_select" | "creating" | "pending" | "checking" | "completed" | "failed";
type PaymentProvider = "qpay" | "omniway";

export function WalletTopupModal({ open, onOpenChange, onSuccess }: WalletTopupModalProps) {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [amount, setAmount] = useState("");
  const [topupState, setTopupState] = useState<TopupState>("input");
  const [topupRecord, setTopupRecord] = useState<TopupRecord | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<PaymentProvider | null>(null);
  const autoCheckRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (open) {
      setAmount("");
      setTopupState("input");
      setTopupRecord(null);
      setErrorMessage(null);
      setIsDemoMode(false);
      setSelectedProvider(null);
    }
    return () => {
      if (autoCheckRef.current) clearInterval(autoCheckRef.current);
    };
  }, [open]);

  useEffect(() => {
    if (topupState !== "pending" || !topupRecord) {
      if (autoCheckRef.current) {
        clearInterval(autoCheckRef.current);
        autoCheckRef.current = null;
      }
      return;
    }
    autoCheckRef.current = setInterval(() => {
      checkTopupStatus(true);
    }, 10000);
    return () => {
      if (autoCheckRef.current) clearInterval(autoCheckRef.current);
    };
  }, [topupState, topupRecord]);

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
      } else {
        await createOmniWayTopup(token, amountNum);
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

  const quickAmounts = [5000, 10000, 20000, 50000, 100000];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Түрийвч цэнэглэх
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
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                      <QrCode className="h-6 w-6 text-blue-600 dark:text-blue-400" />
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
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
                      <CreditCard className="h-6 w-6 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold">OmniWay</p>
                      <p className="text-sm text-muted-foreground">OmniWay аппаар QR уншуулж төлөх</p>
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
