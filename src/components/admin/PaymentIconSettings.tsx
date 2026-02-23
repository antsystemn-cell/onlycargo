import { useState, useRef } from 'react';
import { Upload, X, CreditCard } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { PaymentIconConfig } from '@/hooks/useSiteSettings';

interface PaymentIconSettingsProps {
  paymentIcons: PaymentIconConfig;
  onPaymentIconsChange: (icons: PaymentIconConfig) => void;
}

const PROVIDERS = [
  { key: 'qpay_icon_url' as const, label: 'QPay', description: 'QPay төлбөрийн icon' },
  { key: 'omniway_icon_url' as const, label: 'OmniWay', description: 'OmniWay төлбөрийн icon' },
  { key: 'storepay_icon_url' as const, label: 'Storepay', description: 'Storepay төлбөрийн icon' },
];

export function PaymentIconSettings({ paymentIcons, onPaymentIconsChange }: PaymentIconSettingsProps) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const handleUpload = async (providerKey: string, file: File) => {
    setUploading(providerKey);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `payment-icon-${providerKey}-${Date.now()}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('site-assets')
        .upload(fileName, file, { upsert: true });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('site-assets')
        .getPublicUrl(data.path);

      onPaymentIconsChange({
        ...paymentIcons,
        [providerKey]: urlData.publicUrl,
      });

      toast({ title: 'Icon амжилттай хуулагдлаа' });
    } catch (error) {
      console.error('Upload error:', error);
      toast({ title: 'Icon хуулахад алдаа гарлаа', variant: 'destructive' });
    } finally {
      setUploading(null);
    }
  };

  const handleRemove = (providerKey: string) => {
    const updated = { ...paymentIcons };
    delete updated[providerKey as keyof PaymentIconConfig];
    onPaymentIconsChange(updated);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CreditCard className="h-4 w-4" />
          Төлбөрийн хэрэгслийн icon
        </CardTitle>
        <CardDescription>Төлбөрийн хэрэгсэл бүрийн icon зураг тохируулах (PNG, JPG, SVG)</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {PROVIDERS.map((provider) => {
          const iconUrl = paymentIcons[provider.key];
          return (
            <div key={provider.key} className="flex items-center gap-3">
              {/* Preview */}
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border bg-muted/50 overflow-hidden">
                {iconUrl ? (
                  <img src={iconUrl} alt={provider.label} className="h-8 w-8 object-contain" />
                ) : (
                  <CreditCard className="h-5 w-5 text-muted-foreground" />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <Label className="text-sm font-medium">{provider.label}</Label>
                <p className="text-xs text-muted-foreground truncate">
                  {iconUrl ? 'Тохируулагдсан' : 'Анхдагч icon'}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1">
                {iconUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleRemove(provider.key)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRefs.current[provider.key]?.click()}
                  disabled={uploading === provider.key}
                >
                  {uploading === provider.key ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                </Button>
                <input
                  ref={(el) => { fileInputRefs.current[provider.key] = el; }}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUpload(provider.key, file);
                    e.target.value = '';
                  }}
                />
              </div>
            </div>
          );
        })}

        {/* URL input alternative */}
        <div className="border-t pt-4 space-y-3">
          <p className="text-xs text-muted-foreground">Эсвэл URL-ээр оруулах:</p>
          {PROVIDERS.map((provider) => (
            <div key={`url-${provider.key}`} className="space-y-1">
              <Label className="text-xs">{provider.label} URL</Label>
              <Input
                value={paymentIcons[provider.key] || ''}
                onChange={(e) =>
                  onPaymentIconsChange({ ...paymentIcons, [provider.key]: e.target.value || undefined })
                }
                placeholder={`${provider.label} icon URL`}
                className="h-8 text-xs"
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
