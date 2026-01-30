import { format } from 'date-fns';
import { Package, Trash2, CheckCircle, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { CargoPreregistration } from '@/types/cargo';

interface CargoPreregistrationCardProps {
  preregistration: CargoPreregistration;
  onDelete?: (id: string) => void;
}

export default function CargoPreregistrationCard({
  preregistration,
  onDelete,
}: CargoPreregistrationCardProps) {
  const isMatched = !!preregistration.matched_cargo_id;

  return (
    <Card className={isMatched ? 'border-green-500/50 bg-green-50/50 dark:bg-green-950/20' : ''}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Package className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="font-mono text-sm font-medium truncate">
                {preregistration.track_number}
              </span>
              {isMatched ? (
                <span className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full">
                  <CheckCircle className="h-3 w-3" />
                  Холбогдсон
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  <Clock className="h-3 w-3" />
                  Хүлээгдэж байна
                </span>
              )}
            </div>

            {preregistration.description && (
              <p className="text-sm text-muted-foreground mb-2">
                {preregistration.description}
              </p>
            )}

            <span className="text-xs text-muted-foreground">
              {format(new Date(preregistration.created_at), 'yyyy.MM.dd HH:mm')}
            </span>
          </div>

          {!isMatched && onDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => onDelete(preregistration.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
