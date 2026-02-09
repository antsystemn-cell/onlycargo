import { useState, useEffect } from 'react';
import { MapPin, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import BranchSelector from '@/components/profile/BranchSelector';
import type { Branch } from '@/types/cargo';

export default function ChinaAddress() {
  const { chinaWarehouseAddress, isLoading: settingsLoading } = useSiteSettings();
  const { profile, isLoading: authLoading, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [branch, setBranch] = useState<Branch | null>(null);
  const [branchLoading, setBranchLoading] = useState(false);

  // Fetch the user's selected branch details
  useEffect(() => {
    if (profile?.default_branch_id) {
      setBranchLoading(true);
      supabase
        .from('branches')
        .select('*')
        .eq('id', profile.default_branch_id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setBranch(data as Branch);
          setBranchLoading(false);
        });
    } else {
      setBranch(null);
    }
  }, [profile?.default_branch_id]);

  const userPhone = profile?.phone || '[Таны утасны дугаар]';

  // Use branch-specific address if available, otherwise fallback to site settings
  const addressPrefix = branch?.china_address_prefix || 'ONLY';
  const addressText = branch?.china_address_text || null;

  // If branch has custom china_address_text, parse it; otherwise use site settings
  const displayAddress = {
    receiver: chinaWarehouseAddress.receiver,
    phone: chinaWarehouseAddress.phone,
    region: chinaWarehouseAddress.region,
    address: chinaWarehouseAddress.address,
  };

  const fullAddress = `收货人: ${displayAddress.receiver}
手机号码: ${displayAddress.phone}
所在地区: ${displayAddress.region}
详细地址: ${displayAddress.address} (${addressPrefix}-${userPhone})`;

  const handleCopyAll = async () => {
    if (!profile?.default_branch_id) {
      toast({
        title: 'Салбар сонгоно уу',
        description: 'Хаяг хуулахын өмнө салбараа сонгоно уу',
        variant: 'destructive',
      });
      return;
    }
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

  const isLoading = settingsLoading || authLoading;

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const hasBranch = !!profile?.default_branch_id;

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
          {/* Branch Selector */}
          {profile && (
            <Card>
              <CardContent className="pt-4 space-y-1">
                <BranchSelector
                  profile={profile}
                  onBranchChange={refreshProfile}
                />
                <p className="text-xs text-muted-foreground pl-6">
                  Ачаагаа аваx салбараа сонгоно уу.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Address Card */}
          <Card className={`border-primary/20 bg-gradient-to-br from-card to-primary/5 ${!hasBranch ? 'opacity-60' : ''}`}>
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
              {!hasBranch && (
                <div className="p-3 bg-warning/10 border border-warning/20 rounded-lg">
                  <p className="text-sm text-warning-foreground font-medium">
                    Эхлээд салбараа сонгоно уу
                  </p>
                </div>
              )}
              <div className="space-y-3 rounded-lg bg-muted/50 p-4 font-mono text-sm">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">收货人 (Хүлээн авагч):</p>
                  <p className="font-medium">{displayAddress.receiver}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">手机号码 (Утас):</p>
                  <p className="font-medium">{displayAddress.phone}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">所在地区 (Бүс нутаг):</p>
                  <p className="font-medium">{displayAddress.region}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">详细地址 (Дэлгэрэнгүй хаяг):</p>
                  <p className="font-medium">
                    {displayAddress.address}{' '}
                    <span className="text-primary font-bold">
                      ({addressPrefix}-{userPhone})
                    </span>
                  </p>
                </div>
              </div>

              <Button
                onClick={handleCopyAll}
                className="w-full"
                variant={copied ? 'outline' : 'default'}
                disabled={!hasBranch}
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
                  {addressPrefix}-{userPhone} гэж заавал бичнэ үү!
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
