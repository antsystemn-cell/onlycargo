import { useState, useEffect, useRef } from 'react';
import { Settings, Upload, Save, Image, FileText, MapPin, Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useSiteSettings } from '@/hooks/useSiteSettings';

export default function SiteSettings() {
  const { toast } = useToast();
  const { logoUrl, chinaWarehouseAddress, homepageBanner, pricing, refresh } = useSiteSettings();
  const [isSaving, setIsSaving] = useState(false);

  // Logo
  const [logoFile, setLogoFile] = useState<File | null>(null);

  // Banner
  const [bannerEnabled, setBannerEnabled] = useState(homepageBanner.enabled);
  const [bannerTitle, setBannerTitle] = useState(homepageBanner.title);
  const [bannerDescription, setBannerDescription] = useState(homepageBanner.description);
  const [bannerBackgroundImage, setBannerBackgroundImage] = useState(homepageBanner.backgroundImage || '');
  const [uploadingBannerImage, setUploadingBannerImage] = useState(false);
  const bannerImageInputRef = useRef<HTMLInputElement>(null);

  // China Address
  const [addressReceiver, setAddressReceiver] = useState(chinaWarehouseAddress.receiver);
  const [addressPhone, setAddressPhone] = useState(chinaWarehouseAddress.phone);
  const [addressRegion, setAddressRegion] = useState(chinaWarehouseAddress.region);
  const [addressDetail, setAddressDetail] = useState(chinaWarehouseAddress.address);

  // Pricing
  const [pricePerKg, setPricePerKg] = useState(pricing.per_kg.toString());
  const [pricePerCubicMeter, setPricePerCubicMeter] = useState(pricing.per_cubic_meter.toString());
  const [chinaPricePerKg, setChinaPricePerKg] = useState(pricing.china_per_kg.toString());

  useEffect(() => {
    setBannerEnabled(homepageBanner.enabled);
    setBannerTitle(homepageBanner.title);
    setBannerDescription(homepageBanner.description);
    setBannerBackgroundImage(homepageBanner.backgroundImage || '');
    setAddressReceiver(chinaWarehouseAddress.receiver);
    setAddressPhone(chinaWarehouseAddress.phone);
    setAddressRegion(chinaWarehouseAddress.region);
    setAddressDetail(chinaWarehouseAddress.address);
    setPricePerKg(pricing.per_kg.toString());
    setPricePerCubicMeter(pricing.per_cubic_meter.toString());
    setChinaPricePerKg(pricing.china_per_kg.toString());
  }, [homepageBanner, chinaWarehouseAddress, pricing]);

  const handleLogoUpload = async () => {
    if (!logoFile) return null;

    const fileExt = logoFile.name.split('.').pop();
    const fileName = `logo-${Date.now()}.${fileExt}`;

    const { data, error } = await supabase.storage
      .from('site-assets')
      .upload(fileName, logoFile, { upsert: true });

    if (error) throw error;

    const { data: urlData } = supabase.storage
      .from('site-assets')
      .getPublicUrl(data.path);

    return urlData.publicUrl;
  };

  const handleBannerImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingBannerImage(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `banner-bg-${Date.now()}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('site-assets')
        .upload(fileName, file, { upsert: true });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('site-assets')
        .getPublicUrl(data.path);

      setBannerBackgroundImage(urlData.publicUrl);
      toast({ title: 'Зураг амжилттай хуулагдлаа' });
    } catch (error) {
      console.error('Upload error:', error);
      toast({ title: 'Зураг хуулахад алдаа гарлаа', variant: 'destructive' });
    } finally {
      setUploadingBannerImage(false);
    }
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      let newLogoUrl = logoUrl;

      if (logoFile) {
        newLogoUrl = await handleLogoUpload() || logoUrl;
      }

      const updates = [
        { key: 'logo_url', value: JSON.stringify(newLogoUrl) },
        {
          key: 'homepage_banner',
          value: JSON.stringify({
            enabled: bannerEnabled,
            title: bannerTitle,
            description: bannerDescription,
            backgroundImage: bannerBackgroundImage,
          }),
        },
        {
          key: 'china_warehouse_address',
          value: JSON.stringify({
            receiver: addressReceiver,
            phone: addressPhone,
            region: addressRegion,
            address: addressDetail,
          }),
        },
        {
          key: 'pricing',
          value: JSON.stringify({
            per_kg: parseFloat(pricePerKg) || 8000,
            per_cubic_meter: parseFloat(pricePerCubicMeter) || 312000,
            china_per_kg: parseFloat(chinaPricePerKg) || 2500,
          }),
        },
      ];

      for (const update of updates) {
        const { error } = await supabase
          .from('site_settings')
          .update({ value: JSON.parse(update.value), updated_at: new Date().toISOString() })
          .eq('key', update.key);

        if (error) throw error;
      }

      await refresh();
      toast({ title: 'Амжилттай', description: 'Тохиргоо хадгалагдлаа' });
      setLogoFile(null);
    } catch (error) {
      console.error('Save error:', error);
      toast({ title: 'Алдаа', description: 'Хадгалж чадсангүй', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Сайтын тохиргоо</h1>
          <p className="text-muted-foreground">Лого, баннер, хаяг болон үнийн тохиргоо</p>
        </div>
        <Button onClick={handleSaveAll} disabled={isSaving}>
          {isSaving ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Бүгдийг хадгалах
            </>
          )}
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Logo Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Image className="h-4 w-4" />
              Лого
            </CardTitle>
            <CardDescription>Сайтын лого солих</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <img
                src={logoFile ? URL.createObjectURL(logoFile) : logoUrl}
                alt="Current logo"
                className="h-16 w-16 rounded-lg border object-contain p-2"
              />
              <div>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                  className="w-auto"
                />
                <p className="text-xs text-muted-foreground mt-1">PNG, JPG, SVG</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Banner Settings with Background Image */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" />
              Нүүр хуудасны мэдээллийн баннер
            </CardTitle>
            <CardDescription>Гарчиг, тайлбар болон арын зураг</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Идэвхтэй</Label>
              <Switch checked={bannerEnabled} onCheckedChange={setBannerEnabled} />
            </div>
            <div className="space-y-2">
              <Label>Гарчиг</Label>
              <Input value={bannerTitle} onChange={(e) => setBannerTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Тайлбар</Label>
              <Textarea value={bannerDescription} onChange={(e) => setBannerDescription(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Арын зураг</Label>
              <div className="flex gap-2">
                <Input
                  value={bannerBackgroundImage}
                  onChange={(e) => setBannerBackgroundImage(e.target.value)}
                  placeholder="Зургийн URL эсвэл хуулах"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => bannerImageInputRef.current?.click()}
                  disabled={uploadingBannerImage}
                >
                  {uploadingBannerImage ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                </Button>
                <input
                  ref={bannerImageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleBannerImageUpload}
                />
              </div>
              {bannerBackgroundImage && (
                <div className="relative h-24 rounded-lg overflow-hidden border">
                  <img
                    src={bannerBackgroundImage}
                    alt="Banner preview"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/50 to-transparent flex items-end p-3">
                    <span className="text-white text-sm font-medium truncate">{bannerTitle}</span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* China Address Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="h-4 w-4" />
              Хятад агуулахын хаяг
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>收货人 (Хүлээн авагч)</Label>
              <Input value={addressReceiver} onChange={(e) => setAddressReceiver(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>手机号码 (Утас)</Label>
              <Input value={addressPhone} onChange={(e) => setAddressPhone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>所在地区 (Бүс нутаг)</Label>
              <Input value={addressRegion} onChange={(e) => setAddressRegion(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>详细地址 (Дэлгэрэнгүй хаяг)</Label>
              <Textarea value={addressDetail} onChange={(e) => setAddressDetail(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        {/* Pricing Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calculator className="h-4 w-4" />
              Үнийн тохиргоо
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>1 кг-ийн үнэ (₮)</Label>
              <Input
                type="number"
                value={pricePerKg}
                onChange={(e) => setPricePerKg(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>1 шоо метрийн үнэ (₮)</Label>
              <Input
                type="number"
                value={pricePerCubicMeter}
                onChange={(e) => setPricePerCubicMeter(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Хятадын агуулах - 1 кг үнэ (₮)</Label>
              <Input
                type="number"
                value={chinaPricePerKg}
                onChange={(e) => setChinaPricePerKg(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
