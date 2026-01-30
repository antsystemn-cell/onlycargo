import { useState } from 'react';
import { MapPin, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export default function ChinaAddress() {
  const { chinaWarehouseAddress, isLoading } = useSiteSettings();
  const { profile } = useAuth();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const userPhone = profile?.phone || '[Таны утасны дугаар]';
  
  const fullAddress = `收货人: ${chinaWarehouseAddress.receiver}
手机号码: ${chinaWarehouseAddress.phone}
所在地区: ${chinaWarehouseAddress.region}
详细地址: ${chinaWarehouseAddress.address} (ONLY-${userPhone})`;

  const handleCopyAll = async () => {
    try {
      await navigator.clipboard.writeText(fullAddress);
      setCopied(true);
      toast({
        title: 'Хуулагдлаа',
        description: 'Хаяг clipboard-д хуулагдлаа',
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: 'Алдаа',
        description: 'Хуулж чадсангүй',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-card px-4 py-3">
        <div className="mx-auto flex max-w-md items-center gap-2">
          <MapPin className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold">Хятад агуулахын хаяг</h1>
        </div>
      </header>

      <main className="flex-1 px-4 py-6">
        <div className="mx-auto max-w-md space-y-4">
          <Card className="border-primary/20 bg-gradient-to-br from-card to-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="h-4 w-4 text-primary" />
                Хүргэх хаяг
              </CardTitle>
              <CardDescription>
                Таобао, 1688, Пиндуодуо-аас захиалах үедээ энэ хаягийг оруулна уу
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3 rounded-lg bg-muted/50 p-4 font-mono text-sm">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">收货人 (Хүлээн авагч):</p>
                  <p className="font-medium">{chinaWarehouseAddress.receiver}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">手机号码 (Утас):</p>
                  <p className="font-medium">{chinaWarehouseAddress.phone}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">所在地区 (Бүс нутаг):</p>
                  <p className="font-medium">{chinaWarehouseAddress.region}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">详细地址 (Дэлгэрэнгүй хаяг):</p>
                  <p className="font-medium">
                    {chinaWarehouseAddress.address} <span className="text-primary font-bold">(ONLY-{userPhone})</span>
                  </p>
                </div>
              </div>

              <Button 
                onClick={handleCopyAll} 
                className="w-full"
                variant={copied ? 'outline' : 'default'}
              >
                {copied ? (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Хуулагдлаа!
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 h-4 w-4" />
                    Бүгдийг хуулах
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Зааварчилгаа</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                <li>Таобаогоос захиалга өгөхдөө дээрх хаягийг оруулна</li>
                <li className="font-medium text-foreground">
                  ONLY-{userPhone} гэж заавал бичнэ үү!
                </li>
                <li>Бараа агуулахад ирсний дараа манай системд бүртгэгдэнэ</li>
                <li>Бараа УБ-д ирмэгц мэдэгдэл явуулна</li>
              </ol>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
