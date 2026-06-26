import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Package, LogIn, Search as SearchIcon, Plus, Truck, MapPin, Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { supabase } from '@/integrations/supabase/client';
import CargoCard from '@/components/cargo/CargoCard';
import CargoPublicCard from '@/components/cargo/CargoPublicCard';
import type { Cargo, CargoPublic, CargoStatus } from '@/types/cargo';

export default function Home() {
  const { user, profile, isAdmin, isLoading } = useAuth();
  const { logoUrl } = useSiteSettings();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Cargo[]>([]);
  const [publicSearchResults, setPublicSearchResults] = useState<CargoPublic[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = query.trim();
    if (!q) return;
    setIsSearching(true);
    setHasSearched(true);
    setSearchResults([]);
    setPublicSearchResults([]);

    try {
      if (user) {
        const { data, error } = await supabase
          .from('cargo')
          .select('*')
          .or(`track_number.ilike.%${q}%,phone_number.ilike.%${q}%`)
          .order('created_at', { ascending: false })
          .limit(20);
        if (error) throw error;
        setSearchResults((data || []).map((item) => ({ ...item, status: item.status as CargoStatus })));
      } else {
        const { data, error } = await supabase
          .from('cargo_public')
          .select('*')
          .ilike('track_number', `%${q}%`)
          .order('created_at', { ascending: false })
          .limit(20);
        if (error) throw error;
        setPublicSearchResults((data || []).map((item) => ({ ...item, status: item.status as CargoStatus | null })));
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const features = [
    {
      title: 'Илгээмж шалгах',
      description: 'Илгээмжийн хүргэлт хянах',
      to: user ? '/my-cargo' : '/auth',
      icon: Truck,
      bg: 'from-amber-50 to-orange-50',
      iconWrap: 'bg-amber-100 text-amber-700',
    },
    {
      title: 'Хаяг холбох',
      description: 'Агуулахын хаягийн мэдээлэл',
      to: '/china-address',
      icon: MapPin,
      bg: 'from-sky-50 to-blue-50',
      iconWrap: 'bg-sky-100 text-sky-700',
    },
    {
      title: 'Тооцоолуур',
      description: 'Илгээмжийн үнийн дүн тооцоолох',
      to: '/calculator',
      icon: Calculator,
      bg: 'from-slate-50 to-zinc-100',
      iconWrap: 'bg-slate-200 text-slate-700',
      ribbon: 'Тун удахгүй',
    },
  ];

  return (
    <div className="flex flex-col bg-background min-h-screen">
      <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur-sm px-4 py-3">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={logoUrl} alt="Logo" className="h-8 w-8 object-contain" />
            <h1 className="text-lg font-bold">OnlyCargo</h1>
          </div>
          {user ? (
            <div className="flex items-center gap-2">
              {isAdmin && (
                <Button variant="outline" size="sm" onClick={() => navigate('/admin')}>
                  Admin
                </Button>
              )}
              <span className="text-sm text-muted-foreground">{profile?.phone}</span>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => navigate('/auth')}>
              <LogIn className="mr-2 h-4 w-4" />
              Нэвтрэх
            </Button>
          )}
        </div>
      </header>

      <main className="flex-1 px-4 py-5">
        <div className="mx-auto max-w-md space-y-4">
          {/* Hero banner with search */}
          <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/90 to-primary shadow-sm">
            <div className="absolute inset-0 opacity-20">
              <Truck className="absolute -right-6 -bottom-6 h-48 w-48 text-white" />
            </div>
            <div className="relative p-5">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
                <Package className="h-3.5 w-3.5" />
                Илгээмж бүртгэх
              </div>
              <form onSubmit={handleSearch} className="flex gap-2">
                <Input
                  type="text"
                  placeholder="Трак дугаараа оруулна уу..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="flex-1 bg-white border-0 h-11"
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={isSearching || !query.trim()}
                  className="h-11 w-11 bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-sm"
                >
                  {isSearching ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : (
                    <Plus className="h-5 w-5" />
                  )}
                </Button>
              </form>
            </div>
          </div>

          {/* Search results */}
          {hasSearched && (
            <section className="animate-fade-in">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <SearchIcon className="h-4 w-4" />
                Хайлтын үр дүн ({user ? searchResults.length : publicSearchResults.length})
              </h2>
              {user ? (
                searchResults.length === 0 ? (
                  <Card><CardContent className="p-6 text-center text-muted-foreground">Ачаа олдсонгүй</CardContent></Card>
                ) : (
                  <div className="space-y-3">
                    {searchResults.map((cargo) => (<CargoCard key={cargo.id} cargo={cargo} showPrice />))}
                  </div>
                )
              ) : publicSearchResults.length === 0 ? (
                <Card><CardContent className="p-6 text-center text-muted-foreground">Ачаа олдсонгүй</CardContent></Card>
              ) : (
                <div className="space-y-3">
                  {publicSearchResults.map((cargo) => (<CargoPublicCard key={cargo.id || cargo.track_number} cargo={cargo} />))}
                  <Card className="border-primary/20 bg-primary/5">
                    <CardContent className="p-4 text-center">
                      <p className="text-sm text-muted-foreground mb-2">Дэлгэрэнгүй мэдээлэл харахын тулд нэвтэрнэ үү</p>
                      <Link to="/auth"><Button size="sm"><LogIn className="mr-2 h-4 w-4" />Нэвтрэх</Button></Link>
                    </CardContent>
                  </Card>
                </div>
              )}
            </section>
          )}

          {/* Feature cards */}
          <div className="space-y-3 pt-1">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <Link key={f.title} to={f.to} className="block">
                  <div className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br ${f.bg} transition-all hover:shadow-md hover:-translate-y-0.5`}>
                    {f.ribbon && (
                      <div className="absolute -left-8 top-4 -rotate-45 bg-primary px-10 py-1 text-[10px] font-semibold text-primary-foreground shadow">
                        {f.ribbon}
                      </div>
                    )}
                    <div className="flex items-center justify-between p-5 pr-4 min-h-[110px]">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-semibold text-foreground">{f.title}</h3>
                        <p className="mt-1 text-xs text-muted-foreground">{f.description}</p>
                      </div>
                      <div className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl ${f.iconWrap} shadow-sm`}>
                        <Icon className="h-10 w-10" strokeWidth={1.5} />
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
