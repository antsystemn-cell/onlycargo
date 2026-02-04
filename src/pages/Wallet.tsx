import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wallet as WalletIcon, Plus, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { useWallet } from '@/hooks/useWallet';
import { formatPrice } from '@/lib/priceCalculation';
import { WalletTransactionHistory } from '@/components/wallet/WalletTransactionHistory';

export default function WalletPage() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const { wallet, transactions, balance, isLoading } = useWallet();
  const [showTopup, setShowTopup] = useState(false);
  const [topupAmount, setTopupAmount] = useState('');

  if (authLoading || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    navigate('/auth');
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
                <Dialog open={showTopup} onOpenChange={setShowTopup}>
                  <DialogTrigger asChild>
                    <Button variant="secondary" className="w-full" size="lg">
                      <Plus className="h-5 w-5 mr-2" />
                      Цэнэглэх
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Түрийвч цэнэглэх</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Цэнэглэх дүн (₮)</Label>
                        <Input
                          type="number"
                          value={topupAmount}
                          onChange={(e) => setTopupAmount(e.target.value)}
                          placeholder="10000"
                          min="1000"
                          step="1000"
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        {[10000, 50000, 100000].map((amount) => (
                          <Button
                            key={amount}
                            variant="outline"
                            size="sm"
                            onClick={() => setTopupAmount(String(amount))}
                          >
                            {formatPrice(amount)}
                          </Button>
                        ))}
                      </div>

                      <p className="text-sm text-muted-foreground text-center">
                        QPay цэнэглэлт удахгүй нэмэгдэнэ
                      </p>
                    </div>
                  </DialogContent>
                </Dialog>
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
    </div>
  );
}
