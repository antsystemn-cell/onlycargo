import { useEffect, useState } from 'react';
import { PackageX, Phone, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import CargoStatusBadge from '@/components/cargo/CargoStatusBadge';
import { format } from 'date-fns';
import type { Cargo, CargoStatus } from '@/types/cargo';

export default function UnassignedCargo() {
  const { toast } = useToast();
  const [cargo, setCargo] = useState<Cargo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCargo, setSelectedCargo] = useState<Cargo | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    fetchUnassignedCargo();
  }, []);

  const fetchUnassignedCargo = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('cargo')
        .select('*')
        .eq('phone_number', '')
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

  const handleAssignPhone = async () => {
    if (!selectedCargo || !phoneNumber) return;

    setIsAssigning(true);
    try {
      // Check if user exists
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('phone', phoneNumber)
        .maybeSingle();

      const { error } = await supabase
        .from('cargo')
        .update({
          phone_number: phoneNumber,
          user_id: profile?.id || null,
        })
        .eq('id', selectedCargo.id);

      if (error) throw error;

      toast({
        title: 'Амжилттай',
        description: 'Утасны дугаар оноогдлоо',
      });

      setCargo((prev) => prev.filter((c) => c.id !== selectedCargo.id));
      setDialogOpen(false);
      setSelectedCargo(null);
      setPhoneNumber('');
    } catch (error) {
      console.error('Failed to assign phone:', error);
      toast({
        title: 'Алдаа',
        description: 'Оноож чадсангүй',
        variant: 'destructive',
      });
    } finally {
      setIsAssigning(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Утасгүй ачаа</h1>
        <p className="text-muted-foreground">Утасны дугаар оноогдоогүй ачаанууд</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PackageX className="h-5 w-5" />
            Бүртгэл ({cargo.length})
          </CardTitle>
          <CardDescription>
            Эдгээр ачаанд утасны дугаар оноож хэрэглэгчтэй холбох боломжтой
          </CardDescription>
        </CardHeader>
        <CardContent>
          {cargo.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Утасгүй ачаа байхгүй байна
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Трак дугаар</TableHead>
                  <TableHead>Жин</TableHead>
                  <TableHead>Төлөв</TableHead>
                  <TableHead>Бүртгэсэн</TableHead>
                  <TableHead>Үйлдэл</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cargo.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono">{item.track_number}</TableCell>
                    <TableCell>{item.weight ? `${item.weight} кг` : '-'}</TableCell>
                    <TableCell>
                      <CargoStatusBadge status={item.status} />
                    </TableCell>
                    <TableCell>
                      {format(new Date(item.created_at), 'yyyy.MM.dd')}
                    </TableCell>
                    <TableCell>
                      <Dialog open={dialogOpen && selectedCargo?.id === item.id} onOpenChange={(open) => {
                        setDialogOpen(open);
                        if (!open) {
                          setSelectedCargo(null);
                          setPhoneNumber('');
                        }
                      }}>
                        <DialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedCargo(item)}
                          >
                            <Phone className="mr-2 h-3 w-3" />
                            Утас оноох
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Утасны дугаар оноох</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <p className="text-sm text-muted-foreground mb-2">Трак дугаар:</p>
                              <p className="font-mono font-medium">{selectedCargo?.track_number}</p>
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm font-medium">Утасны дугаар</label>
                              <Input
                                placeholder="99112233"
                                value={phoneNumber}
                                onChange={(e) => setPhoneNumber(e.target.value)}
                                maxLength={8}
                              />
                            </div>
                            <Button
                              className="w-full"
                              onClick={handleAssignPhone}
                              disabled={!phoneNumber || isAssigning}
                            >
                              {isAssigning ? 'Оноож байна...' : 'Оноох'}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
