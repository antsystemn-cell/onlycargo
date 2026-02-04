import { useState, useEffect, useRef } from 'react';
import { QrCode, RefreshCw, CheckCircle, XCircle, Smartphone, AlertTriangle, Loader2, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatPrice } from '@/lib/priceCalculation';

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
  status: string;
  qpay_qr_image: string;
  qpay_urls: QPayBankApp[];
}

type TopupState = 'input' | 'creating' | 'pending' | 'checking' | 'completed' | 'failed';

export function WalletTopupModal({ open, onOpenChange, onSuccess }: WalletTopupModalProps) {
  const { toast } = useToast();
  const [amount, setAmount] = useState('');
  const [topupState, setTopupState] = useState<TopupState>('input');
  const [topupRecord, setTopupRecord] = useState<TopupRecord | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const autoCheckRef = useRef<NodeJS.Timeout | null>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setAmount('');
      setTopupState('input');
      setTopupRecord(null);
      setErrorMessage(null);
      setIsDemoMode(false);
    }
    return () => {
      if (autoCheckRef.current) {
        clearInterval(autoCheckRef.current);
      }
    };
  }, [open]);

  // Auto-check payment every 10 seconds
  useEffect(() => {
    if (topupState !== 'pending' || !topupRecord) {
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
      if (autoCheckRef.current) {
        clearInterval(autoCheckRef.current);
      }
    };
  }, [topupState, topupRecord]);

  const createTopup = async () => {
    const amountNum = parseInt(amount);
    if (!amountNum || amountNum < 1000) {
      toast({ title: 'Хамгийн багадаа 1,000₮', variant: 'destructive' });
      return;
    }

    setTopupState('creating');
    setErrorMessage(null);

    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      if (!token) {
        throw new Error('Нэвтэрнэ үү');
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/qpay-wallet-topup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ amount: amountNum }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Нэхэмжлэх үүсгэхэд алдаа гарлаа');
      }

      setIsDemoMode(result.demo_mode || false);
      setTopupRecord({
        id: result.topup_id,
        status: 'pending',
        qpay_qr_image: result.qr_image,
        qpay_urls: result.urls || [],
      });
      setTopupState('pending');
      toast({ title: 'Нэхэмжлэх үүсгэгдлээ' });

    } catch (error) {
      console.error('Topup creation error:', error);
      setTopupState('input');
      setErrorMessage(error instanceof Error ? error.message : 'Алдаа гарлаа');
      toast({
        title: 'Нэхэмжлэх үүсгэхэд алдаа гарлаа',
        variant: 'destructive',
      });
    }
  };

  const checkTopupStatus = async (isAutoCheck = false) => {
    if (!topupRecord) return;

    if (!isAutoCheck) {
      setTopupState('checking');
    }

    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      if (!token) return;

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/qpay-wallet-check`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ topup_id: topupRecord.id }),
      });

      const result = await response.json();

      if (result.status === 'completed') {
        setTopupState('completed');
        toast({ title: 'Цэнэглэлт амжилттай!', description: 'Түрийвч цэнэглэгдлээ' });
        onSuccess?.();
      } else if (result.status === 'failed') {
        setTopupState('failed');
        toast({ title: 'Цэнэглэлт амжилтгүй', variant: 'destructive' });
      } else if (!isAutoCheck) {
        setTopupState('pending');
      }
    } catch (error) {
      console.error('Status check error:', error);
      if (!isAutoCheck) {
        setTopupState('pending');
      }
    }
  };

  const quickAmounts = [5000, 10000, 20000, 50000, 100000];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Түрийвч цэнэглэх
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Demo mode warning */}
          {isDemoMode && (
            <Alert variant="default" className="border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-900/20">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-700 dark:text-yellow-400">
                Демо горим - QPay холболт тохируулаагүй
              </AlertDescription>
            </Alert>
          )}

          {/* Error message */}
          {errorMessage && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          {topupState === 'input' && (
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

              {/* Quick amounts */}
              <div className="grid grid-cols-3 gap-2">
                {quickAmounts.map((amt) => (
                  <Button
                    key={amt}
                    variant={amount === String(amt) ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setAmount(String(amt))}
                  >
                    {formatPrice(amt)}
                  </Button>
                ))}
              </div>

              <Button onClick={createTopup} className="w-full" disabled={!amount || parseInt(amount) < 1000}>
                <QrCode className="mr-2 h-4 w-4" />
                QPay нэхэмжлэх үүсгэх
              </Button>
            </>
          )}

          {topupState === 'creating' && (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="mt-2 text-sm text-muted-foreground">Нэхэмжлэх үүсгэж байна...</p>
            </div>
          )}

          {(topupState === 'pending' || topupState === 'checking') && topupRecord && (
            <>
              {/* Amount */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Цэнэглэх дүн:</span>
                    <span className="text-xl font-bold text-primary">{formatPrice(parseInt(amount))}</span>
                  </div>
                </CardContent>
              </Card>

              {/* QR Code */}
              {topupRecord.qpay_qr_image && (
                <div className="flex justify-center">
                  <div className="p-4 bg-white rounded-lg shadow-inner border">
                    <img
                      src={topupRecord.qpay_qr_image}
                      alt="QPay QR"
                      className="w-48 h-48 object-contain"
                    />
                  </div>
                </div>
              )}

              {/* Bank apps */}
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
                disabled={topupState === 'checking'}
              >
                {topupState === 'checking' ? (
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

              <p className="text-xs text-center text-muted-foreground">
                10 секунд тутамд автоматаар шалгана
              </p>
            </>
          )}

          {topupState === 'completed' && (
            <Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-900/20">
              <CardContent className="p-4 text-center">
                <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-2" />
                <p className="font-medium text-green-700 dark:text-green-400">
                  Цэнэглэлт амжилттай!
                </p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-500 mt-2">
                  +{formatPrice(parseInt(amount))}
                </p>
                <Button onClick={() => onOpenChange(false)} className="mt-4">
                  Хаах
                </Button>
              </CardContent>
            </Card>
          )}

          {topupState === 'failed' && (
            <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-900/20">
              <CardContent className="p-4 text-center">
                <XCircle className="mx-auto h-12 w-12 text-red-500 mb-2" />
                <p className="font-medium text-red-700 dark:text-red-400">
                  Цэнэглэлт амжилтгүй
                </p>
                <Button
                  onClick={() => {
                    setTopupRecord(null);
                    setTopupState('input');
                    setAmount('');
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
