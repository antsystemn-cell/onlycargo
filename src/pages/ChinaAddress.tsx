import { useState } from 'react';
import { MapPin, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export default function ChinaAddress() {
  const { chinaWarehouseAddresses, isLoading: settingsLoading } = useSiteSettings();
  const { profile, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');

  // Auto-select first address if only one exists
  const effectiveSelectedId = selectedAddressId || (chinaWarehouseAddresses.length === 1 ? chinaWarehouseAddresses[0].id : '');
  const selectedAddress = chinaWarehouseAddresses.find(a => a.id === effectiveSelectedId);
  const userPhone = profile?.phone || '[Таны утасны дугаар]';

  const fullAddress = selectedAddress
    ? `收货人: ${selectedAddress.receiver}\n手机号码: ${selectedAddress.phone}\n所在地区: ${selectedAddress.region}\n详细地址: ${selectedAddress.address} (${selectedAddress.prefix}-${userPhone})`
    : '';

  const handleCopyAll = async () => {
    if (!selectedAddress) {
      toast({
        title: 'Хаяг сонгоно уу',
        description: 'Хаяг хуулахын өмнө агуулахаа сонгоно уу',
        variant: 'destructive',
      });
      return;
    }
    try {
      await navigator.clipboard.writeText(fullAddress);
      setCopied(true);
      toast({ title: 'Хуулагдлаа', description: 'Хаяг clipboard-д хуулагдлаа' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: 'Алдаа', description: 'Хуулж чадсангүй', variant: 'destructive' });
    }
  };

  const isLoading = settingsLoading || authLoading;

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const hasSelection = !!selectedAddress;

  return (
    <div className="flex flex-col">
      <header className="sticky top-0 z-40 border-b bg-card px-4 py-3">
        <div className="mx-auto flex max-w-md items-center gap-2">
          <MapPin className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold">Хятад агуулахын хаяг</h1>
        </div>
      </header>

      <main className="flex-1 px-4 py-6">
        <div className="mx-auto max-w-md space-y-4">
          {/* Address Selector */}
          {chinaWarehouseAddresses.length > 1 && (
            <Card>
              <CardContent className="pt-4 space-y-2">
                <Label className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  Агуулах сонгох
                </Label>
                <Select value={effectiveSelectedId} onValueChange={setSelectedAddressId}>
                  <SelectTrigger className="w-full overflow-hidden">
                    <SelectValue placeholder="Агуулах сонгоно уу" />
                  </SelectTrigger>
                  <SelectContent>
                    {chinaWarehouseAddresses.map((addr) => (
                      <SelectItem key={addr.id} value={addr.id}>
                        <span>{addr.label || 'Хаяг'}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground pl-6">
                  Ачаагаа илгээх агуулахаа сонгож хаягийг харна уу.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Address Card */}
          <Card className={`border-primary/20 bg-gradient-to-br from-card to-primary/5 ${!hasSelection ? 'opacity-60' : ''}`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="h-4 w-4 text-primary" />
                Хүргэх хаяг
                {selectedAddress && (
                  <span className="text-xs font-normal text-muted-foreground">— {selectedAddress.label}</span>
                )}
              </CardTitle>
              <CardDescription>
                Таобао, 1688, Пиндуодуо-аас захиалах үедээ энэ хаягийг оруулна уу
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!hasSelection && (
                <div className="p-3 bg-warning/10 border border-warning/20 rounded-lg">
                  <p className="text-sm text-warning-foreground font-medium">
                    Эхлээд агуулахаа сонгоно уу
                  </p>
                </div>
              )}
              {selectedAddress && (
                <>
                  <div className="space-y-3 rounded-lg bg-muted/50 p-4 font-mono text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">收货人 (Хүлээн авагч):</p>
                      <p className="font-medium">{selectedAddress.receiver}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">手机号码 (Утас):</p>
                      <p className="font-medium">{selectedAddress.phone}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">所在地区 (Бүс нутаг):</p>
                      <p className="font-medium">{selectedAddress.region}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">详细地址 (Дэлгэрэнгүй хаяг):</p>
                      <p className="font-medium">
                        {selectedAddress.address}{' '}
                        <span className="text-primary font-bold">
                          ({selectedAddress.prefix}-{userPhone})
                        </span>
                      </p>
                    </div>
                  </div>

                  <Button
                    onClick={handleCopyAll}
                    className="w-full"
                    variant={copied ? 'outline' : 'default'}
                  >
                    {copied ? (
                      <><Check className="mr-2 h-4 w-4" />Хуулагдлаа!</>
                    ) : (
                      <><Copy className="mr-2 h-4 w-4" />Бүгдийг хуулах</>
                    )}
                  </Button>
                </>
              )}
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
                  {selectedAddress?.prefix || 'ONLY'}-{userPhone} гэж заавал бичнэ үү!
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
