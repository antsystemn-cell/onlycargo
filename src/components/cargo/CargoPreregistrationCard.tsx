import { useState } from 'react';
import { format } from 'date-fns';
import { Package, Trash2, CheckCircle, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import ChinaTrackingTimeline from './ChinaTrackingTimeline';
import type { CargoPreregistration } from '@/types/cargo';

interface CargoPreregistrationCardProps {
  preregistration: CargoPreregistration & {
    tracking_carrier?: number | null;
    tracking_registered?: boolean;
    tracking_register_error?: string | null;
    tracking_status_17track?: string | null;
    tracking_last_sync_at?: string | null;
  };
  onDelete?: (id: string) => void;
}

export default function CargoPreregistrationCard({
  preregistration,
  onDelete,
}: CargoPreregistrationCardProps) {
  const isMatched = !!preregistration.matched_cargo_id;
  const [showTimeline, setShowTimeline] = useState(false);

  return (
    <Card className={isMatched ? 'border-green-500/50 bg-green-50/50 dark:bg-green-950/20' : ''}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
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

        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => setShowTimeline((v) => !v)}
        >
          {showTimeline ? (
            <>
              <ChevronUp className="h-3.5 w-3.5 mr-1" />
              Хятад дахь явцыг хаах
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5 mr-1" />
              Хятад дахь тээврийн явц
            </>
          )}
        </Button>

        {showTimeline && (
          <div className="pt-2 border-t">
            <ChinaTrackingTimeline
              trackingNumber={preregistration.track_number}
              preregistrationId={preregistration.id}
              carrier={preregistration.tracking_carrier ?? null}
              status17={preregistration.tracking_status_17track ?? null}
              lastSyncAt={preregistration.tracking_last_sync_at ?? null}
              registered={preregistration.tracking_registered ?? false}
              registerError={preregistration.tracking_register_error ?? null}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
