import { useState } from 'react';
import { Scale, Ruler, Info, TrendingDown, Box } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { calculateCargoPrice, formatPrice, formatCubicMeters, type PriceCalculationResult } from '@/lib/priceCalculation';
import { TierPricingNotice } from '@/components/cargo/TierPricingNotice';

export default function Calculator() {
  const { pricing, tierConfig, isLoading: settingsLoading } = useSiteSettings();
  const [weight, setWeight] = useState<string>('');
  const [length, setLength] = useState<string>('');
  const [width, setWidth] = useState<string>('');
  const [height, setHeight] = useState<string>('');
  const [result, setResult] = useState<(PriceCalculationResult & { actualWeight: number }) | null>(null);

  const calculate = () => {
    const actualWeight = parseFloat(weight) || 0;
    const l = parseFloat(length) || 0;
    const w = parseFloat(width) || 0;
    const h = parseFloat(height) || 0;

    const calc = calculateCargoPrice({
      weight: actualWeight,
      length: l,
      width: w,
      height: h,
      weightRate: pricing.per_kg,
      volumeRate: pricing.per_cubic_meter,
      tierConfig,
    });

    setResult({ ...calc, actualWeight });
  };

  const reset = () => {
    setWeight('');
    setLength('');
    setWidth('');
    setHeight('');
    setResult(null);
  };

  if (settingsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <main className="flex-1 px-4 py-6">
        <div className="mx-auto max-w-md space-y-6">
          <Card className="overflow-hidden">
            <CardHeader className="bg-gradient-to-br from-primary/10 to-transparent">
              <CardTitle className="text-base">Ачааны мэдээлэл</CardTitle>
              <CardDescription>
                Ачааны жин болон хэмжээсийг оруулна уу
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="weight" className="flex items-center gap-2">
                  <Scale className="h-4 w-4" />
                  Бодит жин (кг)
                </Label>
                <Input
                  id="weight"
                  type="number"
                  placeholder="0.00"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  step="0.01"
                  min="0"
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Ruler className="h-4 w-4" />
                  Хэмжээс (см)
                </Label>
                <div className="grid grid-cols-3 gap-2">
                  <Input type="number" placeholder="Урт" value={length} onChange={(e) => setLength(e.target.value)} step="0.1" min="0" />
                  <Input type="number" placeholder="Өргөн" value={width} onChange={(e) => setWidth(e.target.value)} step="0.1" min="0" />
                  <Input type="number" placeholder="Өндөр" value={height} onChange={(e) => setHeight(e.target.value)} step="0.1" min="0" />
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={calculate} className="flex-1">Тооцоолох</Button>
                <Button variant="outline" onClick={reset}>Цэвэрлэх</Button>
              </div>
            </CardContent>
          </Card>

          {result && (
            <Card className="border-primary/50 animate-fade-in overflow-hidden">
              <CardHeader className="pb-2 bg-gradient-to-br from-primary/10 to-transparent">
                <CardTitle className="text-base flex items-center justify-between">
                  Тооцооллын үр дүн
                  {result.usedTierPricing && (
                    <span className="inline-flex items-center gap-1 bg-primary/10 text-primary px-2 py-0.5 rounded-full text-xs font-medium">
                      <TrendingDown className="h-3 w-3" />
                      Хямдрал
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-4">
                {/* Inputs summary */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg bg-muted p-3">
                    <p className="text-muted-foreground text-xs flex items-center gap-1">
                      <Scale className="h-3 w-3" /> Бодит жин
                    </p>
                    <p className="font-semibold text-lg">{result.actualWeight} кг</p>
                  </div>
                  <div className="rounded-lg bg-muted p-3">
                    <p className="text-muted-foreground text-xs flex items-center gap-1">
                      <Box className="h-3 w-3" /> Эзлэхүүн
                    </p>
                    <p className="font-semibold text-lg">{formatCubicMeters(result.cubicMeters)}</p>
                  </div>
                </div>

                {/* Two price calculations */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Үнийн харьцуулалт
                  </p>
                  <div className={`flex items-center justify-between rounded-lg border p-3 ${result.usedMethod === 'weight' ? 'border-primary bg-primary/5' : 'border-border'}`}>
                    <div>
                      <p className="text-sm font-medium">Жингээр</p>
                      <p className="text-xs text-muted-foreground">
                        {result.actualWeight} кг × {formatPrice(result.tierInfo?.effectiveWeightRate ?? pricing.per_kg)}
                      </p>
                    </div>
                    <p className={`font-semibold ${result.usedMethod === 'weight' ? 'text-primary' : ''}`}>
                      {formatPrice(result.weightPrice)}
                    </p>
                  </div>
                  <div className={`flex items-center justify-between rounded-lg border p-3 ${result.usedMethod === 'volume' ? 'border-primary bg-primary/5' : 'border-border'}`}>
                    <div>
                      <p className="text-sm font-medium">Эзлэхүүнээр</p>
                      <p className="text-xs text-muted-foreground">
                        {result.cubicMeters.toFixed(4)} м³ × {formatPrice(result.tierInfo?.effectiveVolumeRate ?? pricing.per_cubic_meter)}
                      </p>
                    </div>
                    <p className={`font-semibold ${result.usedMethod === 'volume' ? 'text-primary' : ''}`}>
                      {formatPrice(result.volumePrice)}
                    </p>
                  </div>
                </div>

                {/* Final */}
                <div className="border-t pt-3 flex items-center justify-between">
                  <div>
                    <p className="text-muted-foreground text-sm">Эцсийн төлбөр</p>
                    <p className="text-xs text-muted-foreground">
                      {result.usedMethod === 'volume' ? 'Эзлэхүүнээр' : 'Жингээр'} (илүү үнэтэй)
                    </p>
                  </div>
                  <p className="text-3xl font-bold text-primary">{formatPrice(result.finalPrice)}</p>
                </div>

                <div className="pt-2 border-t space-y-1">
                  <p className="text-xs text-muted-foreground flex items-start gap-1">
                    <Info className="h-3 w-3 mt-0.5 shrink-0" />
                    Жингийн үнэ ба эзлэхүүний үнээс <strong className="mx-1">аль ИХ нь</strong> эцсийн үнэ болно
                  </p>
                  <p className="text-xs text-muted-foreground flex items-start gap-1">
                    <Info className="h-3 w-3 mt-0.5 shrink-0" />
                    Эзлэхүүн = Урт × Өргөн × Өндөр / 1,000,000 (м³)
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          <TierPricingNotice variant="compact" />
        </div>
      </main>
    </div>
  );
}
