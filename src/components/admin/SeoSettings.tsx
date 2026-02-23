import { useState, useRef } from 'react';
import { Search, Globe, Type, FileText, Hash, Share2, Upload, ImageIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GooglePreview, SocialPreview } from '@/components/seo/SeoPreviewSimulator';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface PageSeo {
  title: string;
  description: string;
  keywords: string;
  og_title: string;
  og_description: string;
  og_image?: string;
}

export type SeoSettingsData = Record<string, PageSeo>;

const PAGE_LABELS: Record<string, string> = {
  home: 'Нүүр хуудас',
  'my-cargo': 'Миний ачаа',
  calculator: 'Тооцоолуур',
  'china-address': 'Хятад хаяг',
  profile: 'Профайл',
  wallet: 'Хэтэвч',
  referral: 'Урилга',
};

interface SeoSettingsProps {
  seoSettings: SeoSettingsData;
  onSeoChange: (seo: SeoSettingsData) => void;
}

export function SeoSettings({ seoSettings, onSeoChange }: SeoSettingsProps) {
  const [activeTab, setActiveTab] = useState('home');
  const [uploadingOgImage, setUploadingOgImage] = useState(false);
  const ogImageInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const currentPage = seoSettings[activeTab] || {
    title: '', description: '', keywords: '', og_title: '', og_description: '', og_image: '',
  };

  const handleOgImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingOgImage(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `og-${activeTab}-${Date.now()}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('site-assets')
        .upload(fileName, file, { upsert: true });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('site-assets')
        .getPublicUrl(data.path);

      updateField('og_image', urlData.publicUrl);
      toast({ title: 'OG зураг амжилттай хуулагдлаа' });
    } catch (error) {
      console.error('OG image upload error:', error);
      toast({ title: 'Зураг хуулахад алдаа гарлаа', variant: 'destructive' });
    } finally {
      setUploadingOgImage(false);
    }
  };

  const updateField = (field: keyof PageSeo, value: string) => {
    onSeoChange({
      ...seoSettings,
      [activeTab]: { ...currentPage, [field]: value },
    });
  };

  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Search className="h-4 w-4" />
          SEO тохиргоо (Хуудас бүрээр)
        </CardTitle>
        <CardDescription>Хуудас бүрийн гарчиг, мета тайлбар, keywords тохируулах</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full flex-wrap h-auto gap-1">
            {Object.entries(PAGE_LABELS).map(([key, label]) => (
              <TabsTrigger key={key} value={key} className="text-xs">
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          {Object.keys(PAGE_LABELS).map((pageKey) => (
            <TabsContent key={pageKey} value={pageKey} className="space-y-4 mt-4">
              <div className="grid gap-4 md:grid-cols-2">
                {/* Form Fields */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <Type className="h-3.5 w-3.5" />
                      Гарчиг (Title)
                      <span className="ml-auto text-xs text-muted-foreground">
                        {currentPage.title.length}/60
                      </span>
                    </Label>
                    <Input
                      value={currentPage.title}
                      onChange={(e) => updateField('title', e.target.value)}
                      placeholder="Хуудасны гарчиг"
                      maxLength={70}
                    />
                    {currentPage.title.length > 60 && (
                      <p className="text-xs text-destructive">60 тэмдэгтээс хэтрэхгүй байхыг зөвлөж байна</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5" />
                      Мета тайлбар
                      <span className="ml-auto text-xs text-muted-foreground">
                        {currentPage.description.length}/160
                      </span>
                    </Label>
                    <Textarea
                      value={currentPage.description}
                      onChange={(e) => updateField('description', e.target.value)}
                      placeholder="Хуудасны тайлбар"
                      rows={2}
                      maxLength={200}
                    />
                    {currentPage.description.length > 160 && (
                      <p className="text-xs text-destructive">160 тэмдэгтээс хэтрэхгүй байхыг зөвлөж байна</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <Hash className="h-3.5 w-3.5" />
                      Keywords (заавал биш)
                    </Label>
                    <Input
                      value={currentPage.keywords}
                      onChange={(e) => updateField('keywords', e.target.value)}
                      placeholder="карго, тээвэр, хятад"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <Share2 className="h-3.5 w-3.5" />
                      OG гарчиг (сошиал)
                    </Label>
                    <Input
                      value={currentPage.og_title}
                      onChange={(e) => updateField('og_title', e.target.value)}
                      placeholder="Хоосон бол ерөнхий гарчиг ашиглагдана"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <Share2 className="h-3.5 w-3.5" />
                      OG тайлбар (сошиал)
                    </Label>
                    <Textarea
                      value={currentPage.og_description}
                      onChange={(e) => updateField('og_description', e.target.value)}
                      placeholder="Хоосон бол мета тайлбар ашиглагдана"
                      rows={2}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <ImageIcon className="h-3.5 w-3.5" />
                      OG зураг (сошиал)
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        value={currentPage.og_image || ''}
                        onChange={(e) => updateField('og_image', e.target.value)}
                        placeholder="Зургийн URL эсвэл хуулах"
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => ogImageInputRef.current?.click()}
                        disabled={uploadingOgImage}
                      >
                        {uploadingOgImage ? (
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : (
                          <Upload className="h-4 w-4" />
                        )}
                      </Button>
                      <input
                        ref={ogImageInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleOgImageUpload}
                      />
                    </div>
                    {currentPage.og_image && (
                      <div className="relative h-20 rounded-lg overflow-hidden border">
                        <img
                          src={currentPage.og_image}
                          alt="OG preview"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Зөвлөмж: 1200×630px хэмжээтэй зураг хамгийн тохиромжтой
                    </p>
                  </div>
                </div>

                {/* Preview Simulator */}
                <div className="space-y-4">
                  <GooglePreview
                    title={currentPage.title}
                    description={currentPage.description}
                  />
                  <SocialPreview
                    title={currentPage.title}
                    description={currentPage.description}
                    ogTitle={currentPage.og_title}
                    ogDescription={currentPage.og_description}
                    ogImage={currentPage.og_image}
                  />
                </div>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
