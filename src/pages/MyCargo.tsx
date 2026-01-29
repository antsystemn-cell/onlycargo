import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import CargoCard from '@/components/cargo/CargoCard';
import type { Cargo, CargoStatus } from '@/types/cargo';

export default function MyCargo() {
  const { user, profile, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [cargo, setCargo] = useState<Cargo[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
      return;
    }

    if (user && profile) {
      fetchCargo();
    }
  }, [user, profile, authLoading, navigate]);

  const fetchCargo = async () => {
    if (!profile?.phone) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('cargo')
        .select('*')
        .eq('phone_number', profile.phone)
        .neq('status', 'completed')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const transformedData: Cargo[] = (data || []).map((item) => ({
        ...item,
        status: item.status as CargoStatus,
      }));

      setCargo(transformedData);
    } catch (error) {
      console.error('Failed to fetch cargo:', error);
    } finally {
      setIsLoading(false);
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

  const selectedCargo = cargo.filter((c) => selectedIds.has(c.id));
  const totalPrice = selectedCargo.reduce((sum, c) => sum + (c.price || 0), 0);

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
      <header className="sticky top-0 z-40 border-b bg-card px-4 py-3">
        <div className="mx-auto flex max-w-md items-center gap-2">
          <Package className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold">Миний ачаа</h1>
        </div>
      </header>

      <main className="flex-1 px-4 py-6">
        <div className="mx-auto max-w-md space-y-4">
          {cargo.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                <Package className="mx-auto mb-4 h-12 w-12" />
                <p>Одоогоор ачаа бүртгэгдээгүй байна.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="space-y-3">
                {cargo.map((item) => (
                  <CargoCard
                    key={item.id}
                    cargo={item}
                    showPrice
                    showCheckbox
                    selected={selectedIds.has(item.id)}
                    onSelect={handleSelect}
                  />
                ))}
              </div>

              {/* Payment Section */}
              {selectedIds.size > 0 && (
                <Card className="sticky bottom-20 border-primary">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <CreditCard className="h-4 w-4" />
                      Төлбөр
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">
                        Сонгосон: {selectedIds.size} ширхэг
                      </span>
                      <span className="text-xl font-bold text-primary">
                        {totalPrice.toLocaleString()}₮
                      </span>
                    </div>
                    <Button className="w-full" disabled>
                      QPay-ээр төлөх (Тун удахгүй)
                    </Button>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
