import { useEffect, useState } from 'react';
import { Loader2, RefreshCw, Settings2, Check, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

type RemittanceStatus = 'pending' | 'processing' | 'completed' | 'cancelled' | 'rejected';

interface RemittanceOrder {
  id: string;
  user_id: string;
  amount_mnt: number;
  amount_cny: number;
  rate: number;
  fee: number;
  receiver_type: 'alipay' | 'wechat';
  receiver_account: string;
  receiver_name: string;
  note: string | null;
  status: RemittanceStatus;
  admin_note: string | null;
  proof_url: string | null;
  created_at: string;
  processed_at: string | null;
  profile?: { phone: string; full_name: string | null } | null;
}

interface RemittanceConfig {
  enabled: boolean;
  rate: number;
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
  pending: 'Хүлээгдэж буй',
  processing: 'Гүйцэтгэж буй',
  completed: 'Илгээгдсэн',
  cancelled: 'Цуцалсан',
  rejected: 'Татгалзсан',
};

const STATUS_STYLE: Record<RemittanceStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  processing: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-muted text-muted-foreground',
  rejected: 'bg-red-100 text-red-800',
};

function fmt(n: number, d = 0) {
  return new Intl.NumberFormat('mn-MN', { minimumFractionDigits: d, maximumFractionDigits: d }).format(n);
}

export default function RemittanceManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [orders, setOrders] = useState<RemittanceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<RemittanceConfig>(DEFAULT_CONFIG);
  const [savingConfig, setSavingConfig] = useState(false);
  const [selected, setSelected] = useState<RemittanceOrder | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [proofUrl, setProofUrl] = useState('');
  const [newStatus, setNewStatus] = useState<RemittanceStatus>('processing');
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<'active' | 'done' | 'all'>('active');

  const fetchAll = async () => {
    setLoading(true);
    const [{ data: ordersData }, { data: cfgData }] = await Promise.all([
      supabase.from('remittance_orders').select('*').order('created_at', { ascending: false }),
      supabase.from('site_settings').select('value').eq('key', 'remittance_config').maybeSingle(),
    ]);

    let list: RemittanceOrder[] = (ordersData as RemittanceOrder[]) || [];
    if (list.length > 0) {
      const ids = Array.from(new Set(list.map((o) => o.user_id)));
      const { data: profiles } = await supabase.from('profiles').select('id, phone, full_name').in('id', ids);
      const map = new Map((profiles || []).map((p) => [p.id, p]));
      list = list.map((o) => ({ ...o, profile: map.get(o.user_id) as any }));
    }
    setOrders(list);

    if (cfgData?.value) {
      setConfig({ ...DEFAULT_CONFIG, ...(cfgData.value as Partial<RemittanceConfig>) });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const saveConfig = async () => {
    setSavingConfig(true);
    const { error } = await supabase
      .from('site_settings')
      .upsert({ key: 'remittance_config', value: config as any, updated_by: user?.id ?? null }, { onConflict: 'key' });
    setSavingConfig(false);
    if (error) {
      toast({ title: 'Алдаа', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Тохиргоо хадгалагдлаа' });
    }
  };

  const openEdit = (o: RemittanceOrder) => {
    setSelected(o);
    setAdminNote(o.admin_note || '');
    setProofUrl(o.proof_url || '');
    setNewStatus(o.status === 'pending' ? 'processing' : o.status);
  };

  const saveStatus = async () => {
    if (!selected) return;
    setSaving(true);
    const finalize = newStatus === 'completed' || newStatus === 'rejected' || newStatus === 'cancelled';
    const { error } = await supabase
      .from('remittance_orders')
      .update({
        status: newStatus,
        admin_note: adminNote.trim() || null,
        proof_url: proofUrl.trim() || null,
        processed_at: finalize ? new Date().toISOString() : null,
        processed_by: finalize ? (user?.id ?? null) : null,
      })
      .eq('id', selected.id);
    setSaving(false);
    if (error) {
      toast({ title: 'Алдаа', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Шинэчлэгдлээ' });
    setSelected(null);
    fetchAll();
  };

  const filtered = orders.filter((o) => {
    if (tab === 'active') return o.status === 'pending' || o.status === 'processing';
    if (tab === 'done') return o.status === 'completed';
    return true;
  });

  const stats = {
    pending: orders.filter((o) => o.status === 'pending').length,
    processing: orders.filter((o) => o.status === 'processing').length,
    completed: orders.filter((o) => o.status === 'completed').length,
    totalCny: orders.filter((o) => o.status === 'completed').reduce((s, o) => s + Number(o.amount_cny), 0),
    totalMnt: orders.filter((o) => o.status === 'completed').reduce((s, o) => s + Number(o.amount_mnt), 0),
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Юанийн гуйвуулга</h1>
          <p className="text-sm text-muted-foreground">MNT → CNY гуйвуулгын захиалга удирдах</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAll}>
          <RefreshCw className="mr-2 h-4 w-4" /> Сэргээх
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Хүлээгдэж буй</div><div className="text-2xl font-bold">{stats.pending}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Гүйцэтгэж буй</div><div className="text-2xl font-bold">{stats.processing}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Илгээгдсэн ¥</div><div className="text-2xl font-bold">{fmt(stats.totalCny, 2)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Илгээгдсэн ₮</div><div className="text-2xl font-bold">{fmt(stats.totalMnt)}</div></CardContent></Card>
      </div>

      {/* Config */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><Settings2 className="h-4 w-4" /> Ханш ба тохиргоо</CardTitle>
          <CardDescription>Хэрэглэгч энэ ханшаар үнэ тооцно</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label>Үйлчилгээ идэвхтэй</Label>
              <p className="text-xs text-muted-foreground">Унтраахад хэрэглэгч шинэ хүсэлт үүсгэж чадахгүй</p>
            </div>
            <Switch checked={config.enabled} onCheckedChange={(v) => setConfig({ ...config, enabled: v })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Ханш (1 ¥ = ? ₮)</Label>
              <Input type="number" step="0.01" value={config.rate} onChange={(e) => setConfig({ ...config, rate: parseFloat(e.target.value) || 0 })} />
            </div>
            <div>
              <Label>Шимтгэл %</Label>
              <Input type="number" step="0.01" value={config.fee_percent} onChange={(e) => setConfig({ ...config, fee_percent: parseFloat(e.target.value) || 0 })} />
            </div>
            <div>
              <Label>Хамгийн бага ¥</Label>
              <Input type="number" value={config.min_cny} onChange={(e) => setConfig({ ...config, min_cny: parseFloat(e.target.value) || 0 })} />
            </div>
            <div>
              <Label>Хамгийн их ¥</Label>
              <Input type="number" value={config.max_cny} onChange={(e) => setConfig({ ...config, max_cny: parseFloat(e.target.value) || 0 })} />
            </div>
          </div>
          <div>
            <Label>Мэдэгдэл (үйлчилгээ хаалттай үед)</Label>
            <Textarea rows={2} value={config.note || ''} onChange={(e) => setConfig({ ...config, note: e.target.value })} />
          </div>
          <Button onClick={saveConfig} disabled={savingConfig}>
            {savingConfig && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Хадгалах
          </Button>
        </CardContent>
      </Card>

      {/* Orders */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Захиалгууд</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
            <TabsList>
              <TabsTrigger value="active">Идэвхтэй ({stats.pending + stats.processing})</TabsTrigger>
              <TabsTrigger value="done">Илгээгдсэн ({stats.completed})</TabsTrigger>
              <TabsTrigger value="all">Бүгд ({orders.length})</TabsTrigger>
            </TabsList>
            <TabsContent value={tab} className="mt-4 space-y-2">
              {filtered.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">Захиалга алга</div>
              ) : (
                filtered.map((o) => (
                  <div key={o.id} className="rounded-lg border p-3 hover:bg-muted/40">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold">{fmt(Number(o.amount_cny), 2)} ¥</span>
                          <Badge className={STATUS_STYLE[o.status]}>{STATUS_LABEL[o.status]}</Badge>
                          <Badge variant="outline">{o.receiver_type === 'alipay' ? 'Alipay' : 'WeChat'}</Badge>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {fmt(Number(o.amount_mnt))} ₮ · ханш {fmt(Number(o.rate))} · шимтгэл {fmt(Number(o.fee))}₮
                        </div>
                        <div className="mt-1 text-sm">
                          <span className="font-medium">{o.receiver_name}</span> · <span className="font-mono text-xs">{o.receiver_account}</span>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {o.profile?.phone || '—'}
                          {o.profile?.full_name ? ` · ${o.profile.full_name}` : ''}
                          {' · '}
                          {new Date(o.created_at).toLocaleString('mn-MN')}
                        </div>
                        {o.note && <div className="mt-1 text-xs">📝 {o.note}</div>}
                        {o.admin_note && <div className="mt-1 rounded bg-primary/5 p-1.5 text-xs">Админ: {o.admin_note}</div>}
                      </div>
                      <Button size="sm" onClick={() => openEdit(o)}>Удирдах</Button>
                    </div>
                  </div>
                ))
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Захиалга удирдах</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3">
              <div className="rounded-lg bg-muted/40 p-3 text-sm">
                <div>{fmt(Number(selected.amount_cny), 2)} ¥ = {fmt(Number(selected.amount_mnt))} ₮</div>
                <div className="text-xs text-muted-foreground">
                  {selected.receiver_type === 'alipay' ? 'Alipay' : 'WeChat'} · {selected.receiver_name}
                </div>
                <div className="font-mono text-xs">{selected.receiver_account}</div>
              </div>
              <div>
                <Label>Төлөв</Label>
                <Select value={newStatus} onValueChange={(v) => setNewStatus(v as RemittanceStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Хүлээгдэж буй</SelectItem>
                    <SelectItem value="processing">Гүйцэтгэж буй</SelectItem>
                    <SelectItem value="completed">Илгээгдсэн ✓</SelectItem>
                    <SelectItem value="rejected">Татгалзсан</SelectItem>
                    <SelectItem value="cancelled">Цуцлагдсан</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Админы тэмдэглэл (хэрэглэгч харна)</Label>
                <Textarea rows={2} value={adminNote} onChange={(e) => setAdminNote(e.target.value)} />
              </div>
              <div>
                <Label>Баримт/Screenshot URL (заавал биш)</Label>
                <Input value={proofUrl} onChange={(e) => setProofUrl(e.target.value)} placeholder="https://..." />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}><X className="mr-1 h-4 w-4" />Хаах</Button>
            <Button onClick={saveStatus} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Check className="mr-1 h-4 w-4" />Хадгалах
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
