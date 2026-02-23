import { useState, useEffect } from 'react';
import { Package, Truck, MapPin, AlertCircle, ChevronRight, Plus, Check, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { useDeliveryZones } from '@/hooks/useDeliveryZones';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import type { Cargo, DeliveryAddress } from '@/types/cargo';
import { formatPrice } from '@/lib/priceCalculation';
import QPayPayment from '@/components/payment/QPayPayment';
import { DeliveryMapPicker } from './DeliveryMapPicker';

interface DeliveryOrderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCargo: Cargo[];
  onSuccess: () => void;
}

type Step = 'choice' | 'address' | 'payment';

const STEPS: { key: Step; label: string }[] = [
  { key: 'choice', label: 'Сонголт' },
  { key: 'address', label: 'Хаяг' },
  { key: 'payment', label: 'Төлбөр' },
];

export function DeliveryOrderModal({
  open,
  onOpenChange,
  selectedCargo,
  onSuccess,
}: DeliveryOrderModalProps) {
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const { zones, detectZone } = useDeliveryZones();

  const [step, setStep] = useState<Step>('choice');
  const [deliveryType, setDeliveryType] = useState<'self_pickup' | 'delivery' | null>(null);
  
  // Address state
  const [addresses, setAddresses] = useState<DeliveryAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [showNewAddressForm, setShowNewAddressForm] = useState(false);
  const [newAddress, setNewAddress] = useState({ label: '', address_line: '', phone: '', district: '' });
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  
  // Map / zone state
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [mapCoordinates, setMapCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  
  // Payment state
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);

  // Calculate totals
  const cargoPrice = selectedCargo.reduce((sum, c) => sum + (c.price || 0), 0);
  const zone = zones.find(z => z.id === selectedZone);
  const deliveryPrice = deliveryType === 'delivery' && zone ? zone.price : 0;
  const totalPrice = cargoPrice + deliveryPrice;
  const cargoIds = selectedCargo.map(c => c.id);

  // Reset when modal opens
  useEffect(() => {
    if (open) {
      setStep('choice');
      setDeliveryType(null);
      setSelectedZone(null);
      setMapCoordinates(null);
      setSelectedAddressId(null);
      setShowNewAddressForm(false);
      setCreatedOrderId(null);
      setNewAddress({ label: '', address_line: '', phone: '', district: '' });
      fetchAddresses();
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

  const fetchAddresses = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('delivery_addresses')
      .select('*')
      .eq('user_id', user.id)
      .order('is_default', { ascending: false });
    if (data) setAddresses(data as DeliveryAddress[]);
  };

  const handleSaveNewAddress = async () => {
    if (!user || !newAddress.address_line.trim()) return;
    setIsSavingAddress(true);
    try {
      const { data, error } = await supabase
        .from('delivery_addresses')
        .insert({
          user_id: user.id,
          label: newAddress.label.trim() || 'Гэр',
          address_line: newAddress.address_line.trim(),
          phone: newAddress.phone.trim() || null,
          district: newAddress.district.trim() || null,
        })
        .select()
        .single();
      if (error) throw error;
      setAddresses(prev => [...prev, data as DeliveryAddress]);
      setSelectedAddressId(data.id);
      setShowNewAddressForm(false);
      setNewAddress({ label: '', address_line: '', phone: '', district: '' });
      toast({ title: 'Хаяг хадгалагдлаа' });
    } catch {
      toast({ title: 'Хаяг хадгалахад алдаа гарлаа', variant: 'destructive' });
    } finally {
      setIsSavingAddress(false);
    }
  };

  const handleChoiceProceed = () => {
    if (!deliveryType) return;
    if (deliveryType === 'self_pickup') {
      // Skip address step for self-pickup, go straight to payment
      setStep('payment');
      createDeliveryOrder('self_pickup');
    } else {
      setStep('address');
    }
  };

  const handleAddressProceed = () => {
    if (!selectedAddressId || !selectedZone || !mapCoordinates) {
      toast({ title: 'Хаяг, газрын зураг дээр байршил сонгоно уу', variant: 'destructive' });
      return;
    }
    createDeliveryOrder('delivery');
  };

  const createDeliveryOrder = async (type: 'self_pickup' | 'delivery') => {
    if (!user) return;
    setIsCreatingOrder(true);
    try {
      const orderData: any = {
        user_id: user.id,
        delivery_type: type,
        cargo_price: cargoPrice,
        total_price: type === 'delivery' ? totalPrice : cargoPrice,
        delivery_price: type === 'delivery' ? deliveryPrice : 0,
      };

      if (type === 'self_pickup') {
        orderData.pickup_deadline = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
      } else {
        orderData.delivery_address_id = selectedAddressId;
        orderData.delivery_zone_id = selectedZone;
        orderData.map_coordinates = mapCoordinates;
      }

      const { data: order, error } = await supabase
        .from('delivery_orders')
        .insert(orderData)
        .select()
        .single();

      if (error) throw error;

      // Insert delivery_order_items
      const items = selectedCargo.map(c => ({
        delivery_order_id: order.id,
        cargo_id: c.id,
        price: c.price || 0,
      }));

      const { error: itemsError } = await supabase
        .from('delivery_order_items')
        .insert(items);

      if (itemsError) throw itemsError;

      setCreatedOrderId(order.id);
      setStep('payment');
    } catch (error) {
      console.error('Failed to create delivery order:', error);
      toast({ title: 'Захиалга үүсгэхэд алдаа гарлаа', variant: 'destructive' });
    } finally {
      setIsCreatingOrder(false);
    }
  };

  const handlePaymentSuccess = async () => {
    // Update delivery order status
    if (createdOrderId) {
      await supabase
        .from('delivery_orders')
        .update({ status: 'paid' })
        .eq('id', createdOrderId);
    }
    onSuccess();
    onOpenChange(false);
  };

  const canProceedFromChoice = deliveryType !== null;
  const canProceedFromAddress = selectedAddressId && selectedZone && mapCoordinates;

  // Step indicator
  const activeSteps = deliveryType === 'self_pickup' 
    ? STEPS.filter(s => s.key !== 'address') 
    : STEPS;

  const currentStepIndex = activeSteps.findIndex(s => s.key === step);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Ачаа авах / Хүргүүлэх
          </DialogTitle>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-1 pb-2">
          {activeSteps.map((s, i) => (
            <div key={s.key} className="flex items-center gap-1">
              <div className={`flex items-center justify-center h-7 w-7 rounded-full text-xs font-medium transition-colors ${
                i <= currentStepIndex 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted text-muted-foreground'
              }`}>
                {i < currentStepIndex ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              <span className={`text-xs hidden sm:inline ${i <= currentStepIndex ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                {s.label}
              </span>
              {i < activeSteps.length - 1 && (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground mx-1" />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Choice */}
        {step === 'choice' && (
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
              <Label className="text-sm font-medium">Авах хэлбэрээ сонгоно уу</Label>
              <RadioGroup
                value={deliveryType || ''}
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
                  Хэрэв таны ачаа Агуулахад бэлэн болсноос хойш 14 хоногийн дотор аваагүй бол хадгалалтын төлбөр тооцогдоно.
                </AlertDescription>
              </Alert>
            )}

            <Button
              className="w-full"
              size="lg"
              onClick={handleChoiceProceed}
              disabled={!canProceedFromChoice || isCreatingOrder}
            >
              {isCreatingOrder ? 'Үүсгэж байна...' : 'Үргэлжлүүлэх'}
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Step 2: Address (delivery only) */}
        {step === 'address' && (
          <div className="space-y-4">
            <Button variant="ghost" size="sm" onClick={() => setStep('choice')} className="mb-1 -ml-2">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Буцах
            </Button>

            {/* Saved addresses */}
            {!showNewAddressForm && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">Хүргэлтийн хаяг</Label>
                {addresses.length > 0 ? (
                  <RadioGroup
                    value={selectedAddressId || ''}
                    onValueChange={setSelectedAddressId}
                    className="space-y-2"
                  >
                    {addresses.map((addr) => (
                      <Label
                        key={addr.id}
                        htmlFor={`addr-${addr.id}`}
                        className={`flex items-start gap-3 rounded-lg border-2 p-3 cursor-pointer transition-colors ${
                          selectedAddressId === addr.id ? 'border-primary bg-primary/5' : 'border-muted'
                        }`}
                      >
                        <RadioGroupItem value={addr.id} id={`addr-${addr.id}`} className="mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{addr.label}</span>
                            {addr.is_default && (
                              <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">Үндсэн</span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">{addr.address_line}</p>
                          {addr.phone && <p className="text-xs text-muted-foreground">{addr.phone}</p>}
                        </div>
                      </Label>
                    ))}
                  </RadioGroup>
                ) : (
                  <p className="text-sm text-muted-foreground">Хадгалсан хаяг байхгүй байна.</p>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setShowNewAddressForm(true)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Шинэ хаяг нэмэх
                </Button>
              </div>
            )}

            {/* New address form */}
            {showNewAddressForm && (
              <div className="space-y-3 rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Шинэ хаяг нэмэх</Label>
                  <Button variant="ghost" size="sm" onClick={() => setShowNewAddressForm(false)}>
                    Цуцлах
                  </Button>
                </div>
                <div className="space-y-2">
                  <Input
                    placeholder="Хаягийн нэр (Гэр, Ажлын газар...)"
                    value={newAddress.label}
                    onChange={(e) => setNewAddress(p => ({ ...p, label: e.target.value }))}
                  />
                  <Input
                    placeholder="Утасны дугаар"
                    value={newAddress.phone}
                    onChange={(e) => setNewAddress(p => ({ ...p, phone: e.target.value }))}
                  />
                  <Input
                    placeholder="Дүүрэг"
                    value={newAddress.district}
                    onChange={(e) => setNewAddress(p => ({ ...p, district: e.target.value }))}
                  />
                  <Textarea
                    placeholder="Дэлгэрэнгүй хаяг (Байр, орц, тоот...)"
                    value={newAddress.address_line}
                    onChange={(e) => setNewAddress(p => ({ ...p, address_line: e.target.value }))}
                    rows={2}
                  />
                </div>
                <Button
                  className="w-full"
                  size="sm"
                  onClick={handleSaveNewAddress}
                  disabled={!newAddress.address_line.trim() || isSavingAddress}
                >
                  {isSavingAddress ? 'Хадгалж байна...' : 'Хаяг хадгалах'}
                </Button>
              </div>
            )}

            <Separator />

            {/* Map & Zone selection */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <MapPin className="h-4 w-4" />
                Хүргэлтийн байршил
              </Label>
              
              <DeliveryMapPicker
                onLocationSelect={(coords) => setMapCoordinates(coords)}
                selectedLocation={mapCoordinates}
              />

              {!mapCoordinates && (
                <p className="text-xs text-destructive">Газрын зураг дээр байршилаа сонгоно уу</p>
              )}

              {/* Zone list */}
              <RadioGroup
                value={selectedZone || ''}
                onValueChange={setSelectedZone}
                className="space-y-2"
              >
                {zones.map((z) => (
                  <Label
                    key={z.id}
                    htmlFor={`zone-${z.id}`}
                    className={`flex items-center justify-between rounded-lg border-2 p-3 cursor-pointer transition-colors ${
                      selectedZone === z.id ? 'border-primary bg-primary/5' : 'border-muted'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <RadioGroupItem value={z.id} id={`zone-${z.id}`} />
                      <div>
                        <span className="font-medium text-sm">{z.name}</span>
                        {z.description && <p className="text-xs text-muted-foreground">{z.description}</p>}
                      </div>
                    </div>
                    <span className="font-semibold text-sm">{formatPrice(z.price)}</span>
                  </Label>
                ))}
              </RadioGroup>
            </div>

            <Separator />

            {/* Price breakdown */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Ачааны үнэ</span>
                <span>{formatPrice(cargoPrice)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Хүргэлтийн үнэ</span>
                <span>{formatPrice(deliveryPrice)}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-semibold">
                <span>Нийт</span>
                <span className="text-primary text-lg">{formatPrice(totalPrice)}</span>
              </div>
            </div>

            <Button
              className="w-full"
              size="lg"
              onClick={handleAddressProceed}
              disabled={!canProceedFromAddress || isCreatingOrder}
            >
              {isCreatingOrder ? 'Үүсгэж байна...' : 'Төлбөр төлөх'}
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Step 3: Payment */}
        {step === 'payment' && user && (
          <div className="space-y-4">
            {deliveryType === 'delivery' && (
              <Button variant="ghost" size="sm" onClick={() => setStep('address')} className="mb-1 -ml-2">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Буцах
              </Button>
            )}

            {/* Price summary */}
            <Card>
              <CardContent className="pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Ачааны үнэ ({selectedCargo.length})</span>
                  <span>{formatPrice(cargoPrice)}</span>
                </div>
                {deliveryType === 'delivery' && (
                  <div className="flex justify-between text-sm">
                    <span>Хүргэлтийн үнэ</span>
                    <span>{formatPrice(deliveryPrice)}</span>
                  </div>
                )}
                {deliveryType === 'self_pickup' && (
                  <Alert className="mt-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      14 хоногийн дотор ачаагаа авна уу. Хугацаа хэтэрвэл хадгалалтын төлбөр тооцогдоно.
                    </AlertDescription>
                  </Alert>
                )}
                <Separator />
                <div className="flex justify-between font-semibold">
                  <span>Нийт</span>
                  <span className="text-primary text-lg">
                    {formatPrice(deliveryType === 'delivery' ? totalPrice : cargoPrice)}
                  </span>
                </div>
              </CardContent>
            </Card>

            <QPayPayment
              cargoIds={cargoIds}
              totalAmount={deliveryType === 'delivery' ? totalPrice : cargoPrice}
              userId={user.id}
              branchId={profile?.default_branch_id || null}
              onSuccess={handlePaymentSuccess}
              onClose={() => onOpenChange(false)}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
