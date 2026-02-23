import { useState, useEffect } from 'react';
import { Truck, Package, MapPin, CreditCard, ExternalLink, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { formatPrice } from '@/lib/priceCalculation';

interface DeliveryOrderRow {
  id: string;
  user_id: string;
  delivery_type: string;
  delivery_price: number | null;
  cargo_price: number;
  total_price: number;
  status: string;
  pickup_deadline: string | null;
  map_coordinates: any;
  notes: string | null;
  created_at: string;
  delivery_zone_id: string | null;
  delivery_address_id: string | null;
  payment_id: string | null;
}

interface DeliveryOrderItem {
  id: string;
  cargo_id: string;
  price: number;
}

export default function DeliveryOrders() {
  const [orders, setOrders] = useState<DeliveryOrderRow[]>([]);
  const [items, setItems] = useState<Record<string, DeliveryOrderItem[]>>({});
  const [zones, setZones] = useState<Record<string, string>>({});
  const [addresses, setAddresses] = useState<Record<string, string>>({});
  const [profiles, setProfiles] = useState<Record<string, { phone: string; full_name: string | null }>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch orders
      const { data: ordersData } = await supabase
        .from('delivery_orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (!ordersData) return;
      setOrders(ordersData as DeliveryOrderRow[]);

      // Fetch related data in parallel
      const orderIds = ordersData.map(o => o.id);
      const userIds = [...new Set(ordersData.map(o => o.user_id))];
      const zoneIds = [...new Set(ordersData.map(o => o.delivery_zone_id).filter(Boolean))] as string[];
      const addressIds = [...new Set(ordersData.map(o => o.delivery_address_id).filter(Boolean))] as string[];

      const [itemsRes, zonesRes, addressRes, profilesRes] = await Promise.all([
        orderIds.length > 0 
          ? supabase.from('delivery_order_items').select('*').in('delivery_order_id', orderIds)
          : Promise.resolve({ data: [] }),
        zoneIds.length > 0
          ? supabase.from('delivery_zones').select('id, name').in('id', zoneIds)
          : Promise.resolve({ data: [] }),
        addressIds.length > 0
          ? supabase.from('delivery_addresses').select('id, address_line, label').in('id', addressIds)
          : Promise.resolve({ data: [] }),
        userIds.length > 0
          ? supabase.from('profiles').select('id, phone, full_name').in('id', userIds)
          : Promise.resolve({ data: [] }),
      ]);

      // Map items by order
      const itemsMap: Record<string, DeliveryOrderItem[]> = {};
      (itemsRes.data || []).forEach((item: any) => {
        if (!itemsMap[item.delivery_order_id]) itemsMap[item.delivery_order_id] = [];
        itemsMap[item.delivery_order_id].push(item);
      });
      setItems(itemsMap);

      // Map zones
      const zonesMap: Record<string, string> = {};
      (zonesRes.data || []).forEach((z: any) => { zonesMap[z.id] = z.name; });
      setZones(zonesMap);

      // Map addresses
      const addrMap: Record<string, string> = {};
      (addressRes.data || []).forEach((a: any) => { addrMap[a.id] = `${a.label}: ${a.address_line}`; });
      setAddresses(addrMap);

      // Map profiles
      const profMap: Record<string, { phone: string; full_name: string | null }> = {};
      (profilesRes.data || []).forEach((p: any) => { profMap[p.id] = { phone: p.phone, full_name: p.full_name }; });
      setProfiles(profMap);

    } catch (error) {
      console.error('Failed to fetch delivery orders:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      pending: 'secondary',
      paid: 'default',
      processing: 'outline',
      delivering: 'outline',
      completed: 'default',
      cancelled: 'destructive',
    };
    const labels: Record<string, string> = {
      pending: 'Хүлээгдэж байна',
      paid: 'Төлөгдсөн',
      processing: 'Боловсруулж байна',
      delivering: 'Хүргэж байна',
      completed: 'Дуусгасан',
      cancelled: 'Цуцлагдсан',
    };
    return <Badge variant={variants[status] || 'secondary'}>{labels[status] || status}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Хүргэлтийн захиалгууд</h1>
        <p className="text-muted-foreground">Хүргэлт болон өөрөө авах захиалгууд</p>
      </div>

      {orders.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            <Truck className="mx-auto mb-4 h-12 w-12 opacity-50" />
            <p>Захиалга байхгүй байна.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const profile = profiles[order.user_id];
            const orderItems = items[order.id] || [];
            const coords = order.map_coordinates as { lat: number; lng: number } | null;

            return (
              <Card key={order.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      {order.delivery_type === 'delivery' ? (
                        <Truck className="h-4 w-4 text-primary" />
                      ) : (
                        <Package className="h-4 w-4 text-primary" />
                      )}
                      <Badge variant="outline" className="font-normal">
                        {order.delivery_type === 'delivery' ? 'Хүргэлт' : 'Өөрөө авах'}
                      </Badge>
                    </CardTitle>
                    {getStatusBadge(order.status)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* User info */}
                  {profile && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Хэрэглэгч: </span>
                      <span className="font-medium">{profile.full_name || profile.phone}</span>
                      {profile.full_name && <span className="text-muted-foreground ml-2">({profile.phone})</span>}
                    </div>
                  )}

                  {/* Price breakdown */}
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Ачааны үнэ ({orderItems.length})</span>
                      <span>{formatPrice(order.cargo_price)}</span>
                    </div>
                    {order.delivery_type === 'delivery' && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Хүргэлтийн үнэ</span>
                        <span>{formatPrice(order.delivery_price || 0)}</span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between font-semibold">
                      <span>Нийт</span>
                      <span className="text-primary">{formatPrice(order.total_price)}</span>
                    </div>
                  </div>

                  {/* Delivery info */}
                  {order.delivery_type === 'delivery' && (
                    <div className="space-y-1 text-sm">
                      {order.delivery_zone_id && zones[order.delivery_zone_id] && (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>Бүс: {zones[order.delivery_zone_id]}</span>
                        </div>
                      )}
                      {order.delivery_address_id && addresses[order.delivery_address_id] && (
                        <div className="flex items-start gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
                          <span className="text-xs">{addresses[order.delivery_address_id]}</span>
                        </div>
                      )}
                      {coords && (
                        <div className="text-xs text-muted-foreground">
                          Координат: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Pickup deadline */}
                  {order.delivery_type === 'self_pickup' && order.pickup_deadline && (
                    <div className="flex items-center gap-1.5 text-sm">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>Авах хугацаа: {new Date(order.pickup_deadline).toLocaleDateString('mn-MN')}</span>
                    </div>
                  )}

                  {/* Date */}
                  <div className="text-xs text-muted-foreground">
                    {new Date(order.created_at).toLocaleString('mn-MN')}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
