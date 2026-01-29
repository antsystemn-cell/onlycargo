import { useEffect, useState } from 'react';
import { Users, Search, Package } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import type { Profile } from '@/types/cargo';

interface UserWithCargoCount extends Profile {
  cargo_count: number;
}

export default function AllUsers() {
  const [users, setUsers] = useState<UserWithCargoCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      // Fetch profiles
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch cargo counts
      const usersWithCounts: UserWithCargoCount[] = await Promise.all(
        (profiles || []).map(async (profile) => {
          const { count } = await supabase
            .from('cargo')
            .select('id', { count: 'exact', head: true })
            .eq('phone_number', profile.phone);

          return {
            ...profile,
            cargo_count: count || 0,
          };
        })
      );

      setUsers(usersWithCounts);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.phone.includes(searchQuery) ||
      (u.full_name?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  );

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
        <h1 className="text-2xl font-bold">Хэрэглэгчид</h1>
        <p className="text-muted-foreground">Бүртгэлтэй хэрэглэгчдийн жагсаалт</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Хэрэглэгчид ({filteredUsers.length})
              </CardTitle>
              <CardDescription>Утас, нэрээр хайх</CardDescription>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Хайх..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-64"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Утас</TableHead>
                <TableHead>Нэр</TableHead>
                <TableHead>Ачааны тоо</TableHead>
                <TableHead>Бүртгэсэн</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-mono">{user.phone}</TableCell>
                  <TableCell>{user.full_name || '-'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Package className="h-3 w-3 text-muted-foreground" />
                      {user.cargo_count}
                    </div>
                  </TableCell>
                  <TableCell>
                    {format(new Date(user.created_at), 'yyyy.MM.dd')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
