import { Info, TrendingDown } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { formatPrice } from '@/lib/priceCalculation';

interface TierPricingNoticeProps {
  variant?: 'default' | 'compact';
  showTierApplied?: boolean;
  tierAppliedType?: 'weight' | 'volume' | null;
}

export function TierPricingNotice({ 
  variant = 'default',
  showTierApplied = false,
  tierAppliedType = null,
}: TierPricingNoticeProps) {
  const { pricing, tierConfig } = useSiteSettings();

  if (variant === 'compact') {
    return (
      <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <div className="space-y-0.5">
          <p>
            <strong>Том ачаанд хямдрал:</strong> {tierConfig.weightThreshold}кг+ → {formatPrice(tierConfig.weightTierPrice)}/кг, {tierConfig.volumeThreshold}м³+ → {formatPrice(tierConfig.volumeTierPrice)}/м³
          </p>
          <p>Жин болон эзлэхүүний үнээс <strong>аль ИХ нь</strong> тооцогдоно</p>
        </div>
      </div>
    );
  }

  return (
    <Alert className="border-primary/30 bg-primary/5">
      <TrendingDown className="h-4 w-4" />
      <AlertDescription className="space-y-2">
        {showTierApplied && tierAppliedType && (
          <div className="flex items-center gap-2 text-primary font-medium">
            <span className="inline-flex items-center gap-1.5 bg-primary/10 text-primary px-2 py-0.5 rounded-full text-xs">
              <TrendingDown className="h-3 w-3" />
              Хямдралтай үнэ хэрэглэгдлээ
            </span>
          </div>
        )}
        <div className="text-sm space-y-1">
          <p className="font-medium">Том ачааны хямдралтай үнэ:</p>
          <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
            <li>
              Жин {tierConfig.weightThreshold}кг-ээс дээш бол: {formatPrice(tierConfig.weightTierPrice)}/кг 
              <span className="text-xs ml-1">(энгийн: {formatPrice(pricing.per_kg)}/кг)</span>
            </li>
            <li>
              Эзлэхүүн {tierConfig.volumeThreshold}м³-ээс дээш бол: {formatPrice(tierConfig.volumeTierPrice)}/м³
              <span className="text-xs ml-1">(энгийн: {formatPrice(pricing.per_cubic_meter)}/м³)</span>
            </li>
          </ul>
          <p className="text-xs text-muted-foreground italic pt-1">
            Жин болон эзлэхүүний үнээс аль ИХ нь эцсийн үнэ болно
          </p>
        </div>
      </AlertDescription>
    </Alert>
  );
}
