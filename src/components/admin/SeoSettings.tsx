import { useState, useEffect } from 'react';
import { Search, Globe, Type, FileText, Hash, Share2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GooglePreview, SocialPreview } from '@/components/seo/SeoPreviewSimulator';

export interface PageSeo {
  title: string;
  description: string;
  keywords: string;
  og_title: string;
  og_description: string;
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

  const currentPage = seoSettings[activeTab] || {
    title: '', description: '', keywords: '', og_title: '', og_description: '',
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
