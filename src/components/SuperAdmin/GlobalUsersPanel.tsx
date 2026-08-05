import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Search, Users } from 'lucide-react';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { getDateFnsLocale } from '@/lib/locale';

interface UserWithDetails {
  user_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: string;
  is_active: boolean;
  company_name: string | null;
  company_id: string | null;
  created_at: string;
}

export const GlobalUsersPanel = () => {
  const { t } = useTranslation();
  const [users, setUsers] = useState<UserWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, full_name, email, phone, company_id, created_at');

      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role, is_active, company_id');

      if (rolesError) throw rolesError;

      const { data: companies, error: companiesError } = await supabase
        .from('companies')
        .select('id, name');

      if (companiesError) throw companiesError;

      const companyMap = new Map(companies?.map(c => [c.id, c.name]) || []);
      const roleMap = new Map(roles?.map(r => [r.user_id, r]) || []);

      const merged: UserWithDetails[] = (profiles || []).map(p => {
        const role = roleMap.get(p.user_id);
        return {
          user_id: p.user_id,
          full_name: p.full_name,
          email: p.email,
          phone: p.phone,
          role: role?.role || 'unknown',
          is_active: role?.is_active ?? false,
          company_name: p.company_id ? companyMap.get(p.company_id) || null : null,
          company_id: p.company_id,
          created_at: p.created_at,
        };
      });

      setUsers(merged);
    } catch (err) {
      console.error('Error fetching users:', err);
      toast({ title: t('superAdmin.common.error'), description: t('superAdmin.users_list.toast_load_error'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleToggleActive = async (userId: string, currentActive: boolean) => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .update({ is_active: !currentActive })
        .eq('user_id', userId);

      if (error) throw error;
      toast({ title: currentActive ? t('superAdmin.users_list.toast_deactivated') : t('superAdmin.users_list.toast_activated') });
      fetchUsers();
    } catch (err) {
      toast({ title: t('superAdmin.common.error'), description: t('superAdmin.users_list.toast_status_error'), variant: 'destructive' });
    }
  };

  const handleChangeRole = async (userId: string, newRole: string) => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .update({ role: newRole as any })
        .eq('user_id', userId);

      if (error) throw error;
      toast({ title: t('superAdmin.users_list.toast_role_changed'), description: t('superAdmin.users_list.toast_role_changed_desc', { role: newRole }) });
      fetchUsers();
    } catch (err) {
      toast({ title: t('superAdmin.common.error'), description: t('superAdmin.users_list.toast_role_error'), variant: 'destructive' });
    }
  };

  const filtered = users.filter(u => {
    const matchSearch = u.full_name.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.company_name?.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === 'all' || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const getRoleBadge = (role: string) => {
    const variants: Record<string, string> = {
      super_admin: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      admin: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
      seller: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    };
    return <Badge className={variants[role] || ''}>{role}</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            {t('superAdmin.users_list.title', { count: filtered.length })}
          </CardTitle>
          <div className="flex gap-2">
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder={t('superAdmin.users_list.filter_role')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('superAdmin.common.all')}</SelectItem>
                <SelectItem value="admin">{t('superAdmin.users_list.role_admin')}</SelectItem>
                <SelectItem value="seller">{t('superAdmin.users_list.role_seller')}</SelectItem>
                <SelectItem value="super_admin">{t('superAdmin.users_list.role_super_admin')}</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder={t('superAdmin.common.search')} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-center text-muted-foreground py-8">{t('superAdmin.common.loading')}</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('superAdmin.users_list.header_user')}</TableHead>
                  <TableHead>{t('superAdmin.users_list.header_company')}</TableHead>
                  <TableHead>{t('superAdmin.users_list.header_role')}</TableHead>
                  <TableHead>{t('superAdmin.users_list.header_status')}</TableHead>
                  <TableHead>{t('superAdmin.users_list.header_registered')}</TableHead>
                  <TableHead>{t('superAdmin.users_list.header_actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((user) => (
                  <TableRow key={user.user_id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{user.full_name}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{user.company_name || '—'}</span>
                    </TableCell>
                    <TableCell>{getRoleBadge(user.role)}</TableCell>
                    <TableCell>
                      {user.is_active ? (
                        <Badge variant="outline" className="border-green-500 text-green-600">{t('superAdmin.users_list.active')}</Badge>
                      ) : (
                        <Badge variant="destructive">{t('superAdmin.users_list.inactive')}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{format(new Date(user.created_at), 'dd MMM yyyy', { locale: getDateFnsLocale() })}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 flex-wrap">
                        <Button
                          variant={user.is_active ? 'outline' : 'default'}
                          size="sm"
                          onClick={() => handleToggleActive(user.user_id, user.is_active)}
                          disabled={user.role === 'super_admin'}
                        >
                          {user.is_active ? t('superAdmin.users_list.deactivate') : t('superAdmin.users_list.activate')}
                        </Button>
                        {user.role !== 'super_admin' && (
                          <Select value={user.role} onValueChange={(v) => handleChangeRole(user.user_id, v)}>
                            <SelectTrigger className="w-24 h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">{t('superAdmin.users_list.role_admin')}</SelectItem>
                              <SelectItem value="seller">{t('superAdmin.users_list.role_seller')}</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      {t('superAdmin.users_list.no_users')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
