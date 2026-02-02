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
import BarcodeScanner from '@/components/barcode/BarcodeScanner';

const cargoSchema = z.object({
  track_number: z.string().min(1, 'Трак дугаар оруулна уу'),
  phone_number: z.string().regex(/^[6-9]\d{7}$/, 'Утасны дугаар буруу байна').optional().or(z.literal('')),
  weight: z.string().optional(),
  length: z.string().optional(),
  width: z.string().optional(),
  height: z.string().optional(),
  shelf_location: z.string().optional(),
  notes: z.string().optional(),
});

type CargoFormValues = z.infer<typeof cargoSchema>;

const shelfOptions = ['A1', 'A2', 'A3', 'B1', 'B2', 'B3', 'C1', 'C2', 'C3'];

export default function CargoRegister() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registeredCount, setRegisteredCount] = useState(0);

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
    },
  });

  const calculatePrice = (weight: number, length: number, width: number, height: number) => {
    const volumetricWeight = (length * width * height) / 5000;
    const chargedWeight = Math.max(weight, volumetricWeight);
    return Math.ceil(chargedWeight) * 8000; // 8000₮ per kg
  };

  const onSubmit = async (data: CargoFormValues) => {
    setIsSubmitting(true);
    try {
      const weight = parseFloat(data.weight || '0');
      const length = parseFloat(data.length || '0');
      const width = parseFloat(data.width || '0');
      const height = parseFloat(data.height || '0');
      const price = calculatePrice(weight, length, width, height);

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
        price: price > 0 ? price : null,
        shelf_location: data.shelf_location || null,
        notes: data.notes || null,
        status: 'registered',
      });

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
        toast({
          title: 'Амжилттай',
          description: 'Ачаа бүртгэгдлээ',
        });
        setRegisteredCount((prev) => prev + 1);
        form.reset();
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
                          <Input type="number" step="0.01" placeholder="0.00" {...field} />
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
                          <Input type="number" step="0.1" placeholder="0" {...field} />
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
                          <Input type="number" step="0.1" placeholder="0" {...field} />
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
                          <Input type="number" step="0.1" placeholder="0" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

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
