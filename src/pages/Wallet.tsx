import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Wallet as WalletIcon, Plus, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useWallet } from "@/hooks/useWallet";
import { formatPrice } from "@/lib/priceCalculation";
import { WalletTransactionHistory } from "@/components/wallet/WalletTransactionHistory";
import { WalletTopupModal } from "@/components/wallet/WalletTopupModal";

export default function WalletPage() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const { transactions, balance, refreshWallet, isLoading } = useWallet();
  const [showTopup, setShowTopup] = useState(false);

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
            <WalletIcon className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">Миний түрийвч</h1>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-6">
        <div className="mx-auto max-w-md space-y-6">
          {/* Balance Card */}
          <Card className="overflow-hidden bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
            <CardContent className="pt-6">
              <div className="text-center space-y-2">
                <p className="text-sm opacity-80">Үлдэгдэл</p>
                <p className="text-4xl font-bold">{formatPrice(balance)}</p>
              </div>

              <div className="mt-6">
                <Button variant="secondary" className="w-full" size="lg" onClick={() => setShowTopup(true)}>
                  <Plus className="h-5 w-5 mr-2" />
                  Хэтэвчээ цэнэглэх
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Transaction History */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Гүйлгээний түүх</CardTitle>
            </CardHeader>
            <CardContent>
              <WalletTransactionHistory transactions={transactions} />
            </CardContent>
          </Card>
        </div>
      </main>

      <WalletTopupModal
        open={showTopup}
        onOpenChange={setShowTopup}
        onSuccess={() => {
          refreshWallet();
          setShowTopup(false);
        }}
      />
    </div>
  );
}
