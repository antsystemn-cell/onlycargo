import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { PackageSearch, Loader2, Clock, CheckCircle2, XCircle, RefreshCw, Wallet as WalletIcon, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useWallet } from '@/hooks/useWallet';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatPrice } from '@/lib/priceCalculation';

type ResearchStatus = 'pending' | 'processing' | 'completed' | 'rejected' | 'cancelled';

interface ResearchOrder {
  id: string;
  product_url: string;
  notes: string | null;
  fee: number;
  status: ResearchStatus;
  admin_quoted_price: number | null;
  admin_response: string | null;
  created_at: string;
  updated_at: string;
}

interface ResearchConfig {
  enabled: boolean;
  fee: number;
  note?: string;
}

const DEFAULT_CONFIG: ResearchConfig = {
  enabled: true,
  fee: 3000,
};

const STATUS_LABEL: Record<ResearchStatus, string> = {
  pending: 'Хүлээгдэж байна',
  processing: 'Судалж байна',
  completed: 'Судалгаа гарсан',
  rejected: 'Татгалзсан',
  cancelled: 'Цуцлагдсан',
};

const STATUS_STYLE: Record<ResearchStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  processing: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  cancelled: 'bg-muted text-muted-foreground',
};

const urlSchema = z.string().trim().url('Зөв линк оруулна уу').max(1000);

export default function ProductResearch() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { balance, refreshWallet } = useWallet();

  const [config, setConfig] = useState<ResearchConfig>(DEFAULT_CONFIG);
  const [orders, setOrders] = useState<ResearchOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [productUrl, setProductUrl] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [authLoading, user, navigate]);

  const fetchConfig = async () => {
    const { data } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'product_research_config')
      .maybeSingle();
    if (data?.value) {
      setConfig({ ...DEFAULT_CONFIG, ...(data.value as Partial<ResearchConfig>) });
    }
  };

  const fetchOrders = async () => {
    if (!user) return;
    const { data, error } = await (supabase as any)
      .from('product_research_orders')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (!error && data) setOrders(data as ResearchOrder[]);
  };

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      await Promise.all([fetchConfig(), fetchOrders()]);
      setLoading(false);
    })();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!config.enabled) {
      toast({ title: 'Үйлчилгээ түр хаалттай', description: config.note || 'Дараа дахин оролдоно уу.', variant: 'destructive' });
      return;
    }
    const parsed = urlSchema.safeParse(productUrl);
    if (!parsed.success) {
      toast({ title: 'Линк буруу', description: parsed.error.errors[0].message, variant: 'destructive' });
      return;
    }
    if (balance < config.fee) {
      toast({
        title: 'Үлдэгдэл хүрэлцэхгүй',
        description: `Судалгааны төлбөр ${formatPrice(config.fee)}. Хэтэвчээ цэнэглэнэ үү.`,
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    const { error } = await (supabase as any).rpc('create_product_research_order', {
      p_product_url: parsed.data,
      p_notes: notes.trim() || null,
      p_fee: config.fee,
    });
    setSubmitting(false);

    if (error) {
      toast({ title: 'Алдаа гарлаа', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Хүсэлт илгээгдлээ', description: 'Админ судалгааг эхлүүлэх болно.' });
    setProductUrl('');
    setNotes('');
    await Promise.all([fetchOrders(), refreshWallet()]);
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
          <PackageSearch className="h-3.5 w-3.5" />
          БНХАУ бараа судлах
        </div>
        <div className="text-2xl font-bold">1 бараа = {formatPrice(config.fee)}</div>
        <p className="mt-1 text-xs text-white/80">Taobao / 1688 / Pinduoduo линк илгээгээрэй</p>
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-xs backdrop-blur-sm">
          <WalletIcon className="h-4 w-4" />
          <span>Хэтэвчний үлдэгдэл:</span>
          <span className="ml-auto font-semibold">{formatPrice(balance)}</span>
        </div>
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
          <CardTitle className="text-base">Шинэ судалгааны хүсэлт</CardTitle>
          <CardDescription>
            Барааны линк оруулаад төлбөрөө хэтэвчнээсээ төлнө. Админ судалж бодит үнэ, хүргэлт зэргийг мэдээлнэ.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="url">Барааны линк</Label>
              <Input
                id="url"
                type="url"
                inputMode="url"
                placeholder="https://item.taobao.com/... эсвэл 1688, pinduoduo"
                value={productUrl}
                onChange={(e) => setProductUrl(e.target.value)}
                disabled={!config.enabled}
                maxLength={1000}
                required
              />
              <p className="mt-1 text-xs text-muted-foreground">Taobao, Tmall, 1688, Pinduoduo линкийг дэмжинэ.</p>
            </div>

            <div>
              <Label htmlFor="notes">Тэмдэглэл (заавал биш)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Хэмжээ, өнгө, тоо ширхэг, нэмэлт хүсэлт..."
                maxLength={500}
                rows={3}
                disabled={!config.enabled}
              />
            </div>

            <div className="rounded-lg bg-muted/50 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Судалгааны төлбөр:</span>
                <span className="font-semibold">{formatPrice(config.fee)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Төлбөрийн эх үүсвэр:</span>
                <span className="font-medium">Хэтэвч</span>
              </div>
              <div className="mt-1 flex justify-between border-t pt-1 text-xs text-muted-foreground">
                <span>Төлбөр илгээмэгц хасагдана.</span>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={submitting || !config.enabled || !productUrl.trim() || balance < config.fee}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Хүсэлт илгээх ({formatPrice(config.fee)})
            </Button>
            {balance < config.fee && (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => navigate('/wallet')}
              >
                Хэтэвчээ цэнэглэх
              </Button>
            )}
          </form>
        </CardContent>
      </Card>

      {/* History */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-semibold text-muted-foreground">Миний хүсэлтүүд ({orders.length})</h2>
          <Button variant="ghost" size="sm" onClick={fetchOrders}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        {orders.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              Одоогоор хүсэлт байхгүй байна
            </CardContent>
          </Card>
        ) : (
          orders.map((o) => (
            <Card key={o.id}>
              <CardContent className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <a
                    href={o.product_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 min-w-0 truncate text-sm font-medium text-primary hover:underline flex items-center gap-1"
                  >
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{o.product_url}</span>
                  </a>
                  <Badge className={STATUS_STYLE[o.status]}>
                    {o.status === 'completed' && <CheckCircle2 className="mr-1 h-3 w-3" />}
                    {o.status === 'pending' && <Clock className="mr-1 h-3 w-3" />}
                    {(o.status === 'cancelled' || o.status === 'rejected') && <XCircle className="mr-1 h-3 w-3" />}
                    {STATUS_LABEL[o.status]}
                  </Badge>
                </div>
                {o.notes && (
                  <p className="text-xs text-muted-foreground">
                    <span className="font-semibold">Тэмдэглэл:</span> {o.notes}
                  </p>
                )}
                <div className="rounded-lg bg-muted/40 p-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Төлбөр:</span>
                    <span className="font-medium">{formatPrice(Number(o.fee))}</span>
                  </div>
                  {o.admin_quoted_price != null && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Барааны үнэ (админ):</span>
                      <span className="font-semibold text-primary">{formatPrice(Number(o.admin_quoted_price))}</span>
                    </div>
                  )}
                </div>
                {o.admin_response && (
                  <div className="rounded bg-primary/5 p-2 text-xs">
                    <p className="font-semibold mb-0.5">Админы хариу:</p>
                    <p className="whitespace-pre-wrap">{o.admin_response}</p>
                  </div>
                )}
                <div className="text-xs text-muted-foreground">
                  {new Date(o.created_at).toLocaleString('mn-MN')}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
