import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Package, LogIn, Search as SearchIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { supabase } from '@/integrations/supabase/client';
import NotificationBanner from '@/components/home/NotificationBanner';
import HomepageBanner from '@/components/home/HomepageBanner';
import HomepageWidgets from '@/components/home/HomepageWidgets';
import QuickSearch from '@/components/home/QuickSearch';
import CargoCard from '@/components/cargo/CargoCard';
import CargoPublicCard from '@/components/cargo/CargoPublicCard';
import type { Cargo, CargoPublic, CargoStatus } from '@/types/cargo';

export default function Home() {
  const { user, profile, isAdmin, isLoading } = useAuth();
  const { logoUrl } = useSiteSettings();
  const navigate = useNavigate();
  const [searchResults, setSearchResults] = useState<Cargo[]>([]);
  const [publicSearchResults, setPublicSearchResults] = useState<CargoPublic[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (query: string) => {
    setIsSearching(true);
    setHasSearched(true);
    setSearchResults([]);
    setPublicSearchResults([]);

    try {
      if (user) {
        const { data, error } = await supabase
          .from('cargo')
          .select('*')
          .or(`track_number.ilike.%${query}%,phone_number.ilike.%${query}%`)
          .order('created_at', { ascending: false })
          .limit(20);

        if (error) throw error;

        const transformedData: Cargo[] = (data || []).map((item) => ({
          ...item,
          status: item.status as CargoStatus,
        }));

        setSearchResults(transformedData);
      } else {
        const { data, error } = await supabase
          .from('cargo_public')
          .select('*')
          .ilike('track_number', `%${query}%`)
          .order('created_at', { ascending: false })
          .limit(20);

        if (error) throw error;

        const transformedData: CargoPublic[] = (data || []).map((item) => ({
          ...item,
          status: item.status as CargoStatus | null,
        }));

        setPublicSearchResults(transformedData);
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

  return (
    <div className="flex flex-col">
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

      <NotificationBanner />

      <main className="flex-1 px-4 py-6">
        <div className="mx-auto max-w-md space-y-6">
          <HomepageBanner />
          <HomepageWidgets />

          <section>
            <h2 className="mb-3 text-sm font-medium text-muted-foreground">Ачаа хайх</h2>
            <QuickSearch onSearch={handleSearch} isLoading={isSearching} />
          </section>

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
              ) : (
                publicSearchResults.length === 0 ? (
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
                )
              )}
            </section>
          )}

          {!user && !hasSearched && (
            <Card>
              <CardContent className="p-6 text-center">
                <Package className="mx-auto mb-4 h-12 w-12 text-muted-foreground opacity-50" />
                <h3 className="mb-2 font-semibold">Ачаа хянах</h3>
                <p className="mb-4 text-sm text-muted-foreground">
                  Нэвтэрч орсноор бүх ачааны дэлгэрэнгүй мэдээллийг харах боломжтой.
                </p>
                <Button onClick={() => navigate('/auth')} className="w-full">Нэвтрэх / Бүртгүүлэх</Button>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
