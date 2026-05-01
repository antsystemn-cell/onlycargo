import { useState, useEffect, useRef } from 'react';
import { Settings, Upload, Save, Image, FileText, MapPin, Calculator, TrendingDown, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { FaviconSettings } from '@/components/admin/FaviconSettings';
import { SeoSettings, type SeoSettingsData } from '@/components/admin/SeoSettings';
import { PaymentIconSettings } from '@/components/admin/PaymentIconSettings';
import type { PaymentIconConfig, ChinaWarehouseAddress, KoreaWarehouseAddress } from '@/hooks/useSiteSettings';

export default function SiteSettings() {
  const { toast } = useToast();
  const { logoUrl, faviconUrl, chinaWarehouseAddresses, koreaWarehouseAddresses, homepageBanner, pricing, paymentIcons, seoSettings, refresh } = useSiteSettings();
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

  // China addresses (array)
  const [chinaAddresses, setChinaAddresses] = useState<ChinaWarehouseAddress[]>(chinaWarehouseAddresses);
  const [koreaAddresses, setKoreaAddresses] = useState<KoreaWarehouseAddress[]>(koreaWarehouseAddresses);

  // Pricing - Normal rates
  const [pricePerKg, setPricePerKg] = useState(pricing.per_kg.toString());
  const [pricePerCubicMeter, setPricePerCubicMeter] = useState(pricing.per_cubic_meter.toString());
  const [chinaPricePerKg, setChinaPricePerKg] = useState(pricing.china_per_kg.toString());

  // Pricing - Tiered rates
  const [tierWeightThreshold, setTierWeightThreshold] = useState(pricing.tier_weight_threshold.toString());
  const [tierWeightPrice, setTierWeightPrice] = useState(pricing.tier_weight_price.toString());
  const [tierVolumeThreshold, setTierVolumeThreshold] = useState(pricing.tier_volume_threshold.toString());
  const [tierVolumePrice, setTierVolumePrice] = useState(pricing.tier_volume_price.toString());

  // Favicon
  const [currentFaviconUrl, setCurrentFaviconUrl] = useState(faviconUrl);

  // SEO
  const [currentSeoSettings, setCurrentSeoSettings] = useState<SeoSettingsData>(seoSettings || {});
  const [currentPaymentIcons, setCurrentPaymentIcons] = useState<PaymentIconConfig>(paymentIcons || {});

  useEffect(() => {
    setBannerEnabled(homepageBanner.enabled);
    setBannerTitle(homepageBanner.title);
    setBannerDescription(homepageBanner.description);
    setBannerBackgroundImage(homepageBanner.backgroundImage || '');
    setChinaAddresses(chinaWarehouseAddresses);
    setKoreaAddresses(koreaWarehouseAddresses);
    setPricePerKg(pricing.per_kg.toString());
    setPricePerCubicMeter(pricing.per_cubic_meter.toString());
    setChinaPricePerKg(pricing.china_per_kg.toString());
    setTierWeightThreshold(pricing.tier_weight_threshold.toString());
    setTierWeightPrice(pricing.tier_weight_price.toString());
    setTierVolumeThreshold(pricing.tier_volume_threshold.toString());
    setTierVolumePrice(pricing.tier_volume_price.toString());
    setCurrentFaviconUrl(faviconUrl);
    setCurrentSeoSettings(seoSettings || {});
    setCurrentPaymentIcons(paymentIcons || {});
  }, [homepageBanner, chinaWarehouseAddresses, koreaWarehouseAddresses, pricing, faviconUrl, seoSettings, paymentIcons]);


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

  // China address helpers
  const addChinaAddress = () => {
    setChinaAddresses(prev => [
      ...prev,
      {
        id: `addr-${Date.now()}`,
        label: '',
        receiver: '',
        phone: '',
        region: '',
        address: '',
        prefix: 'ONLY',
      },
    ]);
  };

  const removeChinaAddress = (id: string) => {
    setChinaAddresses(prev => prev.filter(a => a.id !== id));
  };

  const updateChinaAddress = (id: string, field: keyof ChinaWarehouseAddress, value: string) => {
    setChinaAddresses(prev =>
      prev.map(a => (a.id === id ? { ...a, [field]: value } : a))
    );
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
        { key: 'favicon_url', value: JSON.stringify(currentFaviconUrl) },
        {
          key: 'china_warehouse_addresses',
          value: JSON.stringify(chinaAddresses),
        },
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
          key: 'pricing',
          value: JSON.stringify({
            per_kg: parseFloat(pricePerKg) || 8000,
            per_cubic_meter: parseFloat(pricePerCubicMeter) || 312000,
            china_per_kg: parseFloat(chinaPricePerKg) || 2500,
            tier_weight_threshold: parseFloat(tierWeightThreshold) || 1000,
            tier_weight_price: parseFloat(tierWeightPrice) || 830,
            tier_volume_threshold: parseFloat(tierVolumeThreshold) || 10,
            tier_volume_price: parseFloat(tierVolumePrice) || 260000,
          }),
        },
        { key: 'seo_settings', value: JSON.stringify(currentSeoSettings) },
        { key: 'payment_icons', value: JSON.stringify(currentPaymentIcons) },
      ];

      for (const update of updates) {
        const { error } = await supabase
          .from('site_settings')
          .upsert({ key: update.key, value: JSON.parse(update.value), updated_at: new Date().toISOString() }, { onConflict: 'key' });

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
        {/* Favicon Settings */}
        <FaviconSettings faviconUrl={currentFaviconUrl} onFaviconChange={setCurrentFaviconUrl} />

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

        {/* China Warehouse Addresses - Multiple */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="h-4 w-4" />
              Хятад агуулахын хаягууд
            </CardTitle>
            <CardDescription>Олон агуулахын хаяг нэмж, хэрэглэгчид сонголт өгнө</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {chinaAddresses.map((addr, idx) => (
              <div key={addr.id} className="rounded-lg border bg-muted/30 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm">Хаяг #{idx + 1}</h4>
                  {chinaAddresses.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => removeChinaAddress(addr.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Устгах
                    </Button>
                  )}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Нэр / Байршил</Label>
                    <Input
                      value={addr.label}
                      onChange={(e) => updateChinaAddress(addr.id, 'label', e.target.value)}
                      placeholder="Жишээ: Эрээн агуулах"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Угтвар (Prefix)</Label>
                    <Input
                      value={addr.prefix}
                      onChange={(e) => updateChinaAddress(addr.id, 'prefix', e.target.value.toUpperCase())}
                      placeholder="ONLY"
                    />
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">收货人 (Хүлээн авагч)</Label>
                    <Input
                      value={addr.receiver}
                      onChange={(e) => updateChinaAddress(addr.id, 'receiver', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">手机号码 (Утас)</Label>
                    <Input
                      value={addr.phone}
                      onChange={(e) => updateChinaAddress(addr.id, 'phone', e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">所在地区 (Бүс нутаг)</Label>
                  <Input
                    value={addr.region}
                    onChange={(e) => updateChinaAddress(addr.id, 'region', e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">详细地址 (Дэлгэрэнгүй хаяг)</Label>
                  <Textarea
                    value={addr.address}
                    onChange={(e) => updateChinaAddress(addr.id, 'address', e.target.value)}
                    rows={2}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Жишээ: {addr.prefix || 'ONLY'}-88665525
                </p>
              </div>
            ))}
            <Button variant="outline" className="w-full" onClick={addChinaAddress}>
              <Plus className="h-4 w-4 mr-2" />
              Шинэ хаяг нэмэх
            </Button>
          </CardContent>
        </Card>

        {/* Pricing Settings - Normal Rates */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calculator className="h-4 w-4" />
              Үнийн тохиргоо - Энгийн үнэ
            </CardTitle>
            <CardDescription>Стандарт тээврийн үнэ</CardDescription>
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

        {/* Tiered Pricing Settings */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingDown className="h-4 w-4" />
              Том ачааны хямдралтай үнэ (Tiered Pricing)
            </CardTitle>
            <CardDescription>
              Тодорхой хэмжээнээс их ачаанд хямдралтай үнэ хэрэглэгдэнэ
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2">
              {/* Weight Tier */}
              <div className="space-y-4 p-4 rounded-lg border bg-muted/30">
                <h4 className="font-medium flex items-center gap-2">
                  <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs">Жингээр</span>
                  Жингийн хямдрал
                </h4>
                <div className="space-y-2">
                  <Label>Босго (кг)</Label>
                  <Input
                    type="number"
                    value={tierWeightThreshold}
                    onChange={(e) => setTierWeightThreshold(e.target.value)}
                    placeholder="1000"
                  />
                  <p className="text-xs text-muted-foreground">
                    Энэ кг-ээс дээш жинтэй ачаанд хямдралтай үнэ хэрэглэгдэнэ
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Хямдралтай үнэ (₮/кг)</Label>
                  <Input
                    type="number"
                    value={tierWeightPrice}
                    onChange={(e) => setTierWeightPrice(e.target.value)}
                    placeholder="830"
                  />
                  <p className="text-xs text-muted-foreground">
                    Босгоноос дээш жинтэй бол 1кг = {tierWeightPrice}₮
                  </p>
                </div>
              </div>

              {/* Volume Tier */}
              <div className="space-y-4 p-4 rounded-lg border bg-muted/30">
                <h4 className="font-medium flex items-center gap-2">
                  <span className="bg-secondary/50 text-secondary-foreground px-2 py-0.5 rounded text-xs">Эзлэхүүнээр</span>
                  Эзлэхүүний хямдрал
                </h4>
                <div className="space-y-2">
                  <Label>Босго (м³)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={tierVolumeThreshold}
                    onChange={(e) => setTierVolumeThreshold(e.target.value)}
                    placeholder="10"
                  />
                  <p className="text-xs text-muted-foreground">
                    Энэ м³-ээс дээш эзлэхүүнтэй ачаанд хямдралтай үнэ хэрэглэгдэнэ
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Хямдралтай үнэ (₮/м³)</Label>
                  <Input
                    type="number"
                    value={tierVolumePrice}
                    onChange={(e) => setTierVolumePrice(e.target.value)}
                    placeholder="260000"
                  />
                  <p className="text-xs text-muted-foreground">
                    Босгоноос дээш эзлэхүүнтэй бол 1м³ = {tierVolumePrice}₮
                  </p>
                </div>
              </div>
            </div>

            <Separator className="my-4" />

            <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
              <p className="font-medium mb-1">Жишээ тооцоолол:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>
                  1200кг ачаа: 1200 × {tierWeightPrice}₮ = {(1200 * parseFloat(tierWeightPrice || '830')).toLocaleString()}₮ 
                  <span className="text-muted-foreground ml-1">(энгийн үнээр {(1200 * parseFloat(pricePerKg || '8000')).toLocaleString()}₮ байх байсан)</span>
                </li>
                <li>
                  15м³ ачаа: 15 × {tierVolumePrice}₮ = {(15 * parseFloat(tierVolumePrice || '260000')).toLocaleString()}₮
                  <span className="text-muted-foreground ml-1">(энгийн үнээр {(15 * parseFloat(pricePerCubicMeter || '312000')).toLocaleString()}₮ байх байсан)</span>
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* SEO Settings */}
        <SeoSettings seoSettings={currentSeoSettings} onSeoChange={setCurrentSeoSettings} />

        {/* Payment Icon Settings */}
        <PaymentIconSettings paymentIcons={currentPaymentIcons} onPaymentIconsChange={setCurrentPaymentIcons} />
      </div>
    </div>
  );
}
