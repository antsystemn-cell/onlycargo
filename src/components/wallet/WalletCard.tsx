import { useState } from 'react';
import { Wallet, Plus, ArrowUpRight, ArrowDownLeft, Gift } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useWallet } from '@/hooks/useWallet';
import { formatPrice } from '@/lib/priceCalculation';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export function WalletCard() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const { wallet, transactions, balance, refreshWallet, isLoading } = useWallet();
  const [topupAmount, setTopupAmount] = useState('');
  const [showTopup, setShowTopup] = useState(false);

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'topup':
        return <ArrowDownLeft className="h-4 w-4 text-green-500" />;
      case 'payment':
        return <ArrowUpRight className="h-4 w-4 text-red-500" />;
      case 'referral_reward':
        return <Gift className="h-4 w-4 text-purple-500" />;
      default:
        return <Wallet className="h-4 w-4" />;
    }
  };

  const getTransactionLabel = (type: string) => {
    switch (type) {
      case 'topup':
        return 'Цэнэглэлт';
      case 'payment':
        return 'Төлбөр';
      case 'refund':
        return 'Буцаалт';
      case 'referral_reward':
        return 'Урилгын урамшуулал';
      case 'admin_adjustment':
        return 'Админ тохируулга';
      default:
        return type;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse flex items-center gap-4">
            <div className="h-12 w-12 bg-muted rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-muted rounded w-24" />
              <div className="h-6 bg-muted rounded w-32" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-gradient-to-br from-primary/10 to-transparent pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Wallet className="h-5 w-5" />
          Миний түрийвч
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        {/* Balance */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Үлдэгдэл</p>
            <p className="text-3xl font-bold text-primary">{formatPrice(balance)}</p>
          </div>
          <Dialog open={showTopup} onOpenChange={setShowTopup}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
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

                {/* Quick amounts */}
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
                  Түрийвч цэнэглэх боломж удахгүй нэмэгдэнэ
                </p>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Recent transactions */}
        {transactions.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Сүүлийн гүйлгээнүүд</p>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {transactions.slice(0, 5).map((tx) => (
                <div key={tx.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    {getTransactionIcon(tx.type)}
                    <span>{getTransactionLabel(tx.type)}</span>
                  </div>
                  <span className={tx.amount > 0 ? 'text-green-600' : 'text-red-600'}>
                    {tx.amount > 0 ? '+' : ''}{formatPrice(tx.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
