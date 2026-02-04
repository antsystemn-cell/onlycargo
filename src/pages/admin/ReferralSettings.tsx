import { useState, useEffect } from 'react';
import { Gift, Save, Percent, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatPrice } from '@/lib/priceCalculation';

interface ReferralSettings {
  referral_enabled: boolean;
  registration_bonus: number;
  percentage_bonus_rate: number;
  min_payment_for_bonus: number;
}

export default function ReferralSettingsPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [stats, setStats] = useState({ totalReferrals: 0, totalRewardsPaid: 0 });
  
  const [settings, setSettings] = useState<ReferralSettings>({
    referral_enabled: true,
    registration_bonus: 1000,
    percentage_bonus_rate: 0.5,
    min_payment_for_bonus: 10000,
  });

  useEffect(() => {
    fetchSettings();
    fetchStats();
  }, []);

  const fetchSettings = async () => {
    try {
      const keys = ['referral_enabled', 'registration_bonus', 'percentage_bonus_rate', 'min_payment_for_bonus'];
      
      const { data } = await supabase
        .from('site_settings')
        .select('key, value')
        .in('key', keys);

      if (data) {
        const newSettings = { ...settings };
        data.forEach((item) => {
          if (item.key === 'referral_enabled') {
            newSettings.referral_enabled = item.value === true || item.value === 'true';
          } else if (item.key === 'registration_bonus') {
            newSettings.registration_bonus = Number(item.value) || 1000;
          } else if (item.key === 'percentage_bonus_rate') {
            newSettings.percentage_bonus_rate = Number(item.value) || 0.5;
          } else if (item.key === 'min_payment_for_bonus') {
            newSettings.min_payment_for_bonus = Number(item.value) || 10000;
          }
        });
        setSettings(newSettings);
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const { count: totalReferrals } = await supabase
        .from('referrals')
        .select('*', { count: 'exact', head: true });

      const { data: paidData } = await supabase
        .from('referrals')
        .select('reward_amount')
        .eq('reward_paid', true);

      const totalRewardsPaid = paidData?.reduce((sum, r) => sum + (r.reward_amount || 0), 0) || 0;

      setStats({
        totalReferrals: totalReferrals || 0,
        totalRewardsPaid,
      });
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updates = [
        { key: 'referral_enabled', value: settings.referral_enabled },
        { key: 'registration_bonus', value: settings.registration_bonus },
        { key: 'percentage_bonus_rate', value: settings.percentage_bonus_rate },
        { key: 'min_payment_for_bonus', value: settings.min_payment_for_bonus },
      ];

      for (const update of updates) {
        await supabase
          .from('site_settings')
          .upsert({ key: update.key, value: update.value }, { onConflict: 'key' });
      }

      toast({ title: 'Тохиргоо хадгалагдлаа' });
    } catch (error) {
      toast({ title: 'Хадгалж чадсангүй', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Урилгын тохиргоо</h1>
        <p className="text-muted-foreground">Урилга & урамшууллын дүрэм тохируулах</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/10">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-3xl font-bold">{stats.totalReferrals}</p>
                <p className="text-sm text-muted-foreground">Нийт урилга</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-green-500/10">
                <Gift className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-3xl font-bold text-green-600">{formatPrice(stats.totalRewardsPaid)}</p>
                <p className="text-sm text-muted-foreground">Олгосон урамшуулал</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5" />
            Урамшууллын тохиргоо
          </CardTitle>
          <CardDescription>
            Урилгын систем болон урамшууллын дүнг тохируулна
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable/Disable */}
          <div className="flex items-center justify-between">
            <div>
              <Label>Урилгын систем идэвхтэй</Label>
              <p className="text-sm text-muted-foreground">
                Хэрэглэгчид найзуудаа урих боломжтой эсэх
              </p>
            </div>
            <Switch
              checked={settings.referral_enabled}
              onCheckedChange={(checked) => setSettings({ ...settings, referral_enabled: checked })}
            />
          </div>

          <Separator />

          {/* Registration Bonus */}
          <div className="space-y-2">
            <Label>Бүртгэлийн урамшуулал (₮)</Label>
            <p className="text-sm text-muted-foreground">
              Шинэ хэрэглэгч бүртгүүлэхэд урьсан хүнд олгох урамшуулал
            </p>
            <Input
              type="number"
              value={settings.registration_bonus}
              onChange={(e) => setSettings({ ...settings, registration_bonus: parseInt(e.target.value) || 0 })}
              min={0}
              step={500}
            />
          </div>

          {/* Percentage Bonus */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Percent className="h-4 w-4" />
              Хувийн урамшуулал (%)
            </Label>
            <p className="text-sm text-muted-foreground">
              Урьсан хэрэглэгчийн төлбөрөөс олгох хувь
            </p>
            <Input
              type="number"
              value={settings.percentage_bonus_rate}
              onChange={(e) => setSettings({ ...settings, percentage_bonus_rate: parseFloat(e.target.value) || 0 })}
              min={0}
              max={10}
              step={0.1}
            />
          </div>

          {/* Min Payment */}
          <div className="space-y-2">
            <Label>Хамгийн бага төлбөрийн хэмжээ (₮)</Label>
            <p className="text-sm text-muted-foreground">
              Хувийн урамшуулал тооцоход шаардлагатай хамгийн бага төлбөрийн хэмжээ
            </p>
            <Input
              type="number"
              value={settings.min_payment_for_bonus}
              onChange={(e) => setSettings({ ...settings, min_payment_for_bonus: parseInt(e.target.value) || 0 })}
              min={0}
              step={1000}
            />
          </div>

          <Button className="w-full" onClick={handleSave} disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Хадгалж байна...' : 'Хадгалах'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
