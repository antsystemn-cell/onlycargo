import { useEffect, useState } from 'react';
import { Loader2, RefreshCw, ExternalLink, PackageSearch, Save } from 'lucide-react';
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

type ResearchStatus = 'pending' | 'processing' | 'completed' | 'rejected' | 'cancelled';

interface ResearchOrder {
  id: string;
  user_id: string;
  product_url: string;
  notes: string | null;
  fee: number;
  status: ResearchStatus;
  admin_quoted_price: number | null;
  admin_response: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  profiles?: { phone: string | null } | null;
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
  pending: 'bg-yellow-100 text-yellow-800',
  processing: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  cancelled: 'bg-muted text-muted-foreground',
};

export default function ProductResearchManagement() {
  const { toast } = useToast();

  const [config, setConfig] = useState<ResearchConfig>(DEFAULT_CONFIG);
  const [orders, setOrders] = useState<ResearchOrder[]>([]);
  const [phones, setPhones] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [filter, setFilter] = useState<'all' | ResearchStatus>('pending');
  const [editing, setEditing] = useState<Record<string, Partial<ResearchOrder>>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  const fetchConfig = async () => {
    const { data } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'product_research_config')
      .maybeSingle();
    if (data?.value) setConfig({ ...DEFAULT_CONFIG, ...(data.value as Partial<ResearchConfig>) });
  };

  const fetchOrders = async () => {
    const { data, error } = await (supabase as any)
      .from('product_research_orders')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      toast({ title: 'Алдаа', description: error.message, variant: 'destructive' });
      return;
    }
    const list = (data || []) as ResearchOrder[];
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
    const { error } = await supabase
      .from('site_settings')
      .upsert({ key: 'product_research_config', value: config as any }, { onConflict: 'key' });
    setSavingConfig(false);
    if (error) {
      toast({ title: 'Хадгалах алдаа', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Тохиргоо хадгалагдлаа' });
    }
  };

  const patchOrder = (id: string, patch: Partial<ResearchOrder>) => {
    setEditing((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const saveOrder = async (order: ResearchOrder) => {
    const patch = editing[order.id] || {};
    if (Object.keys(patch).length === 0) return;
    setSaving((p) => ({ ...p, [order.id]: true }));
    const { error } = await (supabase as any)
      .from('product_research_orders')
      .update({
        status: patch.status ?? order.status,
        admin_quoted_price: patch.admin_quoted_price ?? order.admin_quoted_price,
        admin_response: patch.admin_response ?? order.admin_response,
        admin_notes: patch.admin_notes ?? order.admin_notes,
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
        <PackageSearch className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Барааны судалгааны захиалга</h1>
          <p className="text-sm text-muted-foreground">БНХАУ-аас бараа судлах үйлчилгээний захиалгыг удирдана</p>
        </div>
      </div>

      {/* Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Үйлчилгээний тохиргоо</CardTitle>
          <CardDescription>Төлбөрийн хэмжээ, идэвхтэй эсэхийг өөрчилнө</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="font-medium">Үйлчилгээ идэвхтэй</p>
              <p className="text-xs text-muted-foreground">Идэвхгүй бол хэрэглэгч захиалга өгч чадахгүй</p>
            </div>
            <Switch
              checked={config.enabled}
              onCheckedChange={(v) => setConfig((c) => ({ ...c, enabled: v }))}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="fee">Нэг бараа судлах төлбөр (₮)</Label>
              <Input
                id="fee"
                type="number"
                min="0"
                step="500"
                value={config.fee}
                onChange={(e) => setConfig((c) => ({ ...c, fee: Number(e.target.value) || 0 }))}
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="note">Хэрэглэгчид харагдах тэмдэглэл</Label>
              <Textarea
                id="note"
                value={config.note || ''}
                onChange={(e) => setConfig((c) => ({ ...c, note: e.target.value }))}
                placeholder="Жишээ: Үйлчилгээ түр хаалттай..."
                rows={2}
              />
            </div>
          </div>

          <Button onClick={saveConfig} disabled={savingConfig}>
            {savingConfig ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Тохиргоо хадгалах
          </Button>
        </CardContent>
      </Card>

      {/* Filter */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant={filter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('all')}>
          Бүгд ({orders.length})
        </Button>
        {(['pending', 'processing', 'completed', 'rejected', 'cancelled'] as ResearchStatus[]).map((s) => (
          <Button
            key={s}
            variant={filter === s ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(s)}
          >
            {STATUS_LABEL[s]} ({counts[s] || 0})
          </Button>
        ))}
        <Button variant="ghost" size="sm" className="ml-auto" onClick={fetchOrders}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Orders */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              Захиалга байхгүй байна
            </CardContent>
          </Card>
        ) : (
          filtered.map((o) => {
            const edit = editing[o.id] || {};
            const current = { ...o, ...edit };
            const changed = Object.keys(edit).length > 0;
            return (
              <Card key={o.id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1 space-y-1">
                      <a
                        href={o.product_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline break-all"
                      >
                        <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                        {o.product_url}
                      </a>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>Утас: <span className="font-mono">{phones[o.user_id] || '—'}</span></span>
                        <span>·</span>
                        <span>{new Date(o.created_at).toLocaleString('mn-MN')}</span>
                        <span>·</span>
                        <span>Төлбөр: <span className="font-semibold">{formatPrice(Number(o.fee))}</span></span>
                      </div>
                    </div>
                    <Badge className={STATUS_STYLE[o.status]}>{STATUS_LABEL[o.status]}</Badge>
                  </div>

                  {o.notes && (
                    <div className="rounded bg-muted/40 p-2 text-xs">
                      <span className="font-semibold">Хэрэглэгчийн тэмдэглэл: </span>{o.notes}
                    </div>
                  )}

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label className="text-xs">Төлөв</Label>
                      <Select
                        value={current.status}
                        onValueChange={(v) => patchOrder(o.id, { status: v as ResearchStatus })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(Object.keys(STATUS_LABEL) as ResearchStatus[]).map((s) => (
                            <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Барааны бодит үнэ (₮)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="100"
                        value={current.admin_quoted_price ?? ''}
                        onChange={(e) =>
                          patchOrder(o.id, {
                            admin_quoted_price: e.target.value === '' ? null : Number(e.target.value),
                          })
                        }
                        placeholder="Жишээ: 45000"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Label className="text-xs">Хэрэглэгчид харагдах хариу</Label>
                      <Textarea
                        rows={2}
                        value={current.admin_response ?? ''}
                        onChange={(e) => patchOrder(o.id, { admin_response: e.target.value })}
                        placeholder="Барааны төрөл, үнэ, хүргэлт зэрэг мэдээлэл..."
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Label className="text-xs">Дотоод тэмдэглэл (хэрэглэгчид харагдахгүй)</Label>
                      <Textarea
                        rows={2}
                        value={current.admin_notes ?? ''}
                        onChange={(e) => patchOrder(o.id, { admin_notes: e.target.value })}
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
