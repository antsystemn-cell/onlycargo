import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navigation, Loader2, Clock, CheckCircle2, XCircle, RefreshCw, Wallet as WalletIcon, MapPin } from 'lucide-react';
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

type OrderStatus = 'pending' | 'processing' | 'in_transit' | 'delivered' | 'rejected' | 'cancelled';

interface DeliveryOrder {
  id: string;
  origin_city: string;
  origin_address: string | null;
  destination_city: string;
  destination_address: string | null;
  goods_description: string;
  goods_quantity: string | null;
  goods_weight: string | null;
  goods_volume: string | null;
  contact_phone: string | null;
  notes: string | null;
  fee_amount: number;
  quoted_price: number | null;
  admin_response: string | null;
  status: OrderStatus;
  created_at: string;
}

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'Хүлээгдэж байна',
  processing: 'Боловсруулж байна',
  in_transit: 'Замд яваа',
  delivered: 'Хүргэгдсэн',
  rejected: 'Татгалзсан',
  cancelled: 'Цуцлагдсан',
};

const STATUS_STYLE: Record<OrderStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  processing: 'bg-blue-100 text-blue-800',
  in_transit: 'bg-indigo-100 text-indigo-800',
  delivered: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  cancelled: 'bg-muted text-muted-foreground',
};

export default function MongoliaDelivery() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { balance, refreshWallet } = useWallet();

  const [enabled, setEnabled] = useState(true);
  const [fee, setFee] = useState(0);
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [originCity, setOriginCity] = useState('');
  const [originAddress, setOriginAddress] = useState('');
  const [destinationCity, setDestinationCity] = useState('');
  const [destinationAddress, setDestinationAddress] = useState('');
  const [goodsDescription, setGoodsDescription] = useState('');
  const [goodsQuantity, setGoodsQuantity] = useState('');
  const [goodsWeight, setGoodsWeight] = useState('');
  const [goodsVolume, setGoodsVolume] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [authLoading, user, navigate]);

  const fetchConfig = async () => {
    const { data } = await supabase
      .from('site_settings')
      .select('key, value')
      .in('key', ['mongolia_delivery_enabled', 'mongolia_delivery_fee']);
    if (data) {
      for (const row of data) {
        if (row.key === 'mongolia_delivery_enabled') setEnabled(row.value as unknown as boolean);
        if (row.key === 'mongolia_delivery_fee') setFee(Number(row.value) || 0);
      }
    }
  };

  const fetchOrders = async () => {
    if (!user) return;
    const { data, error } = await (supabase as any)
      .from('mongolia_delivery_orders')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (!error && data) setOrders(data as DeliveryOrder[]);
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
    if (!enabled) {
      toast({ title: 'Үйлчилгээ түр хаалттай', variant: 'destructive' });
      return;
    }
    if (!originCity.trim() || !destinationCity.trim() || !goodsDescription.trim()) {
      toast({ title: 'Заавал талбар дутуу', description: 'Хаанаас, хаашаа, ямар бараа?', variant: 'destructive' });
      return;
    }
    if (fee > 0 && balance < fee) {
      toast({
        title: 'Үлдэгдэл хүрэлцэхгүй',
        description: `Үйлчилгээний төлбөр ${formatPrice(fee)}.`,
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    const { error } = await (supabase as any).rpc('create_mongolia_delivery_order', {
      _origin_city: originCity.trim(),
      _origin_address: originAddress.trim() || null,
      _destination_city: destinationCity.trim(),
      _destination_address: destinationAddress.trim() || null,
      _goods_description: goodsDescription.trim(),
      _goods_quantity: goodsQuantity.trim() || null,
      _goods_weight: goodsWeight.trim() || null,
      _goods_volume: goodsVolume.trim() || null,
      _contact_phone: contactPhone.trim() || null,
      _notes: notes.trim() || null,
    });
    setSubmitting(false);

    if (error) {
      const msg = error.message?.includes('insufficient_balance')
        ? 'Хэтэвчний үлдэгдэл хүрэлцэхгүй байна'
        : error.message;
      toast({ title: 'Алдаа гарлаа', description: msg, variant: 'destructive' });
      return;
    }
    toast({ title: 'Хүсэлт илгээгдлээ', description: 'Админ удахгүй холбогдоно.' });
    setOriginCity(''); setOriginAddress('');
    setDestinationCity(''); setDestinationAddress('');
    setGoodsDescription(''); setGoodsQuantity(''); setGoodsWeight(''); setGoodsVolume('');
    setContactPhone(''); setNotes('');
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
      <div className="rounded-2xl border bg-gradient-to-br from-primary/90 to-primary p-5 text-white shadow-sm">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur-sm">
          <Navigation className="h-3.5 w-3.5" />
          Монгол дахь хүргэлт
        </div>
        <div className="text-xl font-bold">Монгол дотор хот хоорондын хүргэлт</div>
        <p className="mt-1 text-xs text-white/80">
          Хаанаас, ямар бараа, аль хотруу гэдгийг оруулаад захиалга илгээнэ үү.
        </p>
        {fee > 0 && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-xs backdrop-blur-sm">
            <WalletIcon className="h-4 w-4" />
            <span>Захиалгын хураамж:</span>
            <span className="ml-auto font-semibold">{formatPrice(fee)}</span>
          </div>
        )}
      </div>

      {!enabled && (
        <Card className="border-yellow-300 bg-yellow-50">
          <CardContent className="p-4 text-sm font-semibold text-yellow-900">
            Үйлчилгээ түр хаалттай байна
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Шинэ захиалга</CardTitle>
          <CardDescription>Монгол дотор бараагаа хүргүүлэх хүсэлт бүртгүүлэх</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="rounded-lg border p-3 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" /> Явах цэг
              </div>
              <div>
                <Label htmlFor="ocity">Хот *</Label>
                <Input id="ocity" value={originCity} onChange={(e) => setOriginCity(e.target.value)} placeholder="Жишээ: Улаанбаатар" required />
              </div>
              <div>
                <Label htmlFor="oaddr">Дэлгэрэнгүй хаяг</Label>
                <Textarea id="oaddr" value={originAddress} onChange={(e) => setOriginAddress(e.target.value)} rows={2} placeholder="Дүүрэг, хороо, байр, тоот, холбогч" />
              </div>
            </div>

            <div className="rounded-lg border p-3 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" /> Хүрэх цэг
              </div>
              <div>
                <Label htmlFor="dcity">Хот *</Label>
                <Input id="dcity" value={destinationCity} onChange={(e) => setDestinationCity(e.target.value)} placeholder="Жишээ: Дархан / Эрдэнэт" required />
              </div>
              <div>
                <Label htmlFor="daddr">Дэлгэрэнгүй хаяг</Label>
                <Textarea id="daddr" value={destinationAddress} onChange={(e) => setDestinationAddress(e.target.value)} rows={2} placeholder="Хүрэх хаяг" />
              </div>
            </div>

            <div className="rounded-lg border p-3 space-y-3">
              <div className="text-xs font-semibold text-muted-foreground">Барааны мэдээлэл</div>
              <div>
                <Label htmlFor="desc">Ямар бараа *</Label>
                <Textarea id="desc" value={goodsDescription} onChange={(e) => setGoodsDescription(e.target.value)} rows={2} placeholder="Барааны төрөл, тайлбар" required />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label htmlFor="qty" className="text-xs">Тоо ширхэг</Label>
                  <Input id="qty" value={goodsQuantity} onChange={(e) => setGoodsQuantity(e.target.value)} placeholder="10 ш" />
                </div>
                <div>
                  <Label htmlFor="wt" className="text-xs">Жин (кг)</Label>
                  <Input id="wt" value={goodsWeight} onChange={(e) => setGoodsWeight(e.target.value)} placeholder="50" />
                </div>
                <div>
                  <Label htmlFor="vol" className="text-xs">Эзэлхүүн (м³)</Label>
                  <Input id="vol" value={goodsVolume} onChange={(e) => setGoodsVolume(e.target.value)} placeholder="0.5" />
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="phone">Холбоо барих утас</Label>
              <Input id="phone" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="99xxxxxx" />
            </div>

            <div>
              <Label htmlFor="notes">Нэмэлт тэмдэглэл</Label>
              <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={500} />
            </div>

            {fee > 0 && (
              <div className="rounded-lg bg-muted/50 p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Захиалгын хураамж:</span>
                  <span className="font-semibold">{formatPrice(fee)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Хэтэвчний үлдэгдэл:</span>
                  <span className="font-medium">{formatPrice(balance)}</span>
                </div>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={submitting || !enabled || (fee > 0 && balance < fee)}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Захиалга илгээх{fee > 0 ? ` (${formatPrice(fee)})` : ''}
            </Button>
            {fee > 0 && balance < fee && (
              <Button type="button" variant="outline" className="w-full" onClick={() => navigate('/wallet')}>
                Хэтэвчээ цэнэглэх
              </Button>
            )}
          </form>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-semibold text-muted-foreground">Миний захиалга ({orders.length})</h2>
          <Button variant="ghost" size="sm" onClick={fetchOrders}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        {orders.length === 0 ? (
          <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">Одоогоор захиалга байхгүй</CardContent></Card>
        ) : (
          orders.map((o) => (
            <Card key={o.id}>
              <CardContent className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">
                      {o.origin_city} → {o.destination_city}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{o.goods_description}</p>
                  </div>
                  <Badge className={STATUS_STYLE[o.status]}>
                    {o.status === 'delivered' && <CheckCircle2 className="mr-1 h-3 w-3" />}
                    {o.status === 'pending' && <Clock className="mr-1 h-3 w-3" />}
                    {(o.status === 'cancelled' || o.status === 'rejected') && <XCircle className="mr-1 h-3 w-3" />}
                    {STATUS_LABEL[o.status]}
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-1 text-[11px] text-muted-foreground">
                  {o.goods_quantity && <div>Тоо: <span className="text-foreground">{o.goods_quantity}</span></div>}
                  {o.goods_weight && <div>Жин: <span className="text-foreground">{o.goods_weight}кг</span></div>}
                  {o.goods_volume && <div>Эзэлхүүн: <span className="text-foreground">{o.goods_volume}м³</span></div>}
                </div>
                {o.quoted_price != null && (
                  <div className="rounded bg-muted/40 p-2 text-xs flex justify-between">
                    <span className="text-muted-foreground">Хүргэлтийн үнэ (админ):</span>
                    <span className="font-semibold text-primary">{formatPrice(Number(o.quoted_price))}</span>
                  </div>
                )}
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
