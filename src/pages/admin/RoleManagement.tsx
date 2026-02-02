import { useEffect, useState } from 'react';
import { Shield, Users, Search, Edit, Check, X, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import type { AppRole } from '@/types/cargo';

interface UserWithRole {
  id: string;
  phone: string;
  full_name: string | null;
  created_at: string;
  roles: AppRole[];
}

const ROLE_LABELS: Record<AppRole, string> = {
  admin: 'Админ',
  user: 'Хэрэглэгч',
  china_warehouse: 'Эрээн агуулах',
  branch_admin: 'Салбар админ',
};

const ROLE_COLORS: Record<AppRole, string> = {
  admin: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  user: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  china_warehouse: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  branch_admin: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
};

// Permission matrix for display
const PERMISSION_MATRIX = [
  { name: 'Өөрийн ачаа харах', user: true, branch_admin: true, china_warehouse: true, admin: true },
  { name: 'Ачаа бүртгэх', user: false, branch_admin: true, china_warehouse: true, admin: true },
  { name: 'Баркод скан хийх', user: false, branch_admin: true, china_warehouse: true, admin: true },
  { name: 'Ачаа шилжүүлэх', user: false, branch_admin: true, china_warehouse: true, admin: true },
  { name: 'Ачаа хүлээлгэж өгөх', user: false, branch_admin: true, china_warehouse: false, admin: true },
  { name: 'Хэрэглэгчдийг харах', user: false, branch_admin: false, china_warehouse: false, admin: true },
  { name: 'Эрх удирдах', user: false, branch_admin: false, china_warehouse: false, admin: true },
  { name: 'Системийн тохиргоо', user: false, branch_admin: false, china_warehouse: false, admin: true },
];

export default function RoleManagement() {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingUser, setEditingUser] = useState<UserWithRole | null>(null);
  const [selectedRole, setSelectedRole] = useState<AppRole>('user');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchUsersWithRoles();
  }, []);

  const fetchUsersWithRoles = async () => {
    setIsLoading(true);
    try {
      // Fetch all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch all user roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      // Combine profiles with roles
      const usersWithRoles: UserWithRole[] = (profiles || []).map((profile) => {
        const userRoles = (roles || [])
          .filter((r) => r.user_id === profile.id)
          .map((r) => r.role as AppRole);
        
        return {
          ...profile,
          roles: userRoles.length > 0 ? userRoles : ['user' as AppRole],
        };
      });

      setUsers(usersWithRoles);
    } catch (error) {
      console.error('Failed to fetch users:', error);
      toast({
        title: 'Алдаа',
        description: 'Хэрэглэгчдийн мэдээлэл татахад алдаа гарлаа',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditClick = (user: UserWithRole) => {
    setEditingUser(user);
    // Set the primary role (first non-user role, or user if only user)
    const primaryRole = user.roles.find((r) => r !== 'user') || 'user';
    setSelectedRole(primaryRole);
  };

  const handleSaveRole = async () => {
    if (!editingUser) return;

    setIsSaving(true);
    try {
      // Get existing roles
      const { data: existingRoles, error: fetchError } = await supabase
        .from('user_roles')
        .select('id, role')
        .eq('user_id', editingUser.id);

      if (fetchError) throw fetchError;

      // Find if selected role already exists
      const hasSelectedRole = existingRoles?.some((r) => r.role === selectedRole);
      
      if (selectedRole === 'user') {
        // Remove all non-user roles
        const nonUserRoles = existingRoles?.filter((r) => r.role !== 'user') || [];
        for (const role of nonUserRoles) {
          await supabase.from('user_roles').delete().eq('id', role.id);
        }
        
        // Ensure user role exists
        const hasUserRole = existingRoles?.some((r) => r.role === 'user');
        if (!hasUserRole) {
          await supabase.from('user_roles').insert({
            user_id: editingUser.id,
            role: 'user',
          });
        }
      } else {
        // Add the selected role if it doesn't exist
        if (!hasSelectedRole) {
          const { error: insertError } = await supabase.from('user_roles').insert({
            user_id: editingUser.id,
            role: selectedRole,
          });

          if (insertError) throw insertError;
        }
      }

      toast({
        title: 'Амжилттай',
        description: `${editingUser.phone} хэрэглэгчийн эрх шинэчлэгдлээ`,
      });

      setEditingUser(null);
      fetchUsersWithRoles();
    } catch (error) {
      console.error('Failed to update role:', error);
      toast({
        title: 'Алдаа',
        description: 'Эрх шинэчлэхэд алдаа гарлаа',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
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
        <h1 className="text-2xl font-bold">Эрх удирдах</h1>
        <p className="text-muted-foreground">Хэрэглэгчдийн эрх болон тохиргоо</p>
      </div>

      {/* Permission Matrix */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Эрхийн матриц
          </CardTitle>
          <CardDescription>Эрх тус бүрийн боломжууд</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Үйлдэл</TableHead>
                <TableHead className="text-center">Хэрэглэгч</TableHead>
                <TableHead className="text-center">Салбар админ</TableHead>
                <TableHead className="text-center">Эрээн агуулах</TableHead>
                <TableHead className="text-center">Админ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {PERMISSION_MATRIX.map((perm, idx) => (
                <TableRow key={idx}>
                  <TableCell className="font-medium">{perm.name}</TableCell>
                  <TableCell className="text-center">
                    {perm.user ? (
                      <Check className="h-4 w-4 text-green-600 mx-auto" />
                    ) : (
                      <X className="h-4 w-4 text-muted-foreground mx-auto" />
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {perm.branch_admin ? (
                      <Check className="h-4 w-4 text-green-600 mx-auto" />
                    ) : (
                      <X className="h-4 w-4 text-muted-foreground mx-auto" />
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {perm.china_warehouse ? (
                      <Check className="h-4 w-4 text-green-600 mx-auto" />
                    ) : (
                      <X className="h-4 w-4 text-muted-foreground mx-auto" />
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {perm.admin ? (
                      <Check className="h-4 w-4 text-green-600 mx-auto" />
                    ) : (
                      <X className="h-4 w-4 text-muted-foreground mx-auto" />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* User List */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Хэрэглэгчид ({filteredUsers.length})
              </CardTitle>
              <CardDescription>Эрх өөрчлөхийг хүсвэл засах товчийг дарна уу</CardDescription>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Утас, нэрээр хайх..."
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
                <TableHead>Эрхүүд</TableHead>
                <TableHead>Бүртгэсэн</TableHead>
                <TableHead className="w-[100px]">Үйлдэл</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-mono">{user.phone}</TableCell>
                  <TableCell>{user.full_name || '-'}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {user.roles.map((role) => (
                        <Badge key={role} className={ROLE_COLORS[role]} variant="secondary">
                          {ROLE_LABELS[role]}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>{format(new Date(user.created_at), 'yyyy.MM.dd')}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditClick(user)}
                      disabled={user.id === currentUser?.id}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Role Dialog */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Эрх өөрчлөх</DialogTitle>
            <DialogDescription>
              {editingUser?.phone} - {editingUser?.full_name || 'Нэр байхгүй'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Эрх өөрчлөх нь хэрэглэгчийн бүх боломжуудад нөлөөлнө. Болгоомжтой байна уу.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <label className="text-sm font-medium">Шинэ эрх сонгох</label>
              <Select value={selectedRole} onValueChange={(val) => setSelectedRole(val as AppRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Хэрэглэгч</SelectItem>
                  <SelectItem value="branch_admin">Салбар админ</SelectItem>
                  <SelectItem value="china_warehouse">Эрээн агуулах</SelectItem>
                  <SelectItem value="admin">Админ</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="bg-muted p-3 rounded-lg">
              <p className="text-sm font-medium mb-2">Энэ эрх нь:</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                {PERMISSION_MATRIX.filter((p) => p[selectedRole as keyof typeof p]).map((p, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <Check className="h-3 w-3 text-green-600" />
                    {p.name}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>
              Болих
            </Button>
            <Button onClick={handleSaveRole} disabled={isSaving}>
              {isSaving ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                'Хадгалах'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
