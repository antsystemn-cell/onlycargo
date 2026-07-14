import { useEffect, useState } from 'react';
import { Loader2, RefreshCw, Save, FileCheck2, Paperclip } from 'lucide-react';
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

type CustomsStatus = 'pending' | 'processing' | 'completed' | 'rejected' | 'cancelled';

interface Attachment { path: string; url: string; name: string }

interface CustomsOrder {
  id: string;
  user_id: string;
  product_description: string;
  product_value: number | null;
  quantity: number | null;
  contact_phone: string | null;
  notes: string | null;
  attachments: Attachment[];
  fee: number;
  status: CustomsStatus;
  admin_quoted_cost: number | null;
  admin_response: string | null;
  admin_notes: string | null;
  created_at: string;
}

interface CustomsConfig { enabled: boolean; fee: number; note?: string }

const DEFAULT_CONFIG: CustomsConfig = { enabled: true, fee: 5000 };

const STATUS_LABEL: Record<CustomsStatus, string> = {
  pending: 'Хүлээгдэж байна',
  processing: 'Судалж байна',
  completed: 'Зөвлөгөө өгсөн',
  rejected: 'Татгалзсан',
  cancelled: 'Цуцлагдсан',
};

const STATUS_STYLE: Record<CustomsStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  processing: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  cancelled: 'bg-muted text-muted-foreground',
};

export default function CustomsConsultationManagement() {
  const { toast } = useToast();

  const [config, setConfig] = useState<CustomsConfig>(DEFAULT_CONFIG);
  const [orders, setOrders] = useState<CustomsOrder[]>([]);
  const [phones, setPhones] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [filter, setFilter] = useState<'all' | CustomsStatus>('pending');
  const [editing, setEditing] = useState<Record<string, Partial<CustomsOrder>>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  const fetchConfig = async () => {
    const { data } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'customs_consultation_config')
      .maybeSingle();
    if (data?.value) setConfig({ ...DEFAULT_CONFIG, ...(data.value as Partial<CustomsConfig>) });
  };

  const fetchOrders = async () => {
    const { data, error } = await (supabase as any)
      .from('customs_consultation_orders')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      toast({ title: 'Алдаа', description: error.message, variant: 'destructive' });
      return;
    }
    const list = (data || []) as CustomsOrder[];
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
      .upsert({ key: 'customs_consultation_config', value: config as any }, { onConflict: 'key' });
    setSavingConfig(false);
    if (error) toast({ title: 'Хадгалах алдаа', description: error.message, variant: 'destructive' });
    else toast({ title: 'Тохиргоо хадгалагдлаа' });
  };

  const patch = (id: string, p: Partial<CustomsOrder>) => {
    setEditing((prev) => ({ ...prev, [id]: { ...prev[id], ...p } }));
  };

  const saveOrder = async (o: CustomsOrder) => {
    const p = editing[o.id] || {};
    if (Object.keys(p).length === 0) return;
    setSaving((prev) => ({ ...prev, [o.id]: true }));
    const { error } = await (supabase as any)
      .from('customs_consultation_orders')
      .update({
        status: p.status ?? o.status,
        admin_quoted_cost: p.admin_quoted_cost ?? o.admin_quoted_cost,
        admin_response: p.admin_response ?? o.admin_response,
        admin_notes: p.admin_notes ?? o.admin_notes,
      })
      .eq('id', o.id);
    setSaving((prev) => ({ ...prev, [o.id]: false }));
    if (error) {
      toast({ title: 'Алдаа', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Хүсэлт шинэчлэгдлээ' });
    setEditing((prev) => {
      const next = { ...prev };
      delete next[o.id];
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
        <FileCheck2 className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Гаалийн бүрдүүлэлтийн зөвлөгөө</h1>
          <p className="text-sm text-muted-foreground">Хэрэглэгчдийн зөвлөгөө авах хүсэлтийг удирдана</p>
        </div>
      </div>

      {/* Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Үйлчилгээний тохиргоо</CardTitle>
          <CardDescription>Төлбөр, идэвхтэй эсэхийг тохируулна</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="font-medium">Үйлчилгээ идэвхтэй</p>
              <p className="text-xs text-muted-foreground">Идэвхгүй бол хэрэглэгч хүсэлт илгээж чадахгүй</p>
            </div>
            <Switch checked={config.enabled} onCheckedChange={(v) => setConfig((c) => ({ ...c, enabled: v }))} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="fee">Нэг зөвлөгөөний төлбөр (₮)</Label>
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
        {(['pending', 'processing', 'completed', 'rejected', 'cancelled'] as CustomsStatus[]).map((s) => (
          <Button key={s} variant={filter === s ? 'default' : 'outline'} size="sm" onClick={() => setFilter(s)}>
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
              Хүсэлт байхгүй байна
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
                      <p className="text-sm font-medium">{o.product_description}</p>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>Утас: <span className="font-mono">{o.contact_phone || phones[o.user_id] || '—'}</span></span>
                        <span>·</span>
                        <span>{new Date(o.created_at).toLocaleString('mn-MN')}</span>
                        <span>·</span>
                        <span>Төлбөр: <span className="font-semibold">{formatPrice(Number(o.fee))}</span></span>
                      </div>
                      {(o.product_value != null || o.quantity != null) && (
                        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                          {o.product_value != null && <span>Үнэ: <span className="font-medium text-foreground">{o.product_value}</span></span>}
                          {o.quantity != null && <span>Тоо: <span className="font-medium text-foreground">{o.quantity}</span></span>}
                        </div>
                      )}
                    </div>
                    <Badge className={STATUS_STYLE[o.status]}>{STATUS_LABEL[o.status]}</Badge>
                  </div>

                  {o.notes && (
                    <div className="rounded bg-muted/40 p-2 text-xs">
                      <span className="font-semibold">Хэрэглэгчийн тэмдэглэл: </span>{o.notes}
                    </div>
                  )}

                  {Array.isArray(o.attachments) && o.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {o.attachments.map((a) => (
                        <a
                          key={a.path}
                          href={a.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded bg-muted px-2 py-1 text-[11px] hover:bg-muted/80"
                        >
                          <Paperclip className="h-3 w-3" />
                          {a.name}
                        </a>
                      ))}
                    </div>
                  )}

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label className="text-xs">Төлөв</Label>
                      <Select
                        value={current.status}
                        onValueChange={(v) => patch(o.id, { status: v as CustomsStatus })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(Object.keys(STATUS_LABEL) as CustomsStatus[]).map((s) => (
                            <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Тооцоолсон гаалийн зардал (₮)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="100"
                        value={current.admin_quoted_cost ?? ''}
                        onChange={(e) =>
                          patch(o.id, { admin_quoted_cost: e.target.value === '' ? null : Number(e.target.value) })
                        }
                        placeholder="Жишээ: 120000"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Label className="text-xs">Хэрэглэгчид харагдах зөвлөгөө</Label>
                      <Textarea
                        rows={3}
                        value={current.admin_response ?? ''}
                        onChange={(e) => patch(o.id, { admin_response: e.target.value })}
                        placeholder="HS код, татварын хувь, шаардлагатай бичиг баримт..."
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Label className="text-xs">Дотоод тэмдэглэл</Label>
                      <Textarea
                        rows={2}
                        value={current.admin_notes ?? ''}
                        onChange={(e) => patch(o.id, { admin_notes: e.target.value })}
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
