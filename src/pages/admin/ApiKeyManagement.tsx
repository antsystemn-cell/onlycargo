import { useState, useEffect } from 'react';
import {
  Key, Plus, Trash2, Copy, Check, Eye, EyeOff,
  Shield, Clock, Activity, AlertTriangle, Globe, Search,
  DollarSign, BarChart3, RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader,
  DialogTitle, DialogTrigger, DialogFooter
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import WebhookMonitor from '@/components/admin/WebhookMonitor';

interface ApiKeyRow {
  id: string;
  name: string;
  key_prefix: string;
  is_active: boolean;
  allowed_branches: string[];
  allow_phone_search: boolean;
  allow_price: boolean;
  rate_limit_per_minute: number;
  rate_limit_per_day: number;
  expires_at: string | null;
  merchant_id: string | null;
  allowed_customer_codes: string[];
  last_used_at: string | null;
  last_used_ip: string | null;
  webhook_url: string | null;
  webhook_secret: string | null;
  webhook_events: string[];
  webhook_enabled: boolean;
  created_at: string;
  updated_at: string;
}

interface Branch {
  id: string;
  name: string;
  code: string;
}

interface UsageStats {
  total_requests: number;
  last_used: string | null;
  last_ip: string | null;
  errors_count: number;
}

async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export default function ApiKeyManagement() {
  const { toast } = useToast();
  const [apiKeys, setApiKeys] = useState<ApiKeyRow[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [usageStats, setUsageStats] = useState<Record<string, UsageStats>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newKeyRevealed, setNewKeyRevealed] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Create form
  const [newName, setNewName] = useState('');
  const [newBranches, setNewBranches] = useState<string[]>([]);
  const [newMerchantId, setNewMerchantId] = useState('');
  const [newCustomerCodes, setNewCustomerCodes] = useState('');
  const [newAllowPhone, setNewAllowPhone] = useState(false);
  const [newAllowPrice, setNewAllowPrice] = useState(false);
  const [newRateMinute, setNewRateMinute] = useState('60');
  const [newRateDay, setNewRateDay] = useState('10000');
  const [newExpiresAt, setNewExpiresAt] = useState('');
  const [newWebhookUrl, setNewWebhookUrl] = useState('');
  const [newWebhookEnabled, setNewWebhookEnabled] = useState(false);
  const [newWebhookSecret, setNewWebhookSecret] = useState<string | null>(null);
  const [revealedWebhookKeyId, setRevealedWebhookKeyId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Logs dialog
  const [logsKeyId, setLogsKeyId] = useState<string | null>(null);
  const [logs, setLogs] = useState<any[]>([]);

  const fetchApiKeys = async () => {
    const { data, error } = await supabase
      .from('api_keys')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching API keys:', error);
      return;
    }
    setApiKeys((data || []) as unknown as ApiKeyRow[]);

    // Fetch usage stats for each key
    const stats: Record<string, UsageStats> = {};
    for (const key of data || []) {
      const now = new Date();
      const dayAgo = new Date(now.getTime() - 86400000).toISOString();

      const [totalRes, lastRes, errorsRes] = await Promise.all([
        supabase
          .from('api_key_usage_logs')
          .select('*', { count: 'exact', head: true })
          .eq('api_key_id', key.id)
          .gte('created_at', dayAgo),
        supabase
          .from('api_key_usage_logs')
          .select('created_at, ip_address')
          .eq('api_key_id', key.id)
          .order('created_at', { ascending: false })
          .limit(1),
        supabase
          .from('api_key_usage_logs')
          .select('*', { count: 'exact', head: true })
          .eq('api_key_id', key.id)
          .gte('status_code', 400)
          .gte('created_at', dayAgo),
      ]);

      const lastEntry = lastRes.data?.[0];
      stats[key.id] = {
        total_requests: totalRes.count || 0,
        last_used: lastEntry?.created_at || null,
        last_ip: lastEntry?.ip_address || null,
        errors_count: errorsRes.count || 0,
      };
    }
    setUsageStats(stats);
  };

  const fetchBranches = async () => {
    const { data } = await supabase
      .from('branches')
      .select('id, name, code')
      .eq('is_active', true)
      .order('name');
    setBranches(data || []);
  };

  useEffect(() => {
    Promise.all([fetchApiKeys(), fetchBranches()]).then(() => setIsLoading(false));
  }, []);

  const handleCreate = async () => {
    if (!newName.trim()) {
      toast({ title: 'Нэр оруулна уу', variant: 'destructive' });
      return;
    }

    setIsCreating(true);
    try {
      // Generate key
      const rawKey = 'sk-' + crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
      const keyHash = await sha256(rawKey);
      const keyPrefix = rawKey.slice(0, 8);

      // Webhook secret (per key, plaintext for HMAC signing)
      const webhookSecret = newWebhookEnabled
        ? 'whsec_' + crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')
        : null;

      const { data: userData } = await supabase.auth.getUser();

      const insertData: any = {
        name: newName.trim(),
        key_hash: keyHash,
        key_prefix: keyPrefix,
        is_active: true,
        allowed_branches: newBranches,
        allow_phone_search: newAllowPhone,
        allow_price: newAllowPrice,
        rate_limit_per_minute: parseInt(newRateMinute) || 60,
        rate_limit_per_day: parseInt(newRateDay) || 10000,
        expires_at: newExpiresAt || null,
        merchant_id: newMerchantId.trim() || null,
        allowed_customer_codes: newCustomerCodes
          .split(',').map(s => s.trim()).filter(Boolean),
        webhook_url: newWebhookEnabled ? newWebhookUrl.trim() || null : null,
        webhook_secret: webhookSecret,
        webhook_enabled: newWebhookEnabled && !!newWebhookUrl.trim(),
        webhook_events: newWebhookEnabled ? ['shipment.status_changed'] : [],
        created_by: userData?.user?.id || null,
      };

      const { error } = await supabase.from('api_keys').insert(insertData);
      if (error) throw error;

      setNewKeyRevealed(rawKey);
      setNewWebhookSecret(webhookSecret);
      await fetchApiKeys();

      toast({ title: 'API key амжилттай үүсгэгдлээ' });
    } catch (error: any) {
      console.error('Create error:', error);
      toast({ title: 'Алдаа', description: error.message, variant: 'destructive' });
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    const { error } = await supabase
      .from('api_keys')
      .update({ is_active: !isActive })
      .eq('id', id);

    if (error) {
      toast({ title: 'Алдаа', variant: 'destructive' });
      return;
    }
    await fetchApiKeys();
    toast({ title: isActive ? 'Key идэвхгүйжүүллээ' : 'Key идэвхжүүллээ' });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Энэ API key-г устгах уу? Энэ үйлдэл буцаах боломжгүй.')) return;

    const { error } = await supabase.from('api_keys').delete().eq('id', id);
    if (error) {
      toast({ title: 'Устгахад алдаа гарлаа', variant: 'destructive' });
      return;
    }
    await fetchApiKeys();
    toast({ title: 'API key устгагдлаа' });
  };

  const fetchLogs = async (keyId: string) => {
    const { data } = await supabase
      .from('api_key_usage_logs')
      .select('*')
      .eq('api_key_id', keyId)
      .order('created_at', { ascending: false })
      .limit(100);
    setLogs(data || []);
    setLogsKeyId(keyId);
  };

  const resetCreateForm = () => {
    setNewName('');
    setNewBranches([]);
    setNewMerchantId('');
    setNewCustomerCodes('');
    setNewAllowPhone(false);
    setNewAllowPrice(false);
    setNewRateMinute('60');
    setNewRateDay('10000');
    setNewExpiresAt('');
    setNewWebhookUrl('');
    setNewWebhookEnabled(false);
    setNewWebhookSecret(null);
    setNewKeyRevealed(null);
    setCopiedKey(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Key className="h-6 w-6" />
            API Key Удирдлага
          </h1>
          <p className="text-muted-foreground">Гадны вэбсайтуудад зориулсан API key үүсгэх, удирдах</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => fetchApiKeys()}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Шинэчлэх
          </Button>
          <Dialog open={createDialogOpen} onOpenChange={(open) => {
            setCreateDialogOpen(open);
            if (!open) resetCreateForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Шинэ API Key
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              {newKeyRevealed ? (
                <>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-green-600">
                      <Check className="h-5 w-5" />
                      API Key амжилттай үүсгэгдлээ
                    </DialogTitle>
                    <DialogDescription>
                      <span className="text-destructive font-semibold">
                        Анхааруулга: Энэ key-г зөвхөн нэг удаа харуулна. Хуулж аваарай!
                      </span>
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label className="text-xs">ONLYCARGO_API_KEY</Label>
                      <div className="p-3 bg-muted rounded-lg font-mono text-sm break-all border-2 border-primary/20 mt-1">
                        {newKeyRevealed}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full mt-2"
                        onClick={() => {
                          navigator.clipboard.writeText(newKeyRevealed);
                          toast({ title: 'API key хуулагдлаа' });
                        }}
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        API key хуулах
                      </Button>
                    </div>
                    {newWebhookSecret && (
                      <div>
                        <Label className="text-xs">ONLYCARGO_WEBHOOK_SECRET</Label>
                        <div className="p-3 bg-muted rounded-lg font-mono text-xs break-all border mt-1">
                          {newWebhookSecret}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full mt-2"
                          onClick={() => {
                            navigator.clipboard.writeText(newWebhookSecret);
                            toast({ title: 'Webhook secret хуулагдлаа' });
                          }}
                        >
                          <Copy className="h-4 w-4 mr-2" />
                          Webhook secret хуулах
                        </Button>
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => { setCreateDialogOpen(false); resetCreateForm(); }}>
                      Хаах
                    </Button>
                  </DialogFooter>
                </>
              ) : (
                <>
                  <DialogHeader>
                    <DialogTitle>Шинэ API Key үүсгэх</DialogTitle>
                    <DialogDescription>Гадны вэбсайтад зориулсан хандалтын key</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Нэр / Тайлбар</Label>
                      <Input
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="Жишээ: Partner Site A"
                      />
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        Зөвшөөрөгдсөн салбарууд
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Сонгоогүй бол бүх салбарт хандах боломжтой
                      </p>
                      <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto p-2 border rounded">
                        {branches.map((b) => (
                          <label key={b.id} className="flex items-center gap-2 text-sm cursor-pointer">
                            <Checkbox
                              checked={newBranches.includes(b.id)}
                              onCheckedChange={(checked) => {
                                setNewBranches(prev =>
                                  checked
                                    ? [...prev, b.id]
                                    : prev.filter(id => id !== b.id)
                                );
                              }}
                            />
                            {b.name}
                          </label>
                        ))}
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <Label>Merchant ID (заавал биш)</Label>
                      <Input
                        value={newMerchantId}
                        onChange={(e) => setNewMerchantId(e.target.value)}
                        placeholder="Жишээ: only-hub"
                      />
                      <p className="text-xs text-muted-foreground">
                        Бөглөвөл зөвхөн энэ merchant-д хамаарах ачаа л харагдана
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label>Customer codes (таслалаар тусгаарлана, заавал биш)</Label>
                      <Input
                        value={newCustomerCodes}
                        onChange={(e) => setNewCustomerCodes(e.target.value)}
                        placeholder="CUS001, CUS002"
                      />
                    </div>

                    <Separator />

                    <div className="space-y-3">
                      <Label>Зөвшөөрлүүд</Label>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Search className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">Утасны дугаараар хайх</span>
                        </div>
                        <Switch checked={newAllowPhone} onCheckedChange={setNewAllowPhone} />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">Үнийн мэдээлэл харуулах</span>
                        </div>
                        <Switch checked={newAllowPrice} onCheckedChange={setNewAllowPrice} />
                      </div>
                    </div>

                    <Separator />

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Минутын лимит</Label>
                        <Input
                          type="number"
                          value={newRateMinute}
                          onChange={(e) => setNewRateMinute(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Өдрийн лимит</Label>
                        <Input
                          type="number"
                          value={newRateDay}
                          onChange={(e) => setNewRateDay(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Дуусах хугацаа (заавал биш)</Label>
                      <Input
                        type="datetime-local"
                        value={newExpiresAt}
                        onChange={(e) => setNewExpiresAt(e.target.value)}
                      />
                    </div>

                    <Separator />

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Webhook идэвхжүүлэх</Label>
                          <p className="text-xs text-muted-foreground">
                            Ачааны статус өөрчлөгдөх бүрд POST хүсэлт илгээнэ
                          </p>
                        </div>
                        <Switch checked={newWebhookEnabled} onCheckedChange={setNewWebhookEnabled} />
                      </div>
                      {newWebhookEnabled && (
                        <div className="space-y-2">
                          <Label>Webhook URL</Label>
                          <Input
                            value={newWebhookUrl}
                            onChange={(e) => setNewWebhookUrl(e.target.value)}
                            placeholder="https://onlyhub.example.com/api/webhooks/onlycargo"
                          />
                          <p className="text-xs text-muted-foreground">
                            Үүсгэсний дараа ONLYCARGO_WEBHOOK_SECRET автоматаар үүсгэгдэж нэг л удаа харуулна
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Болих</Button>
                    <Button onClick={handleCreate} disabled={isCreating}>
                      {isCreating ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
                      ) : (
                        <Key className="h-4 w-4 mr-2" />
                      )}
                      Үүсгэх
                    </Button>
                  </DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Keys list */}
      {apiKeys.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Key className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">API key үүсгээгүй байна</p>
            <p className="text-sm text-muted-foreground mt-1">
              Дээрх "Шинэ API Key" товч дарж эхний key-гээ үүсгээрэй
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {apiKeys.map((key) => {
            const stats = usageStats[key.id];
            const isExpired = key.expires_at && new Date(key.expires_at) < new Date();

            return (
              <Card key={key.id} className={!key.is_active || isExpired ? 'opacity-60' : ''}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-base">{key.name}</CardTitle>
                      <Badge variant={key.is_active && !isExpired ? 'default' : 'secondary'}>
                        {isExpired ? 'Хугацаа дууссан' : key.is_active ? 'Идэвхтэй' : 'Идэвхгүй'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fetchLogs(key.id)}
                      >
                        <BarChart3 className="h-4 w-4 mr-1" />
                        Логууд
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleActive(key.id, key.is_active)}
                      >
                        {key.is_active ? 'Идэвхгүйжүүлэх' : 'Идэвхжүүлэх'}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(key.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Key prefix</p>
                      <p className="font-mono">{key.key_prefix}...</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Салбарууд</p>
                      <p>{key.allowed_branches?.length ? `${key.allowed_branches.length} салбар` : 'Бүгд'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Rate limit</p>
                      <p>{key.rate_limit_per_minute}/мин, {key.rate_limit_per_day}/өдөр</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Дуусах</p>
                      <p>{key.expires_at ? format(new Date(key.expires_at), 'yyyy-MM-dd') : 'Хязгааргүй'}</p>
                    </div>
                  </div>

                  <Separator className="my-3" />

                  <div className="flex items-center gap-6 text-sm">
                    <div className="flex items-center gap-1">
                      <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>Өнөөдрийн хүсэлт: {stats?.total_requests || 0}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>
                        Сүүлийн хандалт: {stats?.last_used
                          ? format(new Date(stats.last_used), 'MM/dd HH:mm')
                          : 'Байхгүй'}
                      </span>
                    </div>
                    {stats?.errors_count ? (
                      <div className="flex items-center gap-1 text-destructive">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        <span>Алдаа: {stats.errors_count}</span>
                      </div>
                    ) : null}
                    <div className="flex items-center gap-2 ml-auto">
                      {key.allow_phone_search && (
                        <Badge variant="outline" className="text-xs">
                          <Search className="h-3 w-3 mr-1" />
                          Утасаар хайх
                        </Badge>
                      )}
                      {key.allow_price && (
                        <Badge variant="outline" className="text-xs">
                          <DollarSign className="h-3 w-3 mr-1" />
                          Үнэ
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Usage Logs Dialog */}
      <Dialog open={!!logsKeyId} onOpenChange={(open) => !open && setLogsKeyId(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>API хандалтын логууд</DialogTitle>
            <DialogDescription>Сүүлийн 100 хүсэлт</DialogDescription>
          </DialogHeader>
          <div className="overflow-auto flex-1">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Endpoint</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Огноо</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-mono text-xs">{log.endpoint}</TableCell>
                    <TableCell>
                      <Badge variant={log.status_code < 400 ? 'default' : 'destructive'}>
                        {log.status_code}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{log.ip_address}</TableCell>
                    <TableCell className="text-xs">
                      {format(new Date(log.created_at), 'MM/dd HH:mm:ss')}
                    </TableCell>
                  </TableRow>
                ))}
                {logs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      Лог байхгүй байна
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      <WebhookMonitor />

      {/* API Documentation Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" />
            API Баримтжуулалт
          </CardTitle>
          <CardDescription>Гадны вэбсайтуудад зориулсан интеграцийн заавар</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted rounded-lg p-4 space-y-3 text-sm">
            <p className="font-semibold">Base URL:</p>
            <code className="block bg-background p-2 rounded text-xs">
              {`https://xgyalkuyuontavstyokg.supabase.co/functions/v1/external-api`}
            </code>

            <p className="font-semibold mt-4">Authentication:</p>
            <code className="block bg-background p-2 rounded text-xs">
              {`Authorization: Bearer sk-your-api-key-here`}
            </code>
            <p className="text-xs text-muted-foreground">эсвэл</p>
            <code className="block bg-background p-2 rounded text-xs">
              {`X-API-Key: sk-your-api-key-here`}
            </code>

            <Separator />

            <div className="space-y-2">
              <p className="font-semibold">Shipment endpoints:</p>
              <div className="space-y-1">
                <code className="text-xs text-primary">GET /shipments</code>
                <p className="text-xs text-muted-foreground pl-4">
                  Жагсаалт. Query: page, pageSize (max 100), sort, order, status, q,
                  merchant_id, customer_code, from, to
                </p>
              </div>
              <div className="space-y-1">
                <code className="text-xs text-primary">GET /shipments/:trackNumber</code>
                <p className="text-xs text-muted-foreground pl-4">Дэлгэрэнгүй</p>
              </div>
              <div className="space-y-1">
                <code className="text-xs text-primary">GET /shipments/:trackNumber/status</code>
              </div>
              <div className="space-y-1">
                <code className="text-xs text-primary">GET /shipments/:trackNumber/fee</code>
                <p className="text-xs text-muted-foreground pl-4">allow_price шаардлагатай</p>
              </div>
              <div className="space-y-1">
                <code className="text-xs text-primary">GET /shipments/:trackNumber/history</code>
              </div>
              <div className="space-y-1">
                <code className="text-xs text-primary">GET /shipments/:trackNumber/images</code>
              </div>
              <div className="space-y-1">
                <code className="text-xs text-primary">GET /shipments/:trackNumber/location</code>
              </div>
              <div className="space-y-1">
                <code className="text-xs text-primary">POST /shipments/:trackNumber/status</code>
                <p className="text-xs text-muted-foreground pl-4">{'{ status }'} — стандарт статусаар шинэчлэх</p>
              </div>
              <div className="space-y-1">
                <code className="text-xs text-primary">GET /health</code>
              </div>
            </div>

            <Separator />

            <div className="space-y-1">
              <p className="font-semibold">Стандарт статусууд:</p>
              <ul className="list-disc list-inside text-xs text-muted-foreground space-y-1">
                <li><code>created</code> — бүртгэгдсэн</li>
                <li><code>received</code> — Эрээнд хүлээн авсан</li>
                <li><code>in_transit</code> — тээвэрлэгдэж байна</li>
                <li><code>processing</code> — агуулахад боловсруулж байна</li>
                <li><code>ready_for_pickup</code> / <code>arrived</code> — агуулахад бэлэн</li>
                <li><code>completed</code> — хүлээлгэж өгсөн</li>
                <li><code>archived</code> — архивлагдсан (read-only)</li>
              </ul>
            </div>

            <Separator />

            <div className="space-y-1">
              <p className="font-semibold">Жишээ curl:</p>
              <code className="block bg-background p-2 rounded text-xs whitespace-pre-wrap">
{`curl -H "Authorization: Bearer sk-..." \\
  "https://xgyalkuyuontavstyokg.supabase.co/functions/v1/external-api/shipments?pageSize=20&status=in_transit"`}
              </code>
            </div>

            <Separator />

            <div className="space-y-1">
              <p className="font-semibold">Нууцлал:</p>
              <ul className="list-disc list-inside text-xs text-muted-foreground space-y-1">
                <li>Утас: 8866**** маскладсан</li>
                <li>Үнэ: key тохиргооноос хамаарна</li>
                <li>Админ тэмдэглэл, дотоод ID: хэзээ ч буцаахгүй</li>
                <li>Merchant scope бүхий key зөвхөн өөрийн ачааг харна</li>
              </ul>
            </div>

            <Separator />

            <div className="space-y-1">
              <p className="font-semibold">Хариуны код:</p>
              <div className="text-xs space-y-1 font-mono">
                <p>200 OK · 400 буруу параметр · 401 түлхүүр буруу · 403 эрх хүрэхгүй</p>
                <p>404 олдсонгүй · 429 rate limit (Retry-After) · 5xx Retry-After: 1</p>
              </div>
            </div>

            <Separator />

            <div className="space-y-1">
              <p className="font-semibold">Webhook signature форматууд (бүх 3-г зэрэг илгээнэ):</p>
              <ul className="list-disc list-inside text-xs text-muted-foreground space-y-1">
                <li><code>X-OnlyCargo-Signature: t=&lt;ts&gt;,v1=&lt;hmac(ts.body)&gt;</code></li>
                <li><code>X-Signature: sha256=&lt;hmac(body)&gt;</code></li>
                <li><code>X-Hub-Signature-256: sha256=&lt;hmac(body)&gt;</code> (GitHub-style)</li>
                <li><code>X-OnlyCargo-Signature-Plain: &lt;hex&gt;</code></li>
              </ul>
              <p className="text-xs text-muted-foreground">Idempotency: <code>event_id</code>-р давхардал хорино. Retry: 1м → 5м → 15м → 1ц → 6ц → 24ц (нийт 6 оролдлого).</p>
            </div>

            <Separator />

            <div className="space-y-1">
              <p className="font-semibold">Хуучин endpoint (backward compatible):</p>
              <code className="text-xs text-muted-foreground block">
                GET /cargo/by-tracking · /cargo/by-phone · /cargo/history · POST /cargo/status
              </code>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
