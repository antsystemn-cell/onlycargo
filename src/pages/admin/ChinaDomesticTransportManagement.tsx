import { useEffect, useState } from 'react';
import { Loader2, RefreshCw, Warehouse, Save } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatPrice } from '@/lib/priceCalculation';

type OrderStatus = 'pending' | 'processing' | 'in_transit' | 'delivered' | 'rejected' | 'cancelled';

interface TransportOrder {
  id: string;
  user_id: string;
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

export default function ChinaDomesticTransportManagement() {
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(true);
  const [fee, setFee] = useState(0);
  const [orders, setOrders] = useState<TransportOrder[]>([]);
  const [phones, setPhones] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [filter, setFilter] = useState<'all' | OrderStatus>('pending');
  const [editing, setEditing] = useState<Record<string, Partial<TransportOrder>>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  const fetchConfig = async () => {
    const { data } = await supabase
      .from('site_settings')
      .select('key, value')
      .in('key', ['china_domestic_transport_enabled', 'china_domestic_transport_fee']);
    if (data) {
      for (const row of data) {
        if (row.key === 'china_domestic_transport_enabled') setEnabled(row.value as unknown as boolean);
        if (row.key === 'china_domestic_transport_fee') setFee(Number(row.value) || 0);
      }
    }
  };

  const fetchOrders = async () => {
    const { data, error } = await (supabase as any)
      .from('china_domestic_transport_orders')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      toast({ title: 'Алдаа', description: error.message, variant: 'destructive' });
      return;
    }
    const list = (data || []) as TransportOrder[];
    setOrders(list);
    const userIds = Array.from(new Set(list.map((o) => o.user_id)));
    if (userIds.length) {
      const { data: profs } = await supabase.from('profiles').select('id, phone').in('id', userIds);
      const map: Record<string, string> = {};
      (profs || []).forEach((p: any) => { if (p.phone) map[p.id] = p.phone; });
      setPhones(map);
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([fetchConfig(), fetchOrders()]);
      setLoading(false);
    })();
  }, []);

  const saveConfig = async () => {
    setSavingConfig(true);
    const { error: e1 } = await supabase.from('site_settings').upsert(
      { key: 'china_domestic_transport_enabled', value: enabled as any },
      { onConflict: 'key' }
    );
    const { error: e2 } = await supabase.from('site_settings').upsert(
      { key: 'china_domestic_transport_fee', value: fee as any },
      { onConflict: 'key' }
    );
    setSavingConfig(false);
    if (e1 || e2) {
      toast({ title: 'Хадгалах алдаа', description: (e1 || e2)?.message, variant: 'destructive' });
    } else {
      toast({ title: 'Тохиргоо хадгалагдлаа' });
    }
  };

  const patchOrder = (id: string, patch: Partial<TransportOrder>) => {
    setEditing((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const saveOrder = async (order: TransportOrder) => {
    const patch = editing[order.id] || {};
    if (Object.keys(patch).length === 0) return;
    setSaving((p) => ({ ...p, [order.id]: true }));
    const { error } = await (supabase as any)
      .from('china_domestic_transport_orders')
      .update({
        status: patch.status ?? order.status,
        quoted_price: patch.quoted_price ?? order.quoted_price,
        admin_response: patch.admin_response ?? order.admin_response,
      })
      .eq('id', order.id);
    setSaving((p) => ({ ...p, [order.id]: false }));
    if (error) {
      toast({ title: 'Алдаа', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Захиалга шинэчлэгдлээ' });
    setEditing((prev) => {
      const next = { ...prev };
      delete next[order.id];
      return next;
    });
    fetchOrders();
  };

  const filtered = orders.filter((o) => filter === 'all' || o.status === filter);
  const counts = orders.reduce<Record<string, number>>((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1;
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Warehouse className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Хятадын дотоод тээвэр</h1>
          <p className="text-sm text-muted-foreground">Хятад дахь хот хоорондын тээврийн захиалгууд</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Үйлчилгээний тохиргоо</CardTitle>
          <CardDescription>Идэвхтэй эсэх ба захиалгын хураамжийг өөрчилнө</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="font-medium">Үйлчилгээ идэвхтэй</p>
              <p className="text-xs text-muted-foreground">Идэвхгүй бол хэрэглэгч захиалга өгч чадахгүй</p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          <div>
            <Label htmlFor="fee">Захиалгын хураамж (₮). 0 бол үнэгүй.</Label>
            <Input
              id="fee"
              type="number"
              min="0"
              step="500"
              value={fee}
              onChange={(e) => setFee(Number(e.target.value) || 0)}
            />
          </div>

          <Button onClick={saveConfig} disabled={savingConfig}>
            {savingConfig ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Тохиргоо хадгалах
          </Button>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant={filter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('all')}>
          Бүгд ({orders.length})
        </Button>
        {(['pending', 'processing', 'in_transit', 'delivered', 'rejected', 'cancelled'] as OrderStatus[]).map((s) => (
          <Button key={s} variant={filter === s ? 'default' : 'outline'} size="sm" onClick={() => setFilter(s)}>
            {STATUS_LABEL[s]} ({counts[s] || 0})
          </Button>
        ))}
        <Button variant="ghost" size="sm" className="ml-auto" onClick={fetchOrders}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Захиалга байхгүй байна</CardContent></Card>
        ) : (
          filtered.map((o) => {
            const edit = editing[o.id] || {};
            const current = { ...o, ...edit };
            const changed = Object.keys(edit).length > 0;
            return (
              <Card key={o.id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold">{o.origin_city} → {o.destination_city}</div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>Утас: <span className="font-mono">{o.contact_phone || phones[o.user_id] || '—'}</span></span>
                        <span>·</span>
                        <span>{new Date(o.created_at).toLocaleString('mn-MN')}</span>
                        {Number(o.fee_amount) > 0 && (
                          <>
                            <span>·</span>
                            <span>Хураамж: <span className="font-semibold">{formatPrice(Number(o.fee_amount))}</span></span>
                          </>
                        )}
                      </div>
                    </div>
                    <Badge className={STATUS_STYLE[o.status]}>{STATUS_LABEL[o.status]}</Badge>
                  </div>

                  <div className="rounded bg-muted/40 p-2 text-xs space-y-1">
                    <div><span className="font-semibold">Бараа:</span> {o.goods_description}</div>
                    <div className="flex flex-wrap gap-3">
                      {o.goods_quantity && <span>Тоо: {o.goods_quantity}</span>}
                      {o.goods_weight && <span>Жин: {o.goods_weight}кг</span>}
                      {o.goods_volume && <span>Эзэлхүүн: {o.goods_volume}м³</span>}
                    </div>
                    {o.origin_address && <div><span className="font-semibold">Явах хаяг:</span> {o.origin_address}</div>}
                    {o.destination_address && <div><span className="font-semibold">Хүрэх хаяг:</span> {o.destination_address}</div>}
                    {o.notes && <div><span className="font-semibold">Тэмдэглэл:</span> {o.notes}</div>}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label className="text-xs">Төлөв</Label>
                      <Select value={current.status} onValueChange={(v) => patchOrder(o.id, { status: v as OrderStatus })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(Object.keys(STATUS_LABEL) as OrderStatus[]).map((s) => (
                            <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Тээврийн үнэ (₮)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="1000"
                        value={current.quoted_price ?? ''}
                        onChange={(e) => patchOrder(o.id, { quoted_price: e.target.value === '' ? null : Number(e.target.value) })}
                        placeholder="Жишээ: 350000"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Label className="text-xs">Хэрэглэгчид харагдах хариу</Label>
                      <Textarea
                        rows={2}
                        value={current.admin_response ?? ''}
                        onChange={(e) => patchOrder(o.id, { admin_response: e.target.value })}
                        placeholder="Хугацаа, тээврийн нөхцөл, тодруулга..."
                      />
                    </div>
                  </div>

                  {changed && (
                    <div className="flex justify-end">
                      <Button size="sm" onClick={() => saveOrder(o)} disabled={saving[o.id]}>
                        {saving[o.id] ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Хадгалах
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
