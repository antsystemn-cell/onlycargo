import { ArrowUpRight, ArrowDownLeft, Gift, Settings, Wallet } from 'lucide-react';
import { formatPrice } from '@/lib/priceCalculation';
import { format } from 'date-fns';
import type { WalletTransaction } from '@/types/cargo';

interface WalletTransactionHistoryProps {
  transactions: WalletTransaction[];
}

const getTransactionIcon = (type: string) => {
  switch (type) {
    case 'topup':
      return <ArrowDownLeft className="h-4 w-4 text-green-500" />;
    case 'payment':
      return <ArrowUpRight className="h-4 w-4 text-red-500" />;
    case 'referral_reward':
      return <Gift className="h-4 w-4 text-purple-500" />;
    case 'admin_adjustment':
      return <Settings className="h-4 w-4 text-blue-500" />;
    default:
      return <Wallet className="h-4 w-4" />;
  }
};

const getTransactionLabel = (type: string) => {
  switch (type) {
    case 'topup':
      return 'Цэнэглэлт';
    case 'payment':
      return 'Ачааны төлбөр';
    case 'refund':
      return 'Буцаалт';
    case 'referral_reward':
      return 'Урилгын урамшуулал';
    case 'admin_adjustment':
      return 'Админ тохируулга';
    case 'coupon':
      return 'Купон';
    default:
      return type;
  }
};

export function WalletTransactionHistory({ transactions }: WalletTransactionHistoryProps) {
  if (transactions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Wallet className="h-12 w-12 mx-auto opacity-20 mb-2" />
        <p className="text-sm">Гүйлгээ байхгүй байна</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {transactions.map((tx) => (
        <div
          key={tx.id}
          className="flex items-center justify-between p-3 rounded-lg border bg-card"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-muted">
              {getTransactionIcon(tx.type)}
            </div>
            <div>
              <p className="font-medium text-sm">{getTransactionLabel(tx.type)}</p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(tx.created_at), 'yyyy.MM.dd HH:mm')}
              </p>
              {tx.description && (
                <p className="text-xs text-muted-foreground mt-0.5">{tx.description}</p>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className={`font-semibold ${tx.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {tx.amount > 0 ? '+' : ''}{formatPrice(tx.amount)}
            </p>
            <p className="text-xs text-muted-foreground">
              Үлдэгдэл: {formatPrice(tx.balance_after)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
