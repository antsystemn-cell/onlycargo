import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Plus, Search, CreditCard, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import CargoCard from '@/components/cargo/CargoCard';
import CargoPreregistrationCard from '@/components/cargo/CargoPreregistrationCard';
import CargoDetailModal from '@/components/cargo/CargoDetailModal';
import { DeliveryOrderModal } from '@/components/delivery/DeliveryOrderModal';
import { useToast } from '@/hooks/use-toast';
import type { Cargo, CargoStatus, CargoPreregistration } from '@/types/cargo';

export default function MyCargo() {
  const { user, profile, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [cargo, setCargo] = useState<Cargo[]>([]);
  const [preregistrations, setPreregistrations] = useState<CargoPreregistration[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTrackNumber, setNewTrackNumber] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Detail modal state
  const [selectedCargo, setSelectedCargo] = useState<Cargo | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  
  // Delivery order modal state
  const [deliveryModalOpen, setDeliveryModalOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
      return;
    }

    if (user && profile) {
      fetchData();
    }
  }, [user, profile, authLoading, navigate]);

  const fetchData = async () => {
    if (!profile?.phone || !user) return;

    setIsLoading(true);
    try {
      const [cargoRes, preregRes] = await Promise.all([
        supabase
          .from('cargo')
          .select('*')
          .eq('phone_number', profile.phone)
          .neq('status', 'completed')
          .order('created_at', { ascending: false }),
        supabase
          .from('cargo_preregistrations')
          .select('*')
          .eq('user_id', user.id)
          .is('matched_cargo_id', null)
          .order('created_at', { ascending: false }),
      ]);

      if (cargoRes.error) throw cargoRes.error;
      if (preregRes.error) throw preregRes.error;

      const transformedCargo: Cargo[] = (cargoRes.data || []).map((item) => ({
        ...item,
        status: item.status as CargoStatus,
      }));

      setCargo(transformedCargo);
      setPreregistrations(preregRes.data || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePreregister = async () => {
    if (!user || !newTrackNumber.trim()) return;

    setIsSubmitting(true);
    try {
      const trackNum = newTrackNumber.trim();
      const { data: inserted, error } = await supabase
        .from('cargo_preregistrations')
        .insert({
          user_id: user.id,
          track_number: trackNum,
          description: newDescription.trim() || null,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Амжилттай',
        description: 'Ачаа урьдчилан бүртгэгдлээ',
      });

      // Fire-and-forget 17TRACK registration
      supabase.functions
        .invoke('register-17track', {
          body: {
            preregistration_id: inserted.id,
            tracking_number: trackNum,
          },
        })
        .then(({ error: fnErr }) => {
          if (fnErr) console.warn('17TRACK register failed:', fnErr);
          fetchData();
        });

      setDialogOpen(false);
      setNewTrackNumber('');
      setNewDescription('');
      fetchData();
    } catch (error) {
      console.error('Preregistration error:', error);
      toast({
        title: 'Алдаа',
        description: 'Бүртгэж чадсангүй',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };


  const handleDeletePreregistration = async (id: string) => {
    try {
      const { error } = await supabase
        .from('cargo_preregistrations')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setPreregistrations((prev) => prev.filter((p) => p.id !== id));
      toast({ title: 'Устгагдлаа' });
    } catch (error) {
      toast({
        title: 'Алдаа',
        description: 'Устгаж чадсангүй',
        variant: 'destructive',
      });
    }
  };

  const handleSelect = (id: string, selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const handleCargoClick = (cargo: Cargo) => {
    setSelectedCargo(cargo);
    setDetailModalOpen(true);
  };

  const handleDeliverySuccess = () => {
    setDeliveryModalOpen(false);
    setSelectedIds(new Set());
    fetchData();
    toast({
      title: 'Амжилттай',
      description: 'Төлбөр амжилттай төлөгдлөө',
    });
  };

  // Filter cargo that are ready for pickup (ready_warehouse status)
  const selectedCargoItems = cargo.filter((c) => selectedIds.has(c.id));
  const totalPrice = selectedCargoItems.reduce((sum, c) => sum + (c.price || 0), 0);
  
  // Check if all selected cargo are ready for payment
  const canProceed = selectedIds.size > 0 && selectedCargoItems.every(c => c.status === 'ready_warehouse' && c.price && c.price > 0);

  if (authLoading || isLoading) {
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
        <div className="mx-auto max-w-md">
          <Tabs defaultValue="active" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="active">
                Идэвхтэй ({cargo.length})
              </TabsTrigger>
              <TabsTrigger value="preregistered">
                Урьдчилсан ({preregistrations.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="space-y-4 animate-fade-in">
              {cargo.length === 0 ? (
                <Card>
                  <CardContent className="p-6 text-center text-muted-foreground">
                    <Package className="mx-auto mb-4 h-12 w-12 opacity-50" />
                    <p>Одоогоор ачаа бүртгэгдээгүй байна.</p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <div className="space-y-3">
                    {cargo.map((item) => (
                      <div 
                        key={item.id} 
                        onClick={() => handleCargoClick(item)}
                        className="cursor-pointer transition-transform active:scale-[0.98]"
                      >
                        <CargoCard
                          cargo={item}
                          showPrice
                          showCheckbox={item.status === 'ready_warehouse'}
                          selected={selectedIds.has(item.id)}
                          onSelect={(id, selected) => {
                            handleSelect(id, selected);
                          }}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Proceed Panel */}
                  {selectedIds.size > 0 && (
                    <Card className="sticky bottom-24 border-primary shadow-lg animate-slide-up">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Сонгосон ачаа</CardTitle>
                        <CardDescription>
                          {!canProceed && selectedIds.size > 0 && (
                            <span className="text-destructive text-xs">
                              Зөвхөн бэлэн болсон, үнэ тогтоогдсон ачаа төлөх боломжтой
                            </span>
                          )}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">
                            {selectedIds.size} ширхэг
                          </span>
                          <span className="text-xl font-bold text-primary">
                            {totalPrice.toLocaleString()}₮
                          </span>
                        </div>
                        <Button 
                          className="w-full" 
                          disabled={!canProceed}
                          onClick={() => setDeliveryModalOpen(true)}
                        >
                          <CreditCard className="mr-2 h-4 w-4" />
                          Үргэлжлүүлэх
                        </Button>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </TabsContent>

            <TabsContent value="preregistered" className="space-y-4 animate-fade-in">
              {preregistrations.length === 0 ? (
                <Card>
                  <CardContent className="p-6 text-center text-muted-foreground">
                    <Search className="mx-auto mb-4 h-12 w-12 opacity-50" />
                    <p>Урьдчилан бүртгэсэн ачаа байхгүй.</p>
                    <p className="text-sm mt-2">
                      Захиалга өгөхдөө трак дугаараа урьдчилан бүртгэснээр
                      <br />ачаа ирэхэд автоматаар холбогдоно.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {preregistrations.map((item) => (
                    <CargoPreregistrationCard
                      key={item.id}
                      preregistration={item}
                      onDelete={handleDeletePreregistration}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Cargo Detail Modal */}
      <CargoDetailModal
        cargo={selectedCargo}
        open={detailModalOpen}
        onOpenChange={setDetailModalOpen}
      />

      {/* Delivery Order Modal (replaces direct QPay payment) */}
      <DeliveryOrderModal
        open={deliveryModalOpen}
        onOpenChange={setDeliveryModalOpen}
        selectedCargo={selectedCargoItems}
        onSuccess={handleDeliverySuccess}
      />
    </div>
  );
}
