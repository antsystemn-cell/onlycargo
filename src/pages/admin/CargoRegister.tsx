import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PackagePlus, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import BarcodeScanner from '@/components/barcode/BarcodeScanner';
import { parseCargoError, logCargoOperation } from '@/lib/cargoErrors';
import { STATUS_LABELS, type CargoStatus } from '@/types/cargo';
import { calculateCargoPrice, formatPrice } from '@/lib/priceCalculation';
import { TierPricingNotice } from '@/components/cargo/TierPricingNotice';

const cargoSchema = z.object({
  track_number: z.string().min(1, 'Трак дугаар оруулна у|у'),
  phone_number: z.string().regex(/^[6-9]\d{7}$/, 'Утасны дугаар буруу байна').optional().or(z.literal('')),
  weight: z.string().optional(),
  length: z.string().optional(),
  width: z.string().optional(),
  height: z.string().optional(),
  shelf_location: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(['registered', 'received_ereen', 'transporting', 'warehouse_processing', 'ready_warehouse', 'completed']),
});

type CargoFormValues = z.infer<typeof cargoSchema>;

const shelfOptions = ['A1', 'A2', 'A3', 'B1', 'B2', 'B3', 'C1', 'C2', 'C3'];

const statusOptions: CargoStatus[] = [
  'registered',
  'received_ereen',
  'transporting',
  'warehouse_processing',
  'ready_warehouse',
  'completed',
];

export default function CargoRegister() {
  const { toast } = useToast();
  const { user, isAdmin } = useAuth();
  const { pricing, tierConfig } = useSiteSettings();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registeredCount, setRegisteredCount] = useState(0);
  const [calculatedPrice, setCalculatedPrice] = useState<{
    weightPrice: number;
    volumePrice: number;
    finalPrice: number;
    cubicMeters: number;
    usedMethod: 'weight' | 'volume';
    usedTierPricing: boolean;
  } | null>(null);

  const form = useForm<CargoFormValues>({
    resolver: zodResolver(cargoSchema),
    defaultValues: {
      track_number: '',
      phone_number: '',
      weight: '',
      length: '',
      width: '',
      height: '',
      shelf_location: '',
      notes: '',
      status: 'ready_warehouse',
    },
  });

  const handleDimensionChange = () => {
    const values = form.getValues();
    const weight = parseFloat(values.weight || '0');
    const length = parseFloat(values.length || '0');
    const width = parseFloat(values.width || '0');
    const height = parseFloat(values.height || '0');

    if (weight > 0 || (length > 0 && width > 0 && height > 0)) {
      const result = calculateCargoPrice({
        weight,
        length,
        width,
        height,
        weightRate: pricing.per_kg,
        volumeRate: pricing.per_cubic_meter,
        tierConfig,
      });
      setCalculatedPrice(result);
    } else {
      setCalculatedPrice(null);
    }
  };

  const onSubmit = async (data: CargoFormValues) => {
    setIsSubmitting(true);
    
    const payload = {
      track_number: data.track_number,
      phone_number: data.phone_number || '',
      weight: parseFloat(data.weight || '0') || null,
      length: parseFloat(data.length || '0') || null,
      width: parseFloat(data.width || '0') || null,
      height: parseFloat(data.height || '0') || null,
      shelf_location: data.shelf_location || null,
      notes: data.notes || null,
    };

    try {
      const weight = parseFloat(data.weight || '0');
      const length = parseFloat(data.length || '0');
      const width = parseFloat(data.width || '0');
      const height = parseFloat(data.height || '0');
      
      // Use tiered pricing calculation
      const priceResult = calculateCargoPrice({
        weight,
        length,
        width,
        height,
        weightRate: pricing.per_kg,
        volumeRate: pricing.per_cubic_meter,
        tierConfig,
      });

      // Check if cargo already exists
      const { data: existingCargo } = await supabase
        .from('cargo')
        .select('id, track_number')
        .eq('track_number', data.track_number)
        .maybeSingle();

      if (existingCargo) {
        logCargoOperation('register', payload, isAdmin ? 'admin' : 'user', { 
          success: false, 
          error: { code: '23505', message: 'Duplicate track number' } 
        });
        toast({
          title: 'Давхардсан трак дугаар',
          description: `"${data.track_number}" трак дугаар аль хэдийн бүртгэгдсэн байна`,
          variant: 'destructive',
        });
        setIsSubmitting(false);
        return;
      }

      // Check if phone number exists and link to user
      let userId = null;
      if (data.phone_number) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('phone', data.phone_number)
          .maybeSingle();
        
        if (profile) {
          userId = profile.id;
        }
      }

      const { error } = await supabase.from('cargo').insert({
        track_number: data.track_number,
        phone_number: data.phone_number || '',
        user_id: userId,
        weight: weight || null,
        length: length || null,
        width: width || null,
        height: height || null,
        price: priceResult.finalPrice > 0 ? priceResult.finalPrice : null,
        kg_price: priceResult.weightPrice > 0 ? priceResult.weightPrice : null,
        cubic_meter_price: priceResult.volumePrice > 0 ? priceResult.volumePrice : null,
        total_cubic_meters: priceResult.cubicMeters > 0 ? priceResult.cubicMeters : null,
        shelf_location: data.shelf_location || null,
        notes: data.notes || null,
        status: data.status,
        registered_by: user?.id || null,
      });

      if (error) {
        const parsedError = parseCargoError(error);
        logCargoOperation('register', payload, isAdmin ? 'admin' : 'user', { success: false, error });
        toast({
          title: parsedError.title,
          description: parsedError.description,
          variant: 'destructive',
        });
      } else {
        logCargoOperation('register', payload, isAdmin ? 'admin' : 'user', { success: true });
        
        // Check for matching preregistration and show notification
        const { data: matchedPrereg } = await supabase
          .from('cargo_preregistrations')
          .select('id, user_id')
          .eq('track_number', data.track_number)
          .not('matched_cargo_id', 'is', null)
          .maybeSingle();

        let successMessage = `Ачаа амжилттай бүртгэгдлээ - ${formatPrice(priceResult.finalPrice)}`;
        if (matchedPrereg) {
          successMessage = `Ачаа бүртгэгдэж, урьдчилсан бүртгэлтэй холбогдлоо - ${formatPrice(priceResult.finalPrice)}`;
        }
        
        toast({
          title: 'Амжилттай',
          description: successMessage,
        });
        setRegisteredCount((prev) => prev + 1);
        form.reset();
        setCalculatedPrice(null);
      }
    } catch (error) {
      const parsedError = parseCargoError(error);
      logCargoOperation('register', payload, isAdmin ? 'admin' : 'user', { success: false, error });
      toast({
        title: parsedError.title,
        description: parsedError.description,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Ачаа бүртгэх</h1>
        <p className="text-muted-foreground">Шинэ ачаа системд бүртгэх</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PackagePlus className="h-5 w-5" />
              Ачааны мэдээлэл
            </CardTitle>
            <CardDescription>Бүх талбарыг оруулна уу</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                    control={form.control}
                    name="track_number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Трак дугаар *</FormLabel>
                        <FormControl>
                          <BarcodeScanner
                            onScan={(code) => form.setValue('track_number', code)}
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="Баркод скан хийх эсвэл гараар оруулах"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="phone_number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Утасны дугаар</FormLabel>
                        <FormControl>
                          <Input placeholder="99112233" maxLength={8} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-4">
                  <FormField
                    control={form.control}
                    name="weight"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Жин (кг)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01" 
                            placeholder="0.00" 
                            {...field}
                            onChange={(e) => {
                              field.onChange(e);
                              handleDimensionChange();
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="length"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Урт (см)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.1" 
                            placeholder="0" 
                            {...field}
                            onChange={(e) => {
                              field.onChange(e);
                              handleDimensionChange();
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="width"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Өргөн (см)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.1" 
                            placeholder="0" 
                            {...field}
                            onChange={(e) => {
                              field.onChange(e);
                              handleDimensionChange();
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="height"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Өндөр (см)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.1" 
                            placeholder="0" 
                            {...field}
                            onChange={(e) => {
                              field.onChange(e);
                              handleDimensionChange();
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Price calculation display */}
                {calculatedPrice && (
                  <Card className={`border-primary/50 ${calculatedPrice.usedTierPricing ? 'bg-primary/5' : 'bg-muted/30'}`}>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Эзлэхүүн ({calculatedPrice.cubicMeters} м³):</span>
                        <span>{calculatedPrice.volumePrice.toLocaleString()}₮</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Жин:</span>
                        <span>{calculatedPrice.weightPrice.toLocaleString()}₮</span>
                      </div>
                      <div className="flex justify-between font-bold pt-2 border-t">
                        <span className="flex items-center gap-2">
                          Нийт:
                          {calculatedPrice.usedTierPricing && (
                            <span className="text-xs font-normal bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                              Хямдралтай
                            </span>
                          )}
                        </span>
                        <span className="text-primary">{calculatedPrice.finalPrice.toLocaleString()}₮</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {calculatedPrice.usedMethod === 'volume' ? 'Эзлэхүүнээр' : 'Жингээр'} тооцоолсон
                      </p>
                    </CardContent>
                  </Card>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Төлөв *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Төлөв сонгох" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {statusOptions.map((status) => (
                              <SelectItem key={status} value={status}>
                                {STATUS_LABELS[status]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="shelf_location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Тавиурын байрлал</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Тавиур сонгох" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {shelfOptions.map((shelf) => (
                              <SelectItem key={shelf} value={shelf}>
                                {shelf}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Тэмдэглэл</FormLabel>
                      <FormControl>
                        <Input placeholder="Нэмэлт мэдээлэл..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Бүртгэх
                    </>
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Өнөөдөр бүртгэсэн</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <div className="text-4xl font-bold text-primary">{registeredCount}</div>
                <p className="text-muted-foreground">ширхэг</p>
              </div>
            </CardContent>
          </Card>

          <TierPricingNotice variant="compact" />
        </div>
      </div>
    </div>
  );
}
