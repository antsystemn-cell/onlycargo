import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { ArrowRightLeft, Loader2, Wallet as WalletIcon, Clock, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type RemittanceStatus = 'pending' | 'processing' | 'completed' | 'cancelled' | 'rejected';
type ReceiverType = 'alipay' | 'wechat';

interface RemittanceOrder {
  id: string;
  amount_mnt: number;
  amount_cny: number;
  rate: number;
  fee: number;
  receiver_type: ReceiverType;
  receiver_account: string;
  receiver_name: string;
  note: string | null;
  status: RemittanceStatus;
  admin_note: string | null;
  proof_url: string | null;
  created_at: string;
  processed_at: string | null;
}

interface RemittanceConfig {
  enabled: boolean;
  rate: number; // 1 CNY = X MNT
  fee_percent: number;
  min_cny: number;
  max_cny: number;
  note?: string;
}

const DEFAULT_CONFIG: RemittanceConfig = {
  enabled: true,
  rate: 520,
  fee_percent: 2,
  min_cny: 10,
  max_cny: 10000,
};

const STATUS_LABEL: Record<RemittanceStatus, string> = {
  pending: 'Хүлээгдэж байна',
  processing: 'Гүйцэтгэж байна',
  completed: 'Амжилттай илгээгдсэн',
  cancelled: 'Цуцлагдсан',
  rejected: 'Татгалзсан',
};

const STATUS_STYLE: Record<RemittanceStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  processing: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  cancelled: 'bg-muted text-muted-foreground',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

const formSchema = z.object({
  cny: z.number().positive('CNY дүн 0-с их байх ёстой'),
  receiverType: z.enum(['alipay', 'wechat']),
  receiverAccount: z.string().trim().min(3, 'Хүлээн авагчийн ID оруулна уу').max(120),
  receiverName: z.string().trim().min(1, 'Хүлээн авагчийн нэр оруулна уу').max(120),
  note: z.string().trim().max(500).optional(),
});

function fmt(n: number, digits = 0) {
  return new Intl.NumberFormat('mn-MN', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
}

export default function Remittance() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [config, setConfig] = useState<RemittanceConfig>(DEFAULT_CONFIG);
  const [orders, setOrders] = useState<RemittanceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [cnyInput, setCnyInput] = useState('');
  const [receiverType, setReceiverType] = useState<ReceiverType>('alipay');
  const [receiverAccount, setReceiverAccount] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [authLoading, user, navigate]);

  const fetchConfig = async () => {
    const { data } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'remittance_config')
      .maybeSingle();
    if (data?.value) {
      setConfig({ ...DEFAULT_CONFIG, ...(data.value as Partial<RemittanceConfig>) });
    }
  };

  const fetchOrders = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('remittance_orders')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (!error && data) setOrders(data as RemittanceOrder[]);
  };

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      await Promise.all([fetchConfig(), fetchOrders()]);
      setLoading(false);
    })();
  }, [user]);

  const cnyNum = parseFloat(cnyInput.replace(',', '.')) || 0;
  const feeAmount = useMemo(() => Math.round(cnyNum * config.rate * (config.fee_percent / 100)), [cnyNum, config]);
  const mntAmount = useMemo(() => Math.round(cnyNum * config.rate) + feeAmount, [cnyNum, config, feeAmount]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!config.enabled) {
      toast({ title: 'Үйлчилгээ түр хаалттай', description: config.note || 'Дараа дахин оролдоно уу.', variant: 'destructive' });
      return;
    }
    const parsed = formSchema.safeParse({
      cny: cnyNum,
      receiverType,
      receiverAccount,
      receiverName,
      note: note || undefined,
    });
    if (!parsed.success) {
      toast({ title: 'Талбар шалгана уу', description: parsed.error.errors[0].message, variant: 'destructive' });
      return;
    }
    if (cnyNum < config.min_cny) {
      toast({ title: 'Хамгийн бага дүн', description: `Хамгийн бага гуйвуулга ${config.min_cny} ¥`, variant: 'destructive' });
      return;
    }
    if (cnyNum > config.max_cny) {
      toast({ title: 'Хамгийн их дүн', description: `Нэг удаагийн дээд хэмжээ ${config.max_cny} ¥`, variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.from('remittance_orders').insert({
      user_id: user.id,
      amount_mnt: mntAmount,
      amount_cny: cnyNum,
      rate: config.rate,
      fee: feeAmount,
      receiver_type: receiverType,
      receiver_account: receiverAccount.trim(),
      receiver_name: receiverName.trim(),
      note: note.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: 'Алдаа гарлаа', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Хүсэлт илгээгдлээ', description: 'Админ баталгаажуулмагц гүйлгээ хийгдэнэ.' });
    setCnyInput('');
    setReceiverAccount('');
    setReceiverName('');
    setNote('');
    fetchOrders();
  };

  const handleCancel = async (id: string) => {
    const { error } = await supabase
      .from('remittance_orders')
      .update({ status: 'cancelled' })
      .eq('id', id);
    if (error) {
      toast({ title: 'Алдаа', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Захиалга цуцлагдлаа' });
      fetchOrders();
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-4 px-4 py-5">
      {/* Header */}
      <div className="rounded-2xl border bg-gradient-to-br from-primary/90 to-primary p-5 text-white shadow-sm">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur-sm">
          <ArrowRightLeft className="h-3.5 w-3.5" />
          MNT → CNY гуйвуулга
        </div>
        <div className="text-2xl font-bold">1 ¥ = {fmt(config.rate)}₮</div>
        <p className="mt-1 text-xs text-white/80">Шимтгэл {config.fee_percent}% · Alipay / WeChat</p>
      </div>

      {!config.enabled && (
        <Card className="border-yellow-300 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20">
          <CardContent className="p-4 text-sm">
            <p className="font-semibold text-yellow-900 dark:text-yellow-200">Үйлчилгээ түр хаалттай</p>
            {config.note && <p className="mt-1 text-yellow-800 dark:text-yellow-300">{config.note}</p>}
          </CardContent>
        </Card>
      )}

      {/* Form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Шинэ гуйвуулга</CardTitle>
          <CardDescription>Хятад руу CNY илгээх мэдээллээ бүрэн бөглөнө үү</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="cny">Хэдэн юань илгээх вэ?</Label>
              <div className="relative mt-1">
                <Input
                  id="cny"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  placeholder="0"
                  value={cnyInput}
                  onChange={(e) => setCnyInput(e.target.value)}
                  className="pr-12 text-lg font-semibold"
                  disabled={!config.enabled}
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">¥</span>
              </div>
              <div className="mt-2 rounded-lg bg-muted/50 p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ханшаар:</span>
                  <span className="font-medium">{fmt(Math.round(cnyNum * config.rate))} ₮</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Шимтгэл ({config.fee_percent}%):</span>
                  <span className="font-medium">{fmt(feeAmount)} ₮</span>
                </div>
                <div className="mt-1 flex justify-between border-t pt-1">
                  <span className="font-semibold">Нийт төлөх:</span>
                  <span className="font-bold text-primary">{fmt(mntAmount)} ₮</span>
                </div>
              </div>
            </div>

            <div>
              <Label>Хүлээн авах суваг</Label>
              <RadioGroup
                value={receiverType}
                onValueChange={(v) => setReceiverType(v as ReceiverType)}
                className="mt-2 grid grid-cols-2 gap-2"
              >
                <label className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm ${receiverType === 'alipay' ? 'border-primary bg-primary/5' : ''}`}>
                  <RadioGroupItem value="alipay" />
                  <span className="font-medium">Alipay 支付宝</span>
                </label>
                <label className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm ${receiverType === 'wechat' ? 'border-primary bg-primary/5' : ''}`}>
                  <RadioGroupItem value="wechat" />
                  <span className="font-medium">WeChat 微信</span>
                </label>
              </RadioGroup>
            </div>

            <div>
              <Label htmlFor="account">Хүлээн авагчийн ID / Утас</Label>
              <Input
                id="account"
                value={receiverAccount}
                onChange={(e) => setReceiverAccount(e.target.value)}
                placeholder={receiverType === 'alipay' ? 'Alipay ID эсвэл утас' : 'WeChat ID'}
                maxLength={120}
                disabled={!config.enabled}
              />
            </div>

            <div>
              <Label htmlFor="rname">Хүлээн авагчийн нэр (хятадаар)</Label>
              <Input
                id="rname"
                value={receiverName}
                onChange={(e) => setReceiverName(e.target.value)}
                placeholder="жишээ: 王小明"
                maxLength={120}
                disabled={!config.enabled}
              />
            </div>

            <div>
              <Label htmlFor="note">Тэмдэглэл (заавал биш)</Label>
              <Textarea
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Нэмэлт тайлбар..."
                maxLength={500}
                rows={2}
                disabled={!config.enabled}
              />
            </div>

            <Button type="submit" className="w-full" disabled={submitting || !config.enabled || cnyNum <= 0}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Хүсэлт илгээх
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Хүсэлт илгээсний дараа админ баталгаажуулж таны Alipay/WeChat руу CNY гүйлгэх болно.
            </p>
          </form>
        </CardContent>
      </Card>

      {/* History */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-semibold text-muted-foreground">Миний захиалгууд ({orders.length})</h2>
          <Button variant="ghost" size="sm" onClick={fetchOrders}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        {orders.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              Одоогоор захиалга байхгүй байна
            </CardContent>
          </Card>
        ) : (
          orders.map((o) => (
            <Card key={o.id}>
              <CardContent className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-lg font-bold">{fmt(Number(o.amount_cny), 2)} ¥</div>
                    <div className="text-xs text-muted-foreground">= {fmt(Number(o.amount_mnt))} ₮</div>
                  </div>
                  <Badge className={STATUS_STYLE[o.status]}>
                    {o.status === 'completed' && <CheckCircle2 className="mr-1 h-3 w-3" />}
                    {o.status === 'pending' && <Clock className="mr-1 h-3 w-3" />}
                    {(o.status === 'cancelled' || o.status === 'rejected') && <XCircle className="mr-1 h-3 w-3" />}
                    {STATUS_LABEL[o.status]}
                  </Badge>
                </div>
                <div className="rounded-lg bg-muted/40 p-2 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">Суваг:</span><span className="font-medium">{o.receiver_type === 'alipay' ? 'Alipay' : 'WeChat'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Хүлээн авагч:</span><span className="font-medium">{o.receiver_name}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">ID:</span><span className="font-mono">{o.receiver_account}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Ханш:</span><span>{fmt(Number(o.rate))} ₮/¥</span></div>
                </div>
                {o.note && <p className="text-xs text-muted-foreground">Тэмдэглэл: {o.note}</p>}
                {o.admin_note && (
                  <p className="rounded bg-primary/5 p-2 text-xs">
                    <span className="font-semibold">Админ: </span>{o.admin_note}
                  </p>
                )}
                <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground">
                  <span>{new Date(o.created_at).toLocaleString('mn-MN')}</span>
                  {o.status === 'pending' && (
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => handleCancel(o.id)}>
                      Цуцлах
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
