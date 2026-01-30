import { useEffect, useState } from 'react';
import { Package, PackagePlus, Truck, Warehouse, MapPin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';

interface Stats {
  registered: number;
  receivedEreen: number;
  transporting: number;
  readyWarehouse: number;
  todayRegistrations: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    registered: 0,
    receivedEreen: 0,
    transporting: 0,
    readyWarehouse: 0,
    todayRegistrations: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [registered, receivedEreen, transporting, readyWarehouse, todayCount] = await Promise.all([
        supabase.from('cargo').select('id', { count: 'exact', head: true }).eq('status', 'registered'),
        supabase.from('cargo').select('id', { count: 'exact', head: true }).eq('status', 'received_ereen'),
        supabase.from('cargo').select('id', { count: 'exact', head: true }).eq('status', 'transporting'),
        supabase.from('cargo').select('id', { count: 'exact', head: true }).eq('status', 'ready_warehouse'),
        supabase
          .from('cargo')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', today.toISOString()),
      ]);

      setStats({
        registered: registered.count || 0,
        receivedEreen: receivedEreen.count || 0,
        transporting: transporting.count || 0,
        readyWarehouse: readyWarehouse.count || 0,
        todayRegistrations: todayCount.count || 0,
      });
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const statCards = [
    {
      title: 'Бүртгэгдсэн',
      value: stats.registered,
      icon: Package,
      color: 'text-blue-600 bg-blue-100',
    },
    {
      title: 'Эрээнд хүлээн авсан',
      value: stats.receivedEreen,
      icon: MapPin,
      color: 'text-orange-600 bg-orange-100',
    },
    {
      title: 'Тээвэрлэгдэж байна',
      value: stats.transporting,
      icon: Truck,
      color: 'text-yellow-600 bg-yellow-100',
    },
    {
      title: 'Агуулахад бэлэн',
      value: stats.readyWarehouse,
      icon: Warehouse,
      color: 'text-green-600 bg-green-100',
    },
    {
      title: 'Өнөөдөр бүртгэсэн',
      value: stats.todayRegistrations,
      icon: PackagePlus,
      color: 'text-purple-600 bg-purple-100',
    },
  ];

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
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Ачааны ерөнхий мэдээлэл</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {statCards.map((card) => (
          <Card key={card.title} className="overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              <div className={`rounded-full p-2 ${card.color}`}>
                <card.icon className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
