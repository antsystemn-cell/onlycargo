import { useState } from 'react';
import { Calculator as CalcIcon, Scale, Ruler, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const PRICE_PER_KG = 8000; // 8000₮ per kg

export default function Calculator() {
  const [weight, setWeight] = useState<string>('');
  const [length, setLength] = useState<string>('');
  const [width, setWidth] = useState<string>('');
  const [height, setHeight] = useState<string>('');
  const [result, setResult] = useState<{
    actualWeight: number;
    volumetricWeight: number;
    chargedWeight: number;
    price: number;
  } | null>(null);

  const calculate = () => {
    const actualWeight = parseFloat(weight) || 0;
    const l = parseFloat(length) || 0;
    const w = parseFloat(width) || 0;
    const h = parseFloat(height) || 0;

    const volumetricWeight = (l * w * h) / 5000;
    const chargedWeight = Math.max(actualWeight, volumetricWeight);
    const price = Math.ceil(chargedWeight) * PRICE_PER_KG;

    setResult({
      actualWeight,
      volumetricWeight: Math.round(volumetricWeight * 100) / 100,
      chargedWeight: Math.ceil(chargedWeight),
      price,
    });
  };

  const reset = () => {
    setWeight('');
    setLength('');
    setWidth('');
    setHeight('');
    setResult(null);
  };

  return (
    <div className="flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-card px-4 py-3">
        <div className="mx-auto flex max-w-md items-center gap-2">
          <CalcIcon className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold">Тээврийн тооцоолуур</h1>
        </div>
      </header>

      <main className="flex-1 px-4 py-6">
        <div className="mx-auto max-w-md space-y-6">
          <Tabs defaultValue="calculator" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="calculator">Тооцоолуур</TabsTrigger>
              <TabsTrigger value="info">Хятад агуулах</TabsTrigger>
            </TabsList>

            <TabsContent value="calculator" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Жин оруулах</CardTitle>
                  <CardDescription>
                    Бодит жин болон хэмжээсийг оруулна уу
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
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
                      <div>
                        <Input
                          type="number"
                          placeholder="Урт"
                          value={length}
                          onChange={(e) => setLength(e.target.value)}
                          step="0.1"
                          min="0"
                        />
                      </div>
                      <div>
                        <Input
                          type="number"
                          placeholder="Өргөн"
                          value={width}
                          onChange={(e) => setWidth(e.target.value)}
                          step="0.1"
                          min="0"
                        />
                      </div>
                      <div>
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
                <Card className="border-primary">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Үр дүн</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Бодит жин</p>
                        <p className="font-medium">{result.actualWeight} кг</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Эзлэхүүний жин</p>
                        <p className="font-medium">{result.volumetricWeight} кг</p>
                      </div>
                    </div>
                    <div className="border-t pt-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-muted-foreground">Төлөх жин</p>
                          <p className="text-lg font-bold">{result.chargedWeight} кг</p>
                        </div>
                        <div className="text-right">
                          <p className="text-muted-foreground">Төлбөр</p>
                          <p className="text-2xl font-bold text-primary">
                            {result.price.toLocaleString()}₮
                          </p>
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      * Эзлэхүүний жин = (Урт × Өргөн × Өндөр) / 5000
                      <br />* Бодит жин ба эзлэхүүний жингээс аль их нь тооцогдоно
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="info" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Info className="h-4 w-4" />
                    Хятад агуулахын хаяг
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg bg-muted p-4 space-y-2">
                    <p className="font-medium">收件人 (Хүлээн авагч):</p>
                    <p className="text-sm">蒙古货运 + [Таны утасны дугаар]</p>
                  </div>
                  <div className="rounded-lg bg-muted p-4 space-y-2">
                    <p className="font-medium">地址 (Хаяг):</p>
                    <p className="text-sm">
                      广东省广州市白云区江高镇神山大道西368号宏艺库B栋1号
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted p-4 space-y-2">
                    <p className="font-medium">电话 (Утас):</p>
                    <p className="text-sm">13800138000</p>
                  </div>
                  <div className="rounded-lg bg-muted p-4 space-y-2">
                    <p className="font-medium">邮编 (Шуудангийн код):</p>
                    <p className="text-sm">510450</p>
                  </div>

                  <div className="border-t pt-4 space-y-2">
                    <p className="font-medium text-sm">Зааварчилгаа:</p>
                    <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                      <li>Таобаогоос захиалга өгөхдөө дээрх хаягийг оруулна</li>
                      <li>Хүлээн авагчийн нэрт заавал утасны дугаараа бичнэ</li>
                      <li>Бараа агуулахад ирсний дараа манай системд бүртгэгдэнэ</li>
                      <li>Бараа УБ-д ирмэгц мэдэгдэл явуулна</li>
                    </ol>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
