import { useState } from "react";
import { Users, Copy, Gift, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useReferral } from "@/hooks/useReferral";
import { formatPrice } from "@/lib/priceCalculation";
import { useToast } from "@/hooks/use-toast";

export function ReferralCard() {
  const { toast } = useToast();
  const { referralCode, totalReferrals, totalRewards, isLoading, applyReferralCode } = useReferral();
  const [inputCode, setInputCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  const handleCopyCode = async () => {
    if (!referralCode?.code) return;

    try {
      await navigator.clipboard.writeText(referralCode.code);
      setCopied(true);
      toast({ title: "Хуулагдлаа!" });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({ title: "Хуулж чадсангүй", variant: "destructive" });
    }
  };

  const handleApplyCode = async () => {
    if (!inputCode.trim()) return;

    setIsApplying(true);
    const result = await applyReferralCode(inputCode.trim());
    setIsApplying(false);

    if (result.success) {
      toast({ title: "Урилгын код амжилттай ашиглагдлаа!" });
      setInputCode("");
    } else {
      toast({ title: result.error || "Алдаа гарлаа", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-32" />
            <div className="h-10 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-gradient-to-br from-purple-500/10 to-transparent pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-5 w-5" />
          Найзаа урих
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        {/* My referral code */}
        {referralCode && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Миний урилгын код</Label>
            <div className="flex gap-2">
              <div className="flex-1 px-3 py-2 rounded-lg bg-muted font-mono text-lg font-bold text-center">
                {referralCode.code}
              </div>
              <Button size="icon" variant="outline" onClick={handleCopyCode}>
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="text-center p-3 rounded-lg bg-muted">
            <p className="text-2xl font-bold text-primary">{totalReferrals}</p>
            <p className="text-xs text-muted-foreground">Урьсан найз</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted">
            <p className="text-2xl font-bold text-green-600">{formatPrice(totalRewards)}</p>
            <p className="text-xs text-muted-foreground">Нийт урамшуулал</p>
          </div>
        </div>

        {/* Apply code */}
        <div className="space-y-2 pt-2 border-t">
          <Label className="text-xs">Урилгын код ашиглах</Label>
          <div className="flex gap-2">
            <Input
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value.toUpperCase())}
              placeholder="ONLY1234AB"
              maxLength={12}
            />
            <Button onClick={handleApplyCode} disabled={isApplying || !inputCode.trim()} size="sm">
              <Gift className="h-4 w-4 mr-1" />
              {isApplying ? "..." : "Ашиглах"}
            </Button>
          </div>
        </div>

        {/* Info */}
        <p className="text-xs text-muted-foreground">
          Найзаа урьж урамшуулал авна уу! Тус бүрээс 5,000₮ хэтэвчинд нэмэгдэнэ.
        </p>
      </CardContent>
    </Card>
  );
}
