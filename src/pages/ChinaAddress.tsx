import { useState, useEffect } from 'react';
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
import { supabase } from '@/integrations/supabase/client';
import type { Branch } from '@/types/cargo';

export default function ChinaAddress() {
  const { chinaWarehouseAddress, isLoading: settingsLoading } = useSiteSettings();
  const { profile, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [branchesLoading, setBranchesLoading] = useState(true);

  // Fetch all active branches
  useEffect(() => {
    const fetchBranches = async () => {
      setBranchesLoading(true);
      const { data } = await supabase
        .from('branches')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (data) {
        setBranches(data as Branch[]);
        // Auto-select user's default branch or first branch
        if (profile?.default_branch_id && data.some(b => b.id === profile.default_branch_id)) {
          setSelectedBranchId(profile.default_branch_id);
        } else if (data.length === 1) {
          setSelectedBranchId(data[0].id);
        }
      }
      setBranchesLoading(false);
    };
    fetchBranches();
  }, [profile?.default_branch_id]);

  const selectedBranch = branches.find(b => b.id === selectedBranchId);
  const userPhone = profile?.phone || '[Таны утасны дугаар]';

  // Parse branch china_address_text
  const parseChinaAddressText = (text: string) => {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const parsed: Record<string, string> = {};
    for (const line of lines) {
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) continue;
      const key = line.slice(0, colonIdx).trim();
      const val = line.slice(colonIdx + 1).trim();
      if (key.includes('收货人')) parsed.receiver = val;
      else if (key.includes('手机号码')) parsed.phone = val;
      else if (key.includes('所在地区')) parsed.region = val;
      else if (key.includes('详细地址')) parsed.address = val;
    }
    return parsed;
  };

  const addressPrefix = selectedBranch?.china_address_prefix || 'ONLY';
  const addressText = selectedBranch?.china_address_text || null;
  const branchParsed = addressText ? parseChinaAddressText(addressText) : null;

  const displayAddress = {
    receiver: branchParsed?.receiver || chinaWarehouseAddress.receiver,
    phone: branchParsed?.phone || chinaWarehouseAddress.phone,
    region: branchParsed?.region || chinaWarehouseAddress.region,
    address: branchParsed?.address || chinaWarehouseAddress.address,
  };

  const fullAddress = `收货人: ${displayAddress.receiver}
手机号码: ${displayAddress.phone}
所在地区: ${displayAddress.region}
详细地址: ${displayAddress.address} (${addressPrefix}-${userPhone})`;

  const handleCopyAll = async () => {
    if (!selectedBranchId) {
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
      toast({ title: 'Хуулагдлаа', description: 'Хаяг clipboard-д хуулагдлаа' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: 'Алдаа', description: 'Хуулж чадсангүй', variant: 'destructive' });
    }
  };

  const isLoading = settingsLoading || authLoading || branchesLoading;

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const hasBranch = !!selectedBranchId;

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
          {/* Branch Selector - local only, not saved */}
          <Card>
            <CardContent className="pt-4 space-y-2">
              <Label className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                Салбар сонгох
              </Label>
              <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
                <SelectTrigger className="w-full overflow-hidden">
                  <SelectValue placeholder="Салбар сонгоно уу" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      <div className="flex flex-col items-start min-w-0 max-w-full">
                        <span className="truncate w-full">{branch.name}</span>
                        {branch.address && (
                          <span className="text-xs text-muted-foreground truncate w-full">{branch.address}</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground pl-6">
                Ачаагаа авах салбараа сонгож хаягийг харна уу.
              </p>
            </CardContent>
          </Card>

          {/* Address Card */}
          <Card className={`border-primary/20 bg-gradient-to-br from-card to-primary/5 ${!hasBranch ? 'opacity-60' : ''}`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="h-4 w-4 text-primary" />
                Хүргэх хаяг
                {selectedBranch && (
                  <span className="text-xs font-normal text-muted-foreground">— {selectedBranch.name}</span>
                )}
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
                  <><Check className="mr-2 h-4 w-4" />Хуулагдлаа!</>
                ) : (
                  <><Copy className="mr-2 h-4 w-4" />Бүгдийг хуулах</>
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