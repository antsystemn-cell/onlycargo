import { useState, useEffect } from 'react';
import { Package, Truck, MapPin, Wallet, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { useDeliveryZones } from '@/hooks/useDeliveryZones';
import { useWallet } from '@/hooks/useWallet';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import type { Cargo } from '@/types/cargo';
import { formatPrice } from '@/lib/priceCalculation';
import QPayPayment from '@/components/payment/QPayPayment';
import { DeliveryMapPicker } from './DeliveryMapPicker';

interface DeliveryOrderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCargo: Cargo[];
  onSuccess: () => void;
}

export function DeliveryOrderModal({
  open,
  onOpenChange,
  selectedCargo,
  onSuccess,
}: DeliveryOrderModalProps) {
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const { zones, detectZone } = useDeliveryZones();
  const { balance } = useWallet();
  const siteSettings = useSiteSettings();

  const [deliveryType, setDeliveryType] = useState<'self_pickup' | 'delivery'>('self_pickup');
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [mapCoordinates, setMapCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Calculate totals
  const cargoPrice = selectedCargo.reduce((sum, c) => sum + (c.price || 0), 0);
  const zone = zones.find(z => z.id === selectedZone);
  const deliveryPrice = deliveryType === 'delivery' && zone ? zone.price : 0;
  const totalPrice = cargoPrice + deliveryPrice;
  const canUseWallet = balance >= totalPrice;

  // Get cargo IDs for payment
  const cargoIds = selectedCargo.map(c => c.id);

  // Reset when modal opens
  useEffect(() => {
    if (open) {
      setDeliveryType('self_pickup');
      setSelectedZone(null);
      setMapCoordinates(null);
      setShowPayment(false);
    }
  }, [open]);

  // Auto-detect zone when coordinates change
  useEffect(() => {
    if (mapCoordinates && zones.length > 0) {
      const detectedZone = detectZone(mapCoordinates.lat, mapCoordinates.lng);
      if (detectedZone) {
        setSelectedZone(detectedZone.id);
      }
    }
  }, [mapCoordinates, zones, detectZone]);

  const handleProceedToPayment = async () => {
    if (!user) return;

    if (deliveryType === 'delivery' && !selectedZone) {
      toast({ title: 'Хүргэлтийн бүсээ сонгоно уу', variant: 'destructive' });
      return;
    }

    // For self-pickup, create delivery order record first
    if (deliveryType === 'self_pickup') {
      setIsCreating(true);
      try {
        const { error: orderError } = await supabase
          .from('delivery_orders')
          .insert({
            user_id: user.id,
            delivery_type: deliveryType,
            delivery_price: 0,
            cargo_price: cargoPrice,
            total_price: cargoPrice,
            pickup_deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          });

        if (orderError) throw orderError;
      } catch (error) {
        console.error('Failed to create order:', error);
        toast({ title: 'Захиалга үүсгэхэд алдаа гарлаа', variant: 'destructive' });
        setIsCreating(false);
        return;
      }
      setIsCreating(false);
    }

    setShowPayment(true);
  };

  const handlePaymentSuccess = () => {
    toast({ title: 'Төлбөр амжилттай төлөгдлөө!' });
    onSuccess();
    onOpenChange(false);
  };

  // Get pickup storage notice from site settings
  const pickupNotice = 'Хэрэв таны ачаа Агуулахад бэлэн болсноос хойш 14 хоногийн дотор аваагүй бол хадгалалтын төлбөр тооцогдоно.';

  if (showPayment && user) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Төлбөр төлөх</DialogTitle>
          </DialogHeader>
          <QPayPayment
            cargoIds={cargoIds}
            totalAmount={totalPrice}
            userId={user.id}
            branchId={profile?.default_branch_id || null}
            onSuccess={handlePaymentSuccess}
            onClose={() => setShowPayment(false)}
          />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Ачаа авах / Хүргүүлэх
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Selected cargo summary */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">
                  Сонгосон ачаа ({selectedCargo.length})
                </span>
                <span className="font-semibold">{formatPrice(cargoPrice)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Delivery type selection */}
          <div className="space-y-3">
            <Label>Авах хэлбэр</Label>
            <RadioGroup
              value={deliveryType}
              onValueChange={(v) => setDeliveryType(v as 'self_pickup' | 'delivery')}
              className="grid grid-cols-2 gap-3"
            >
              <Label
                htmlFor="self_pickup"
                className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 cursor-pointer transition-colors ${
                  deliveryType === 'self_pickup' ? 'border-primary bg-primary/5' : 'border-muted'
                }`}
              >
                <RadioGroupItem value="self_pickup" id="self_pickup" className="sr-only" />
                <Package className="h-6 w-6" />
                <span className="text-sm font-medium">Өөрөө авах</span>
                <span className="text-xs text-muted-foreground">Үнэгүй</span>
              </Label>

              <Label
                htmlFor="delivery"
                className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 cursor-pointer transition-colors ${
                  deliveryType === 'delivery' ? 'border-primary bg-primary/5' : 'border-muted'
                }`}
              >
                <RadioGroupItem value="delivery" id="delivery" className="sr-only" />
                <Truck className="h-6 w-6" />
                <span className="text-sm font-medium">Хүргүүлэх</span>
                <span className="text-xs text-muted-foreground">Бүсээс хамаарна</span>
              </Label>
            </RadioGroup>
          </div>

          {/* Self pickup notice */}
          {deliveryType === 'self_pickup' && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                {pickupNotice}
              </AlertDescription>
            </Alert>
          )}

          {/* Delivery zone selection */}
          {deliveryType === 'delivery' && (
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Хүргэлтийн бүс сонгох
              </Label>
              
              <DeliveryMapPicker
                onLocationSelect={(coords) => setMapCoordinates(coords)}
                selectedLocation={mapCoordinates}
              />

              <RadioGroup
                value={selectedZone || ''}
                onValueChange={setSelectedZone}
                className="space-y-2"
              >
                {zones.map((zone) => (
                  <Label
                    key={zone.id}
                    htmlFor={zone.id}
                    className={`flex items-center justify-between rounded-lg border-2 p-3 cursor-pointer transition-colors ${
                      selectedZone === zone.id ? 'border-primary bg-primary/5' : 'border-muted'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <RadioGroupItem value={zone.id} id={zone.id} />
                      <div>
                        <span className="font-medium">{zone.name}</span>
                        <p className="text-xs text-muted-foreground">{zone.description}</p>
                      </div>
                    </div>
                    <span className="font-semibold">{formatPrice(zone.price)}</span>
                  </Label>
                ))}
              </RadioGroup>
            </div>
          )}

          <Separator />

          {/* Price summary */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Ачааны үнэ</span>
              <span>{formatPrice(cargoPrice)}</span>
            </div>
            {deliveryType === 'delivery' && (
              <div className="flex justify-between text-sm">
                <span>Хүргэлтийн үнэ</span>
                <span>{formatPrice(deliveryPrice)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between font-semibold">
              <span>Нийт</span>
              <span className="text-primary text-lg">{formatPrice(totalPrice)}</span>
            </div>
          </div>

          {/* Wallet balance */}
          {balance > 0 && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
              <Wallet className="h-4 w-4" />
              <span className="text-sm">Түрийвчний үлдэгдэл:</span>
              <span className={`font-semibold ${canUseWallet ? 'text-green-600' : 'text-muted-foreground'}`}>
                {formatPrice(balance)}
              </span>
            </div>
          )}

          {/* Action button */}
          <Button
            className="w-full"
            size="lg"
            onClick={handleProceedToPayment}
            disabled={isCreating || (deliveryType === 'delivery' && !selectedZone)}
          >
            {isCreating ? 'Үүсгэж байна...' : 'Төлбөр төлөх'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
