import { useState, useEffect, useCallback, useRef } from 'react';
import { QrCode, RefreshCw, CheckCircle, XCircle, Clock, Smartphone, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Payment, PaymentStatus } from '@/types/cargo';

interface QPayPaymentProps {
  cargoIds: string[];
  totalAmount: number;
  userId: string;
  branchId: string | null;
  onSuccess?: () => void;
  onClose?: () => void;
}

// QPay v2 bank app structure from response.urls
interface QPayBankApp {
  name: string;
  description: string;
  logo: string;
  link: string;
}

type PaymentState = 'idle' | 'creating' | 'pending' | 'checking' | 'paid' | 'failed' | 'error';

export default function QPayPayment({ 
  cargoIds, 
  totalAmount, 
  userId, 
  branchId, 
  onSuccess, 
  onClose 
}: QPayPaymentProps) {
  const { toast } = useToast();
  const [payment, setPayment] = useState<Payment | null>(null);
  const [bankApps, setBankApps] = useState<QPayBankApp[]>([]);
  const [paymentState, setPaymentState] = useState<PaymentState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const autoCheckRef = useRef<NodeJS.Timeout | null>(null);

  // Check for existing pending payment on mount
  useEffect(() => {
    if (!userId || cargoIds.length === 0) return;

    const checkExistingPayment = async () => {
      const { data: existingPayments } = await supabase
        .from('payment_cargo')
        .select('payment_id, cargo_id')
        .in('cargo_id', cargoIds);

      if (existingPayments && existingPayments.length > 0) {
        const paymentId = existingPayments[0].payment_id;
        const { data: paymentData } = await supabase
          .from('payments')
          .select('*')
          .eq('id', paymentId)
          .maybeSingle();

        if (paymentData && paymentData.status === 'pending') {
          setPayment(paymentData as Payment);
          setPaymentState('pending');
          setIsDemoMode(paymentData.qpay_invoice_id?.startsWith('DEMO-') || false);
          
          // Parse bank apps from qpay_urls (stored as array)
          if (paymentData.qpay_urls && Array.isArray(paymentData.qpay_urls)) {
            setBankApps(paymentData.qpay_urls as unknown as QPayBankApp[]);
          }
        } else if (paymentData && paymentData.status === 'paid') {
          setPayment(paymentData as Payment);
          setPaymentState('paid');
        }
      }
    };

    checkExistingPayment();
  }, [userId, cargoIds]);

  // Auto-check payment status every 10 seconds when pending
  useEffect(() => {
    if (paymentState !== 'pending' || !payment) {
      if (autoCheckRef.current) {
        clearInterval(autoCheckRef.current);
        autoCheckRef.current = null;
      }
      return;
    }

    autoCheckRef.current = setInterval(() => {
      checkPaymentStatus(true);
    }, 10000);

    return () => {
      if (autoCheckRef.current) {
        clearInterval(autoCheckRef.current);
      }
    };
  }, [paymentState, payment]);

  const createInvoice = useCallback(async () => {
    if (cargoIds.length === 0 || totalAmount <= 0) {
      toast({ title: 'Төлөх ачаа сонгоно уу', variant: 'destructive' });
      return;
    }

    setPaymentState('creating');
    setErrorMessage(null);

    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      if (!token) {
        throw new Error('Нэвтэрнэ үү');
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/qpay-create-invoice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: totalAmount,
          cargo_ids: cargoIds,
          description: `OnlyCargo - ${cargoIds.length} ачаа төлбөр`,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Нэхэмжлэх үүсгэхэд алдаа гарлаа');
      }

      // Check if demo mode
      if (result.demo_mode) {
        setIsDemoMode(true);
      }

      // Store bank apps from QPay response (NEVER hardcode)
      if (result.urls && Array.isArray(result.urls)) {
        setBankApps(result.urls);
      }

      // Fetch the created payment
      const { data: newPayment, error: fetchError } = await supabase
        .from('payments')
        .select('*')
        .eq('id', result.payment_id)
        .single();

      if (fetchError || !newPayment) {
        throw new Error('Төлбөрийн мэдээлэл олдсонгүй');
      }

      setPayment(newPayment as Payment);
      setPaymentState('pending');
      toast({ title: 'Нэхэмжлэх үүсгэгдлээ' });

    } catch (error) {
      console.error('Invoice creation error:', error);
      setPaymentState('error');
      setErrorMessage(error instanceof Error ? error.message : 'Алдаа гарлаа');
      toast({ 
        title: 'Нэхэмжлэх үүсгэхэд алдаа гарлаа', 
        description: error instanceof Error ? error.message : 'Дахин оролдоно уу',
        variant: 'destructive' 
      });
    }
  }, [cargoIds, totalAmount, toast]);

  const checkPaymentStatus = useCallback(async (isAutoCheck = false) => {
    if (!payment) return;

    if (!isAutoCheck) {
      setPaymentState('checking');
    }

    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      if (!token) {
        throw new Error('Session expired');
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/qpay-check-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          payment_id: payment.id,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('Status check error:', result.error);
        if (!isAutoCheck) {
          setPaymentState('pending');
        }
        return;
      }

      // Refetch payment from database
      const { data: updatedPayment } = await supabase
        .from('payments')
        .select('*')
        .eq('id', payment.id)
        .single();

      if (updatedPayment) {
        setPayment(updatedPayment as Payment);
        
        if (updatedPayment.status === 'paid') {
          setPaymentState('paid');
          toast({ title: 'Төлбөр амжилттай!', description: 'Баярлалаа' });
          onSuccess?.();
        } else if (updatedPayment.status === 'failed') {
          setPaymentState('failed');
          toast({ title: 'Төлбөр амжилтгүй', variant: 'destructive' });
        } else {
          setPaymentState('pending');
        }
      }
    } catch (error) {
      console.error('Status check error:', error);
      if (!isAutoCheck) {
        toast({ title: 'Төлөв шалгахад алдаа гарлаа', variant: 'destructive' });
        setPaymentState('pending');
      }
    }
  }, [payment, toast, onSuccess]);

  const getStatusIcon = (status: PaymentStatus) => {
    switch (status) {
      case 'paid':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'pending':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      default:
        return null;
    }
  };

  const renderPaymentStatusLabel = (status: PaymentStatus) => {
    const labels: Record<PaymentStatus, string> = {
      pending: 'Хүлээгдэж байна',
      paid: 'Төлөгдсөн',
      failed: 'Амжилтгүй',
      cancelled: 'Цуцлагдсан',
      refunded: 'Буцаагдсан',
    };
    return labels[status];
  };

  const isCreating = paymentState === 'creating';
  const isChecking = paymentState === 'checking';
  const isPending = paymentState === 'pending';
  const isPaid = paymentState === 'paid';
  const isFailed = paymentState === 'failed';
  const isError = paymentState === 'error';

  return (
    <div className="space-y-4">
      {/* Demo mode warning */}
      {isDemoMode && (
        <Alert variant="default" className="border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-900/20">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-700 dark:text-yellow-400">
            Демо горим - QPay холболт тохируулаагүй байна
          </AlertDescription>
        </Alert>
      )}

      {/* Error message */}
      {isError && errorMessage && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      {/* Amount summary */}
      <Card>
        <CardContent className="p-4">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Нийт дүн:</span>
            <span className="text-xl font-bold text-primary">{totalAmount.toLocaleString()}₮</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {cargoIds.length} ачаа сонгогдсон
          </p>
        </CardContent>
      </Card>

      {!payment ? (
        // Create invoice button
        <Button 
          onClick={createInvoice} 
          className="w-full" 
          disabled={isCreating}
        >
          {isCreating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Нэхэмжлэх үүсгэж байна...
            </>
          ) : (
            <>
              <QrCode className="mr-2 h-4 w-4" />
              QPay нэхэмжлэх үүсгэх
            </>
          )}
        </Button>
      ) : (
        // Payment created - show QR or status
        <div className="space-y-4">
          {/* Status badge */}
          <div className="flex items-center justify-center gap-2">
            {getStatusIcon(payment.status as PaymentStatus)}
            <Badge variant={payment.status === 'paid' ? 'default' : 'secondary'}>
              {renderPaymentStatusLabel(payment.status as PaymentStatus)}
            </Badge>
          </div>

          {isPending && (
            <>
              {/* QR Code - from QPay response, NEVER generate locally */}
              {payment.qpay_qr_image && (
                <div className="flex justify-center">
                  <div className="p-4 bg-white rounded-lg shadow-inner border">
                    <img 
                      src={payment.qpay_qr_image} 
                      alt="QPay QR" 
                      className="w-48 h-48 object-contain"
                    />
                  </div>
                </div>
              )}

              {/* Bank app links - dynamically from QPay response.urls, NEVER hardcoded */}
              {bankApps.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Эсвэл банкны апп-аар нээх:
                    </p>
                    <span className="text-xs text-muted-foreground">
                      {bankApps.length} апп
                    </span>
                  </div>
                  <ScrollArea className="h-auto max-h-[280px] sm:max-h-[320px]">
                    <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2 p-1">
                      {bankApps.map((app, index) => (
                        <a
                          key={`${app.name}-${index}`}
                          href={app.link}
                          className="flex flex-col items-center gap-1 p-2 rounded-lg border hover:bg-muted transition-colors text-center"
                        >
                          {app.logo ? (
                            <img 
                              src={app.logo} 
                              alt={app.name} 
                              className="h-8 w-8 sm:h-10 sm:w-10 object-contain"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.nextElementSibling?.classList.remove('hidden');
                              }}
                            />
                          ) : null}
                          <Smartphone className={`h-6 w-6 sm:h-8 sm:w-8 ${app.logo ? 'hidden' : ''}`} />
                          <span className="text-[10px] sm:text-xs leading-tight line-clamp-2 w-full">{app.name}</span>
                        </a>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {/* Check status button */}
              <Button 
                onClick={() => checkPaymentStatus(false)} 
                variant="outline" 
                className="w-full"
                disabled={isChecking}
              >
                {isChecking ? (
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
                Төлбөр хийсний дараа 10 секунд тутамд автоматаар шинэчлэгдэнэ
              </p>
            </>
          )}

          {isPaid && (
            <Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-900/20">
              <CardContent className="p-4 text-center">
                <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-2" />
                <p className="font-medium text-green-700 dark:text-green-400">
                  Төлбөр амжилттай хийгдлээ!
                </p>
                <p className="text-sm text-green-600 dark:text-green-500 mt-1">
                  Баярлалаа
                </p>
              </CardContent>
            </Card>
          )}

          {isFailed && (
            <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-900/20">
              <CardContent className="p-4 text-center">
                <XCircle className="mx-auto h-12 w-12 text-red-500 mb-2" />
                <p className="font-medium text-red-700 dark:text-red-400">
                  Төлбөр амжилтгүй боллоо
                </p>
                <p className="text-sm text-red-600 dark:text-red-500 mt-1">
                  Дахин оролдоно уу
                </p>
                <Button 
                  onClick={() => {
                    setPayment(null);
                    setBankApps([]);
                    setPaymentState('idle');
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
      )}
    </div>
  );
}
