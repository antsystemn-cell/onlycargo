import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, LogIn, Search as SearchIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import NotificationBanner from '@/components/home/NotificationBanner';
import QuickSearch from '@/components/home/QuickSearch';
import CargoCard from '@/components/cargo/CargoCard';
import CargoPublicCard from '@/components/cargo/CargoPublicCard';
import type { Cargo, CargoPublic, CargoStatus } from '@/types/cargo';

export default function Home() {
  const { user, profile, isAdmin, isLoading } = useAuth();
  const navigate = useNavigate();
  const [searchResults, setSearchResults] = useState<Cargo[]>([]);
  const [publicSearchResults, setPublicSearchResults] = useState<CargoPublic[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [unassignedMessage, setUnassignedMessage] = useState<string | null>(null);

  const handleSearch = async (query: string) => {
    setIsSearching(true);
    setHasSearched(true);
    setUnassignedMessage(null);
    setSearchResults([]);
    setPublicSearchResults([]);

    try {
      if (user) {
        // Authenticated users: search the cargo table (RLS allows own cargo or admin access)
        const { data, error } = await supabase
          .from('cargo')
          .select('*')
          .or(`track_number.ilike.%${query}%,phone_number.ilike.%${query}%`)
          .order('created_at', { ascending: false })
          .limit(20);

        if (error) throw error;

        // Check for unassigned cargo (no phone number assigned)
        const hasUnassigned = data?.some((c) => !c.phone_number || c.phone_number === '');
        if (hasUnassigned) {
          setUnassignedMessage(
            'Таны бүтээгдэхүүн "Утасгүй бүтээгдэхүүн" хэсэгт бүртгэгдсэн байна. Баталгаажуулахын тулд админтай холбогдоно уу.'
          );
        }

        // Transform data to ensure proper typing
        const transformedData: Cargo[] = (data || []).map((item) => ({
          ...item,
          status: item.status as CargoStatus,
        }));

        setSearchResults(transformedData);
      } else {
        // Non-authenticated users: use the cargo_public view (limited fields, no sensitive data)
        const { data, error } = await supabase
          .from('cargo_public')
          .select('*')
          .ilike('track_number', `%${query}%`)
          .order('created_at', { ascending: false })
          .limit(20);

        if (error) throw error;

        // Transform data to ensure proper typing
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
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-card px-4 py-3">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-6 w-6 text-primary" />
            <h1 className="text-lg font-bold">Cargo</h1>
          </div>
          {user ? (
            <div className="flex items-center gap-2">
              {isAdmin && (
                <Button variant="outline" size="sm" onClick={() => navigate('/admin')}>
                  Админ
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
          {/* Search Section */}
          <section>
            <h2 className="mb-3 text-sm font-medium text-muted-foreground">
              Ачаа хайх
            </h2>
            <QuickSearch onSearch={handleSearch} isLoading={isSearching} />
          </section>

          {/* Unassigned Message */}
          {unassignedMessage && (
            <Card className="border-yellow-200 bg-yellow-50">
              <CardContent className="p-4">
                <p className="text-sm text-yellow-800">{unassignedMessage}</p>
              </CardContent>
            </Card>
          )}

          {/* Search Results */}
          {hasSearched && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <SearchIcon className="h-4 w-4" />
                Хайлтын үр дүн ({user ? searchResults.length : publicSearchResults.length})
              </h2>
              {user ? (
                // Authenticated users see full cargo details
                searchResults.length === 0 ? (
                  <Card>
                    <CardContent className="p-6 text-center text-muted-foreground">
                      Ачаа олдсонгүй
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {searchResults.map((cargo) => (
                      <CargoCard
                        key={cargo.id}
                        cargo={cargo}
                        showPrice={true}
                      />
                    ))}
                  </div>
                )
              ) : (
                // Non-authenticated users see limited cargo info
                publicSearchResults.length === 0 ? (
                  <Card>
                    <CardContent className="p-6 text-center text-muted-foreground">
                      Ачаа олдсонгүй
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {publicSearchResults.map((cargo) => (
                      <CargoPublicCard
                        key={cargo.id || cargo.track_number}
                        cargo={cargo}
                      />
                    ))}
                  </div>
                )
              )}
            </section>
          )}

          {/* Quick Links for non-logged in users */}
          {!user && !hasSearched && (
            <section className="space-y-4">
              <Card>
                <CardContent className="p-6 text-center">
                  <Package className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                  <h3 className="mb-2 font-semibold">Ачаа хянах</h3>
                  <p className="mb-4 text-sm text-muted-foreground">
                    Нэвтэрч орсноор бүх ачааны дэлгэрэнгүй мэдээллийг харах боломжтой.
                  </p>
                  <Button onClick={() => navigate('/auth')} className="w-full">
                    Нэвтрэх / Бүртгүүлэх
                  </Button>
                </CardContent>
              </Card>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
