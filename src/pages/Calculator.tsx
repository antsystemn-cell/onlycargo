import { useState } from 'react';
import { Calculator as CalcIcon, Scale, Ruler, Info, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { calculateTieredPrice, formatPrice } from '@/lib/priceCalculation';
import { TierPricingNotice } from '@/components/cargo/TierPricingNotice';

export default function Calculator() {
  const { pricing, tierConfig, isLoading: settingsLoading } = useSiteSettings();
  const [weight, setWeight] = useState<string>('');
  const [length, setLength] = useState<string>('');
  const [width, setWidth] = useState<string>('');
  const [height, setHeight] = useState<string>('');
  const [result, setResult] = useState<{
    actualWeight: number;
    volumetricWeight: number;
    chargedWeight: number;
    price: number;
    usedMethod: 'weight' | 'volumetric';
    usedTierPricing: boolean;
    effectiveRate: number;
  } | null>(null);

  const PRICE_PER_KG = pricing.per_kg;

  const calculate = () => {
    const actualWeight = parseFloat(weight) || 0;
    const l = parseFloat(length) || 0;
    const w = parseFloat(width) || 0;
    const h = parseFloat(height) || 0;

    // Use the tiered calculation function
    const calcResult = calculateTieredPrice(actualWeight, l, w, h, PRICE_PER_KG, tierConfig);

    setResult({
      actualWeight,
      volumetricWeight: calcResult.volumetricWeight,
      chargedWeight: calcResult.chargedWeight,
      price: calcResult.price,
      usedMethod: calcResult.usedMethod,
      usedTierPricing: calcResult.usedTierPricing,
      effectiveRate: calcResult.effectiveRate,
    });
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
      {/* Header */}

      <main className="flex-1 px-4 py-6">
        <div className="mx-auto max-w-md space-y-6">
          <Card className="overflow-hidden">
            <CardHeader className="bg-gradient-to-br from-primary/10 to-transparent">
              <CardTitle className="text-base">Жин оруулах</CardTitle>
              <CardDescription>
                Бодит жин болон хэмжээсийг оруулна уу
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
                  <Input
                    type="number"
                    placeholder="Урт"
                    value={length}
                    onChange={(e) => setLength(e.target.value)}
                    step="0.1"
                    min="0"
                  />
                  <Input
                    type="number"
                    placeholder="Өргөн"
                    value={width}
                    onChange={(e) => setWidth(e.target.value)}
                    step="0.1"
                    min="0"
                  />
                  <Input
                    type="number"
                    placeholder="Өндөр"
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                    step="0.1"
                    min="0"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={calculate} className="flex-1">
                  Тооцоолох
                </Button>
                <Button variant="outline" onClick={reset}>
                  Цэвэрлэх
                </Button>
              </div>
            </CardContent>
          </Card>

          {result && (
            <Card className="border-primary/50 animate-fade-in overflow-hidden">
              <CardHeader className="pb-2 bg-gradient-to-br from-primary/10 to-transparent">
                <CardTitle className="text-base flex items-center justify-between">
                  Үр дүн
                  {result.usedTierPricing && (
                    <span className="inline-flex items-center gap-1 bg-primary/10 text-primary px-2 py-0.5 rounded-full text-xs font-medium">
                      <TrendingDown className="h-3 w-3" />
                      Хямдрал
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="rounded-lg bg-muted p-3">
                    <p className="text-muted-foreground text-xs">Бодит жин</p>
                    <p className="font-medium text-lg">{result.actualWeight} кг</p>
                  </div>
                  <div className="rounded-lg bg-muted p-3">
                    <p className="text-muted-foreground text-xs">Эзлэхүүний жин</p>
                    <p className="font-medium text-lg">{result.volumetricWeight} кг</p>
                  </div>
                </div>
                <div className="border-t pt-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-muted-foreground text-sm">Төлөх жин</p>
                      <p className="text-xl font-bold">{result.chargedWeight} кг</p>
                      <p className="text-xs text-muted-foreground">
                        ({result.usedMethod === 'volumetric' ? 'Эзлэхүүнээр' : 'Жингээр'} тооцсон)
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-muted-foreground text-sm">Төлбөр</p>
                      <p className="text-3xl font-bold text-primary">
                        {formatPrice(result.price)}
                      </p>
                      {result.usedTierPricing && (
                        <p className="text-xs text-primary">
                          {formatPrice(result.effectiveRate)}/кг
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="pt-2 border-t space-y-1">
                  <p className="text-xs text-muted-foreground flex items-start gap-1">
                    <Info className="h-3 w-3 mt-0.5 shrink-0" />
                    Эзлэхүүний жин = (Урт × Өргөн × Өндөр) / 5000
                  </p>
                  <p className="text-xs text-muted-foreground flex items-start gap-1">
                    <Info className="h-3 w-3 mt-0.5 shrink-0" />
                    <strong>Бодит жин, эзлэхүүний жингээс аль ИХ нь</strong> тооцогдоно
                  </p>
                  {result.usedTierPricing ? (
                    <p className="text-xs text-primary flex items-start gap-1">
                      <TrendingDown className="h-3 w-3 mt-0.5 shrink-0" />
                      Хямдралтай үнэ хэрэглэгдлээ ({formatPrice(result.effectiveRate)}/кг)
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground flex items-start gap-1">
                      <Info className="h-3 w-3 mt-0.5 shrink-0" />
                      1 кг = {formatPrice(PRICE_PER_KG)}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tier pricing info */}
          <TierPricingNotice variant="compact" />
        </div>
      </main>
    </div>
  );
}
