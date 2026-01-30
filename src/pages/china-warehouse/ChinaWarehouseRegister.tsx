import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PackagePlus, Check, Camera, X, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import BarcodeScanner from '@/components/barcode/BarcodeScanner';

const cargoSchema = z.object({
  track_number: z.string().min(1, 'Трак дугаар оруулна уу'),
  phone_number: z.string().regex(/^[6-9]\d{7}$/, 'Утасны дугаар буруу байна').optional().or(z.literal('')),
  weight: z.string().optional(),
  length: z.string().optional(),
  width: z.string().optional(),
  height: z.string().optional(),
});

type CargoFormValues = z.infer<typeof cargoSchema>;

export default function ChinaWarehouseRegister() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { pricing } = useSiteSettings();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registeredCount, setRegisteredCount] = useState(0);
  const [photos, setPhotos] = useState<File[]>([]);
  const [calculatedPrice, setCalculatedPrice] = useState<{
    cubicMeterPrice: number;
    kgPrice: number;
    totalPrice: number;
    cubicMeters: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<CargoFormValues>({
    resolver: zodResolver(cargoSchema),
    defaultValues: {
      track_number: '',
      phone_number: '',
      weight: '',
      length: '',
      width: '',
      height: '',
    },
  });

  const calculatePrice = (weight: number, length: number, width: number, height: number) => {
    // Convert cm to meters for cubic meter calculation
    const cubicMeters = (length * width * height) / 1000000;
    const cubicMeterPrice = cubicMeters * pricing.per_cubic_meter;
    const kgPrice = weight * pricing.china_per_kg;
    const totalPrice = cubicMeterPrice + kgPrice;

    return {
      cubicMeterPrice: Math.round(cubicMeterPrice),
      kgPrice: Math.round(kgPrice),
      totalPrice: Math.round(totalPrice),
      cubicMeters: Math.round(cubicMeters * 10000) / 10000, // 4 decimal places
    };
  };

  const handleDimensionChange = () => {
    const values = form.getValues();
    const weight = parseFloat(values.weight || '0');
    const length = parseFloat(values.length || '0');
    const width = parseFloat(values.width || '0');
    const height = parseFloat(values.height || '0');

    if (weight > 0 || (length > 0 && width > 0 && height > 0)) {
      setCalculatedPrice(calculatePrice(weight, length, width, height));
    } else {
      setCalculatedPrice(null);
    }
  };

  const handlePhotoAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setPhotos((prev) => [...prev, ...files].slice(0, 5)); // Max 5 photos
  };

  const handlePhotoRemove = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadPhotos = async (cargoId: string): Promise<string[]> => {
    const urls: string[] = [];

    for (const photo of photos) {
      const fileExt = photo.name.split('.').pop();
      const fileName = `${cargoId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('cargo-photos')
        .upload(fileName, photo);

      if (error) {
        console.error('Photo upload error:', error);
        continue;
      }

      const { data: urlData } = supabase.storage
        .from('cargo-photos')
        .getPublicUrl(data.path);

      urls.push(urlData.publicUrl);
    }

    return urls;
  };

  const onSubmit = async (data: CargoFormValues) => {
    setIsSubmitting(true);
    try {
      const weight = parseFloat(data.weight || '0');
      const length = parseFloat(data.length || '0');
      const width = parseFloat(data.width || '0');
      const height = parseFloat(data.height || '0');
      const priceCalc = calculatePrice(weight, length, width, height);

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

      // Get the Ereen branch ID
      const { data: ereenBranch } = await supabase
        .from('branches')
        .select('id')
        .eq('code', 'EREEN')
        .maybeSingle();

      const { data: newCargo, error } = await supabase
        .from('cargo')
        .insert({
          track_number: data.track_number,
          phone_number: data.phone_number || '',
          user_id: userId,
          weight: weight || null,
          length: length || null,
          width: width || null,
          height: height || null,
          price: priceCalc.totalPrice > 0 ? priceCalc.totalPrice : null,
          cubic_meter_price: priceCalc.cubicMeterPrice > 0 ? priceCalc.cubicMeterPrice : null,
          kg_price: priceCalc.kgPrice > 0 ? priceCalc.kgPrice : null,
          total_cubic_meters: priceCalc.cubicMeters > 0 ? priceCalc.cubicMeters : null,
          status: 'received_ereen',
          branch_id: ereenBranch?.id || null,
          registered_by: user?.id || null,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          toast({
            title: 'Алдаа',
            description: 'Энэ трак дугаар бүртгэгдсэн байна',
            variant: 'destructive',
          });
        } else {
          throw error;
        }
      } else {
        // Upload photos if any
        if (photos.length > 0 && newCargo) {
          const photoUrls = await uploadPhotos(newCargo.id);
          
          for (const url of photoUrls) {
            await supabase.from('cargo_photos').insert({
              cargo_id: newCargo.id,
              photo_url: url,
              uploaded_by: user?.id || null,
            });
          }
        }

        // Check for matching preregistration
        if (data.phone_number) {
          const { data: preReg } = await supabase
            .from('cargo_preregistrations')
            .select('id')
            .eq('track_number', data.track_number)
            .is('matched_cargo_id', null)
            .maybeSingle();

          if (preReg) {
            await supabase
              .from('cargo_preregistrations')
              .update({ matched_cargo_id: newCargo.id })
              .eq('id', preReg.id);
          }
        }

        toast({
          title: 'Амжилттай',
          description: `Ачаа бүртгэгдлээ - ${priceCalc.totalPrice.toLocaleString()}₮`,
        });
        setRegisteredCount((prev) => prev + 1);
        form.reset();
        setPhotos([]);
        setCalculatedPrice(null);
      }
    } catch (error) {
      console.error('Registration error:', error);
      toast({
        title: 'Алдаа',
        description: 'Бүртгэж чадсангүй',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBarcodeScan = (code: string) => {
    form.setValue('track_number', code);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Ачаа бүртгэх</h1>
        <p className="text-muted-foreground">Эрээн агуулахад ирсэн ачаа бүртгэх</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PackagePlus className="h-5 w-5" />
              Ачааны мэдээлэл
            </CardTitle>
            <CardDescription>Баркод скан хийх эсвэл гараар оруулах</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="track_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Трак дугаар *</FormLabel>
                      <FormControl>
                        <BarcodeScanner
                          onScan={handleBarcodeScan}
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

                <div className="grid gap-4 grid-cols-2">
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

                  <div />

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
                  <Card className="border-primary/50 bg-primary/5">
                    <CardContent className="p-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Эзлэхүүн ({calculatedPrice.cubicMeters} м³):</span>
                        <span>{calculatedPrice.cubicMeterPrice.toLocaleString()}₮</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Жин:</span>
                        <span>{calculatedPrice.kgPrice.toLocaleString()}₮</span>
                      </div>
                      <div className="flex justify-between font-bold pt-2 border-t">
                        <span>Нийт:</span>
                        <span className="text-primary">{calculatedPrice.totalPrice.toLocaleString()}₮</span>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Photo upload */}
                <div className="space-y-2">
                  <FormLabel>Зургууд (5 хүртэл)</FormLabel>
                  <div className="flex flex-wrap gap-2">
                    {photos.map((photo, index) => (
                      <div key={index} className="relative w-20 h-20 rounded-lg overflow-hidden border">
                        <img
                          src={URL.createObjectURL(photo)}
                          alt={`Photo ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => handlePhotoRemove(index)}
                          className="absolute top-0.5 right-0.5 bg-destructive text-destructive-foreground rounded-full p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    {photos.length < 5 && (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-20 h-20 rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                      >
                        <Camera className="h-5 w-5" />
                        <span className="text-[10px]">Зураг</span>
                      </button>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handlePhotoAdd}
                    />
                  </div>
                </div>

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
      </div>
    </div>
  );
}
