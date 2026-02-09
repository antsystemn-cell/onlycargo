import { useState, useRef } from 'react';
import { Upload, Image } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface FaviconSettingsProps {
  faviconUrl: string;
  onFaviconChange: (url: string) => void;
}

export function FaviconSettings({ faviconUrl, onFaviconChange }: FaviconSettingsProps) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.includes('png')) {
      toast({ title: 'Зөвхөн PNG файл зөвшөөрөгдөнө', variant: 'destructive' });
      return;
    }

    setUploading(true);
    try {
      const fileName = `favicon-${Date.now()}.png`;
      const { data, error } = await supabase.storage
        .from('site-assets')
        .upload(fileName, file, { upsert: true });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('site-assets')
        .getPublicUrl(data.path);

      setPreviewUrl(urlData.publicUrl);
      onFaviconChange(urlData.publicUrl);
      toast({ title: 'Favicon амжилттай хуулагдлаа' });
    } catch (error) {
      console.error('Upload error:', error);
      toast({ title: 'Favicon хуулахад алдаа гарлаа', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const displayUrl = previewUrl || faviconUrl;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Image className="h-4 w-4" />
          Favicon
        </CardTitle>
        <CardDescription>Сайтын favicon (PNG формат)</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-lg border bg-muted flex items-center justify-center overflow-hidden">
            {displayUrl && displayUrl !== '/favicon.ico' ? (
              <img src={displayUrl} alt="Favicon" className="h-8 w-8 object-contain" />
            ) : (
              <Image className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 space-y-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  PNG хуулах
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground">32x32 эсвэл 64x64 хэмжээтэй PNG зураг</p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/png"
            className="hidden"
            onChange={handleUpload}
          />
        </div>
      </CardContent>
    </Card>
  );
}
