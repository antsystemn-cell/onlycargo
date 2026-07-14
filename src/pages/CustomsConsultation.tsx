import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import {
  FileCheck2, Loader2, Clock, CheckCircle2, XCircle, RefreshCw,
  Wallet as WalletIcon, Paperclip, X, FileText, Image as ImageIcon,
} from 'lucide-react';
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

type CustomsStatus = 'pending' | 'processing' | 'completed' | 'rejected' | 'cancelled';

interface Attachment {
  path: string;
  url: string;
  name: string;
}

interface CustomsOrder {
  id: string;
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
  created_at: string;
}

interface CustomsConfig {
  enabled: boolean;
  fee: number;
  note?: string;
}

const DEFAULT_CONFIG: CustomsConfig = { enabled: true, fee: 5000 };

const STATUS_LABEL: Record<CustomsStatus, string> = {
  pending: 'Хүлээгдэж байна',
  processing: 'Судалж байна',
  completed: 'Зөвлөгөө өгсөн',
  rejected: 'Татгалзсан',
  cancelled: 'Цуцлагдсан',
};

const STATUS_STYLE: Record<CustomsStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  processing: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  cancelled: 'bg-muted text-muted-foreground',
};

const schema = z.object({
  description: z.string().trim().min(3, 'Барааны тайлбарыг дэлгэрэнгүй бичнэ үү').max(2000),
  value: z.number().nullable(),
  quantity: z.number().nullable(),
  phone: z.string().trim().max(20).optional(),
  notes: z.string().trim().max(1000).optional(),
});

const MAX_FILE_MB = 10;
const MAX_FILES = 5;

export default function CustomsConsultation() {
  const { user, isLoading: authLoading, profile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { balance, refreshWallet } = useWallet();

  const [config, setConfig] = useState<CustomsConfig>(DEFAULT_CONFIG);
  const [orders, setOrders] = useState<CustomsOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [description, setDescription] = useState('');
  const [productValue, setProductValue] = useState('');
  const [quantity, setQuantity] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (profile?.phone && !phone) setPhone(profile.phone);
  }, [profile]);

  const fetchConfig = async () => {
    const { data } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'customs_consultation_config')
      .maybeSingle();
    if (data?.value) setConfig({ ...DEFAULT_CONFIG, ...(data.value as Partial<CustomsConfig>) });
  };

  const fetchOrders = async () => {
    if (!user) return;
    const { data, error } = await (supabase as any)
      .from('customs_consultation_orders')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (!error && data) setOrders(data as CustomsOrder[]);
  };

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      await Promise.all([fetchConfig(), fetchOrders()]);
      setLoading(false);
    })();
  }, [user]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!user || files.length === 0) return;
    if (attachments.length + files.length > MAX_FILES) {
      toast({ title: 'Хэт олон файл', description: `Дээд тал нь ${MAX_FILES} файл хавсаргана`, variant: 'destructive' });
      return;
    }
    setUploading(true);
    try {
      const uploaded: Attachment[] = [];
      for (const file of files) {
        if (file.size > MAX_FILE_MB * 1024 * 1024) {
          toast({ title: 'Файл том', description: `${file.name} — ${MAX_FILE_MB}MB-с бага байх ёстой`, variant: 'destructive' });
          continue;
        }
        const ext = file.name.split('.').pop() || 'bin';
        const path = `customs/${user.id}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error } = await supabase.storage.from('cargo-photos').upload(path, file, {
          contentType: file.type,
          upsert: false,
        });
        if (error) {
          toast({ title: 'Байршуулах алдаа', description: error.message, variant: 'destructive' });
          continue;
        }
        const { data: { publicUrl } } = supabase.storage.from('cargo-photos').getPublicUrl(path);
        uploaded.push({ path, url: publicUrl, name: file.name });
      }
      setAttachments((prev) => [...prev, ...uploaded]);
    } finally {
      setUploading(false);
    }
  };

  const removeAttachment = async (att: Attachment) => {
    setAttachments((prev) => prev.filter((a) => a.path !== att.path));
    supabase.storage.from('cargo-photos').remove([att.path]).catch(() => {});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!config.enabled) {
      toast({ title: 'Үйлчилгээ түр хаалттай', description: config.note || 'Дараа дахин оролдоно уу.', variant: 'destructive' });
      return;
    }
    const valNum = productValue ? Number(productValue) : null;
    const qtyNum = quantity ? Number(quantity) : null;
    const parsed = schema.safeParse({
      description,
      value: valNum,
      quantity: qtyNum,
      phone: phone || undefined,
      notes: notes || undefined,
    });
    if (!parsed.success) {
      toast({ title: 'Талбар шалгана уу', description: parsed.error.errors[0].message, variant: 'destructive' });
      return;
    }
    if (balance < config.fee) {
      toast({
        title: 'Үлдэгдэл хүрэлцэхгүй',
        description: `Зөвлөгөөний төлбөр ${formatPrice(config.fee)}. Хэтэвчээ цэнэглэнэ үү.`,
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    const { error } = await (supabase as any).rpc('create_customs_consultation_order', {
      p_product_description: description.trim(),
      p_product_value: valNum,
      p_quantity: qtyNum,
      p_contact_phone: phone.trim() || null,
      p_notes: notes.trim() || null,
      p_attachments: attachments as any,
      p_fee: config.fee,
    });
    setSubmitting(false);

    if (error) {
      toast({ title: 'Алдаа гарлаа', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Хүсэлт илгээгдлээ', description: 'Мэргэжилтэн танд удахгүй хариу өгнө.' });
    setDescription('');
    setProductValue('');
    setQuantity('');
    setNotes('');
    setAttachments([]);
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
          <FileCheck2 className="h-3.5 w-3.5" />
          Гаалийн бүрдүүлэлт
        </div>
        <div className="text-2xl font-bold">Мэргэжлийн зөвлөгөө</div>
        <p className="mt-1 text-xs text-white/80">Нэг зөвлөгөө = {formatPrice(config.fee)}</p>
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
          <CardTitle className="text-base">Шинэ хүсэлт</CardTitle>
          <CardDescription>
            Гаалийн татвар, тариф, бүрдүүлэлтийн процессын талаар мэргэжлийн зөвлөгөө авах хүсэлтээ илгээнэ үү.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="desc">Барааны тайлбар *</Label>
              <Textarea
                id="desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ямар бараа, ямар материал, зориулалт..."
                rows={3}
                maxLength={2000}
                disabled={!config.enabled}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="val">Барааны үнэ (₮ эсвэл ¥)</Label>
                <Input
                  id="val"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  value={productValue}
                  onChange={(e) => setProductValue(e.target.value)}
                  disabled={!config.enabled}
                  placeholder="0"
                />
              </div>
              <div>
                <Label htmlFor="qty">Тоо ширхэг</Label>
                <Input
                  id="qty"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  disabled={!config.enabled}
                  placeholder="0"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="phone">Холбоо барих утас</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="99XXXXXX"
                maxLength={20}
                disabled={!config.enabled}
              />
            </div>

            <div>
              <Label htmlFor="notes">Нэмэлт тэмдэглэл</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="HS код, төрөл, нэмэлт асуулт..."
                rows={2}
                maxLength={1000}
                disabled={!config.enabled}
              />
            </div>

            <div>
              <Label>Инвойс / баримт (заавал биш)</Label>
              <div className="mt-1 space-y-2">
                {attachments.map((att) => {
                  const isImg = /\.(jpe?g|png|gif|webp)$/i.test(att.name);
                  return (
                    <div key={att.path} className="flex items-center gap-2 rounded-lg border bg-muted/30 p-2 text-xs">
                      {isImg ? <ImageIcon className="h-4 w-4 shrink-0" /> : <FileText className="h-4 w-4 shrink-0" />}
                      <span className="flex-1 truncate">{att.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => removeAttachment(att)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  );
                })}
                {attachments.length < MAX_FILES && (
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground hover:border-primary hover:text-primary">
                    {uploading ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Байршуулж байна...</>
                    ) : (
                      <><Paperclip className="h-4 w-4" /> Файл хавсаргах ({attachments.length}/{MAX_FILES})</>
                    )}
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*,application/pdf"
                      multiple
                      onChange={handleFile}
                      disabled={uploading || !config.enabled}
                    />
                  </label>
                )}
                <p className="text-[11px] text-muted-foreground">Зураг эсвэл PDF, нэг файл {MAX_FILE_MB}MB хүртэл.</p>
              </div>
            </div>

            <div className="rounded-lg bg-muted/50 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Зөвлөгөөний төлбөр:</span>
                <span className="font-semibold">{formatPrice(config.fee)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Төлбөрийн эх үүсвэр:</span>
                <span className="font-medium">Хэтэвч</span>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={submitting || uploading || !config.enabled || balance < config.fee}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Хүсэлт илгээх ({formatPrice(config.fee)})
            </Button>
            {balance < config.fee && (
              <Button type="button" variant="outline" className="w-full" onClick={() => navigate('/wallet')}>
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
                  <p className="flex-1 text-sm font-medium">{o.product_description}</p>
                  <Badge className={STATUS_STYLE[o.status]}>
                    {o.status === 'completed' && <CheckCircle2 className="mr-1 h-3 w-3" />}
                    {o.status === 'pending' && <Clock className="mr-1 h-3 w-3" />}
                    {(o.status === 'cancelled' || o.status === 'rejected') && <XCircle className="mr-1 h-3 w-3" />}
                    {STATUS_LABEL[o.status]}
                  </Badge>
                </div>
                {(o.product_value != null || o.quantity != null) && (
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {o.product_value != null && <span>Үнэ: <span className="font-medium">{o.product_value}</span></span>}
                    {o.quantity != null && <span>Тоо: <span className="font-medium">{o.quantity}</span></span>}
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
                <div className="rounded-lg bg-muted/40 p-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Төлбөр:</span>
                    <span className="font-medium">{formatPrice(Number(o.fee))}</span>
                  </div>
                  {o.admin_quoted_cost != null && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Тооцоолсон гаалийн зардал:</span>
                      <span className="font-semibold text-primary">{formatPrice(Number(o.admin_quoted_cost))}</span>
                    </div>
                  )}
                </div>
                {o.admin_response && (
                  <div className="rounded bg-primary/5 p-2 text-xs">
                    <p className="font-semibold mb-0.5">Мэргэжилтний зөвлөгөө:</p>
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
