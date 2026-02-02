import { useState, useEffect } from 'react';
import { QrCode, CreditCard, RefreshCw, CheckCircle, XCircle, Clock, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  const [isCreating, setIsCreating] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  // Check for existing pending payment on mount
  useEffect(() => {
    if (!userId || cargoIds.length === 0) return;

    const checkExistingPayment = async () => {
      // Check if any cargo already has a pending payment
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
          .single();

        if (paymentData && paymentData.status === 'pending') {
          setPayment(paymentData as Payment);
        }
      }
    };

    checkExistingPayment();
  }, [userId, cargoIds]);

  const createInvoice = async () => {
    if (cargoIds.length === 0 || totalAmount <= 0) {
      toast({ title: 'Төлөх ачаа сонгоно уу', variant: 'destructive' });
      return;
    }

    setIsCreating(true);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      if (!token) {
        toast({ title: 'Нэвтэрнэ үү', variant: 'destructive' });
        return;
      }

      // Call edge function to create QPay invoice
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

      if (!response.ok) {
        throw new Error(result.error || 'Invoice creation failed');
      }

      // Fetch the created payment
      const { data: newPayment } = await supabase
        .from('payments')
        .select('*')
        .eq('id', result.payment_id)
        .single();

      if (newPayment) {
        setPayment(newPayment as Payment);
        toast({ title: 'Нэхэмжлэх үүсгэгдлээ' });
      }
    } catch (error) {
      console.error('Invoice creation error:', error);
      toast({ 
        title: 'Нэхэмжлэх үүсгэхэд алдаа гарлаа', 
        description: error instanceof Error ? error.message : 'Дахин оролдоно уу',
        variant: 'destructive' 
      });
    } finally {
      setIsCreating(false);
    }
  };

  const checkPaymentStatus = async () => {
    if (!payment) return;

    setIsChecking(true);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

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
        throw new Error(result.error || 'Status check failed');
      }

      // Refetch payment
      const { data: updatedPayment } = await supabase
        .from('payments')
        .select('*')
        .eq('id', payment.id)
        .single();

      if (updatedPayment) {
        setPayment(updatedPayment as Payment);
        
        if (updatedPayment.status === 'paid') {
          toast({ title: 'Төлбөр амжилттай!', description: 'Баярлалаа' });
          onSuccess?.();
        } else if (updatedPayment.status === 'failed') {
          toast({ title: 'Төлбөр амжилтгүй', variant: 'destructive' });
        }
      }
    } catch (error) {
      console.error('Status check error:', error);
      toast({ title: 'Төлөв шалгахад алдаа гарлаа', variant: 'destructive' });
    } finally {
      setIsChecking(false);
    }
  };

  // Auto-check payment status every 10 seconds
  useEffect(() => {
    if (!payment || payment.status !== 'pending') return;

    const interval = setInterval(checkPaymentStatus, 10000);
    return () => clearInterval(interval);
  }, [payment]);

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

  return (
    <div className="space-y-4">
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
        <Button onClick={createInvoice} className="w-full" disabled={isCreating}>
          {isCreating ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
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

          {payment.status === 'pending' && (
            <>
              {/* QR Code */}
              {payment.qpay_qr_image && (
                <div className="flex justify-center">
                  <div className="p-4 bg-white rounded-lg shadow-inner">
                    <img 
                      src={payment.qpay_qr_image} 
                      alt="QPay QR" 
                      className="w-48 h-48"
                    />
                  </div>
                </div>
              )}

              {/* Bank app links */}
              {payment.qpay_urls && Object.keys(payment.qpay_urls).length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-center text-muted-foreground">
                    Эсвэл банкны апп-аар нээх:
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(payment.qpay_urls).slice(0, 6).map(([name, url]) => (
                      <a
                        key={name}
                        href={url}
                        className="flex flex-col items-center gap-1 p-2 rounded-lg border hover:bg-muted transition-colors text-center"
                      >
                        <Smartphone className="h-5 w-5" />
                        <span className="text-xs truncate w-full">{name}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Check status button */}
              <Button 
                onClick={checkPaymentStatus} 
                variant="outline" 
                className="w-full"
                disabled={isChecking}
              >
                {isChecking ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Төлөв шалгах
                  </>
                )}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                Төлбөр хийсний дараа автоматаар шинэчлэгдэнэ
              </p>
            </>
          )}

          {payment.status === 'paid' && (
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
        </div>
      )}
    </div>
  );
}
