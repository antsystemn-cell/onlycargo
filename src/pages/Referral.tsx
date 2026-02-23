import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Copy, Check, Gift, ArrowLeft, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useReferral } from "@/hooks/useReferral";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice } from "@/lib/priceCalculation";
import { format } from "date-fns";

interface ReferredUser {
  id: string;
  referred_id: string;
  created_at: string;
  reward_amount: number | null;
  reward_paid: boolean;
  referred_phone?: string;
  referred_name?: string;
}

export default function ReferralPage() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const { referralCode, totalReferrals, totalRewards, isLoading, applyReferralCode } = useReferral();

  const [referredUsers, setReferredUsers] = useState<ReferredUser[]>([]);
  const [inputCode, setInputCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  useEffect(() => {
    if (user) {
      fetchReferredUsers();
    }
  }, [user]);

  const fetchReferredUsers = async () => {
    if (!user) return;

    try {
      const { data } = await supabase
        .from("referrals")
        .select("*")
        .eq("referrer_id", user.id)
        .order("created_at", { ascending: false });

      if (data) {
        // Fetch profile info for each referred user
        const usersWithProfiles = await Promise.all(
          data.map(async (ref) => {
            const { data: profile } = await supabase
              .from("profiles")
              .select("phone, full_name")
              .eq("id", ref.referred_id)
              .single();

            return {
              ...ref,
              referred_phone: profile?.phone || "—",
              referred_name: profile?.full_name || "—",
            };
          }),
        );

        setReferredUsers(usersWithProfiles);
      }
    } catch (error) {
      console.error("Failed to fetch referred users:", error);
    }
  };

  const handleCopyCode = async () => {
    if (!referralCode?.code) return;

    try {
      await navigator.clipboard.writeText(referralCode.code);
      setCopied(true);
      toast({ title: "Код хуулагдлаа!" });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({ title: "Хуулж чадсангүй", variant: "destructive" });
    }
  };

  const handleCopyLink = async () => {
    if (!referralCode?.code) return;

    const link = `${window.location.origin}/auth?ref=${referralCode.code}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedLink(true);
      toast({ title: "Линк хуулагдлаа!" });
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (error) {
      toast({ title: "Хуулж чадсангүй", variant: "destructive" });
    }
  };

  const handleShare = async () => {
    if (!referralCode?.code) return;

    const link = `${window.location.origin}/auth?ref=${referralCode.code}`;
    const text = `OnlyCargo ашиглаж бүртгүүлээрэй! Миний урилгын код: ${referralCode.code}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: "OnlyCargo урилга", text, url: link });
      } catch (error) {
        // User cancelled or share failed
      }
    } else {
      handleCopyLink();
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

  if (authLoading || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    navigate("/auth");
    return null;
  }

  return (
    <div className="flex flex-col">
      <header className="sticky top-0 z-40 border-b bg-card px-4 py-3">
        <div className="mx-auto flex max-w-md items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">Найзаа урих</h1>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-6">
        <div className="mx-auto max-w-md space-y-6">
          {/* Summary Card */}
          <Card className="overflow-hidden bg-gradient-to-br from-purple-500/10 to-transparent">
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 rounded-lg bg-card border">
                  <p className="text-3xl font-bold text-primary">{totalReferrals}</p>
                  <p className="text-sm text-muted-foreground">Урьсан найз</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-card border">
                  <p className="text-3xl font-bold text-green-600">{formatPrice(totalRewards)}</p>
                  <p className="text-sm text-muted-foreground">Нийт урамшуулал</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* My Referral Code */}
          {referralCode && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Gift className="h-5 w-5" />
                  Миний урилгын код
                </CardTitle>
                <CardDescription>Найзуудаа энэ кодоор урьж урамшуулал авна уу</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <div className="flex-1 px-4 py-3 rounded-lg bg-muted font-mono text-xl font-bold text-center">
                    {referralCode.code}
                  </div>
                  <Button size="icon" variant="outline" onClick={handleCopyCode}>
                    {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={handleCopyLink}>
                    {copiedLink ? <Check className="h-4 w-4 mr-2 text-green-500" /> : <Copy className="h-4 w-4 mr-2" />}
                    Линк хуулах
                  </Button>
                  <Button onClick={handleShare}>
                    <Share2 className="h-4 w-4 mr-2" />
                    Хуваалцах
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Apply Referral Code */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Урилгын код ашиглах</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                  placeholder="ONLY1234AB"
                  maxLength={12}
                />
                <Button onClick={handleApplyCode} disabled={isApplying || !inputCode.trim()}>
                  <Gift className="h-4 w-4 mr-2" />
                  {isApplying ? "..." : "Ашиглах"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Referred Users List */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Урьсан хэрэглэгчид</CardTitle>
              <CardDescription>Таны урилгаар бүртгүүлсэн хэрэглэгчид</CardDescription>
            </CardHeader>
            <CardContent>
              {referredUsers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto opacity-20 mb-2" />
                  <p className="text-sm">Урьсан хэрэглэгч байхгүй</p>
                  <p className="text-xs mt-1">Найзуудаа урьж урамшуулал авна уу!</p>
                </div>
              ) : (
                <div className="overflow-x-auto -mx-6">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Хэрэглэгч</TableHead>
                        <TableHead>Огноо</TableHead>
                        <TableHead>Урамшуулал</TableHead>
                        <TableHead>Төлөв</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {referredUsers.map((ref) => (
                        <TableRow key={ref.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm">{ref.referred_name}</p>
                              <p className="text-xs text-muted-foreground">{ref.referred_phone}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">{format(new Date(ref.created_at), "yyyy.MM.dd")}</TableCell>
                          <TableCell className="font-semibold">{formatPrice(ref.reward_amount || 0)}</TableCell>
                          <TableCell>
                            <Badge variant={ref.reward_paid ? "default" : "secondary"}>
                              {ref.reward_paid ? "Олгосон" : "Хүлээгдэж буй"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Info */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-4">
              <h3 className="font-semibold text-sm mb-2">Урамшууллын дүрэм</h3>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Найз бүртгүүлэхэд 1,000₮ урамшуулал</li>
                <li>• Идэвхтэй хэрэглэгчийн төлбөрөөс 0.5% урамшуулал</li>
                <li>• Урамшуулал Хэтэвчинд автоматаар нэмэгдэнэ</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
