import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  User, Mail, Phone, Save, Lock, ArrowLeft, Shield, 
  Calendar, Clock, CheckCircle2, AlertCircle, Camera, 
  Activity, Package, ShoppingCart, Settings, LogIn, LogOut,
  Trash2, Edit, Plus, Globe
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { LanguageSelector } from '@/components/ui/language-selector';

interface ActivityLog {
  id: string;
  action_type: string;
  entity_type: string;
  description: string;
  created_at: string;
}

const Profile = () => {
  const { t } = useTranslation();
  const { user, profile, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    full_name: '',
    phone: ''
  });
  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: ''
  });
  const [pwdLoading, setPwdLoading] = useState(false);
  const [lastActivity, setLastActivity] = useState<string | null>(null);
  const [activityHistory, setActivityHistory] = useState<ActivityLog[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/auth');
      return;
    }

    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        phone: profile.phone || ''
      });
    }

    // Fetch profile with avatar_url
    const fetchProfileData = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (data?.avatar_url) {
        setAvatarUrl(data.avatar_url);
      }
    };
    fetchProfileData();

    // Fetch last activity
    const fetchLastActivity = async () => {
      const { data } = await supabase
        .from('activity_logs')
        .select('created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (data) {
        setLastActivity(data.created_at);
      }
    };
    fetchLastActivity();

    // Fetch activity history
    fetchActivityHistory();
  }, [user, profile, navigate, authLoading]);

  const fetchActivityHistory = async () => {
    if (!user) return;
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('id, action_type, entity_type, description, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      setActivityHistory(data || []);
    } catch (error) {
      console.error('Error fetching activity history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: t('profile.invalidFileType'),
        description: t('profile.selectImage'),
        variant: "destructive"
      });
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: t('profile.fileTooLarge'),
        description: t('profile.maxFileSize'),
        variant: "destructive"
      });
      return;
    }

    setUploadingAvatar(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/avatar.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      // Add cache buster
      const urlWithCacheBuster = `${publicUrl}?t=${Date.now()}`;

      // Update profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: urlWithCacheBuster })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      setAvatarUrl(urlWithCacheBuster);
      toast({
        title: t('profile.photoUpdated'),
        description: t('profile.photoUpdatedDesc')
      });
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast({
        title: t('common.error'),
        description: t('profile.photoError'),
        variant: "destructive"
      });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name,
          phone: formData.phone
        })
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: t('profile.profileUpdated'),
        description: t('profile.profileUpdatedDesc')
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: t('common.error'),
        description: t('profile.updateError'),
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordUpdate = async () => {
    if (!user) return;
    if (!passwordData.newPassword || passwordData.newPassword.length < 6) {
      toast({
        title: t('profile.passwordTooShort'),
        description: t('profile.minSixChars'),
        variant: 'destructive'
      });
      return;
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        title: t('profile.passwordMismatch'),
        description: t('profile.passwordsMismatchDesc'),
        variant: 'destructive'
      });
      return;
    }

    setPwdLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: passwordData.newPassword });
      if (error) throw error;

      await (supabase as any).from('activity_logs').insert({
        user_id: user.id,
        action_type: 'user_update_password',
        entity_type: 'auth',
        description: `Mot de passe modifié`,
        metadata: { email: user.email }
      });

      toast({
        title: t('profile.passwordUpdated'),
        description: t('profile.passwordUpdatedDesc')
      });
      setPasswordData({ newPassword: '', confirmPassword: '' });
      fetchActivityHistory();
    } catch (error) {
      console.error('Error updating password:', error);
      toast({
        title: t('common.error'),
        description: t('profile.updateError'),
        variant: 'destructive'
      });
    } finally {
      setPwdLoading(false);
    }
  };

  const handleBack = () => {
    if (role === 'admin') {
      navigate('/admin');
    } else {
      navigate('/seller');
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getActivityIcon = (actionType: string) => {
    switch (actionType) {
      case 'sale_created':
        return <ShoppingCart className="h-3.5 w-3.5" />;
      case 'product_added':
      case 'product_updated':
        return <Package className="h-3.5 w-3.5" />;
      case 'product_deleted':
      case 'sale_deleted':
        return <Trash2 className="h-3.5 w-3.5" />;
      case 'stock_adjusted':
        return <Edit className="h-3.5 w-3.5" />;
      case 'user_login':
        return <LogIn className="h-3.5 w-3.5" />;
      case 'user_logout':
        return <LogOut className="h-3.5 w-3.5" />;
      case 'settings_updated':
      case 'user_update_password':
        return <Settings className="h-3.5 w-3.5" />;
      case 'category_created':
      case 'subcategory_created':
        return <Plus className="h-3.5 w-3.5" />;
      default:
        return <Activity className="h-3.5 w-3.5" />;
    }
  };

  const getActivityColor = (actionType: string) => {
    if (actionType.includes('deleted') || actionType.includes('cancelled')) {
      return 'text-red-500 bg-red-500/10';
    }
    if (actionType.includes('created') || actionType.includes('added')) {
      return 'text-green-500 bg-green-500/10';
    }
    if (actionType.includes('updated') || actionType.includes('adjusted')) {
      return 'text-blue-500 bg-blue-500/10';
    }
    if (actionType.includes('login') || actionType.includes('logout')) {
      return 'text-violet-500 bg-violet-500/10';
    }
    return 'text-muted-foreground bg-muted';
  };

  const memberSince = user?.created_at 
    ? format(new Date(user.created_at), 'dd MMMM yyyy', { locale: fr })
    : null;

  const lastActivityFormatted = lastActivity
    ? format(new Date(lastActivity), "dd MMM yyyy 'à' HH:mm", { locale: fr })
    : null;

  return (
    <>
    {/* Safe area background - prevents content from showing under status bar */}
    <div 
      className="fixed top-0 left-0 right-0 z-[60] bg-background"
      style={{ height: 'var(--safe-area-top, 0px)' }}
    />
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8 pt-[calc(16px+var(--safe-area-top,0px))] pb-[calc(16px+var(--safe-area-bottom,0px))]">
      <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl sm:text-2xl font-bold">{t('profile.title')}</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Profile Summary Card */}
          <Card className="lg:col-span-1">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center space-y-4">
                {/* Avatar with upload */}
                <div className="relative group">
                  <Avatar className="h-24 w-24 sm:h-28 sm:w-28">
                    <AvatarImage src={avatarUrl || undefined} alt={formData.full_name} />
                    <AvatarFallback className="text-2xl sm:text-3xl bg-primary text-primary-foreground">
                      {formData.full_name ? getInitials(formData.full_name) : 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingAvatar}
                    className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  >
                    <Camera className="h-6 w-6 text-white" />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                </div>
                {uploadingAvatar && (
                  <p className="text-xs text-muted-foreground">{t('profile.uploading')}</p>
                )}
                
                <div className="space-y-1">
                  <h2 className="text-lg sm:text-xl font-semibold">
                    {formData.full_name || t('profile.user')}
                  </h2>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                </div>

                <Badge 
                  variant={role === 'admin' ? 'default' : 'secondary'}
                  className="gap-1"
                >
                  <Shield className="h-3 w-3" />
                  {role === 'admin' ? t('roles.admin') : t('roles.seller')}
                </Badge>

                <Separator className="my-4" />

                {/* Account Stats */}
                <div className="w-full space-y-3 text-left">
                  <div className="flex items-center gap-3 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-muted-foreground">{t('profile.memberSince')}</p>
                      <p className="font-medium">{memberSince || '—'}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-muted-foreground">{t('profile.lastActivity')}</p>
                      <p className="font-medium">{lastActivityFormatted || '—'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <div>
                      <p className="text-muted-foreground">{t('profile.accountStatus')}</p>
                      <p className="font-medium text-green-600">{t('common.active')}</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Edit Profile Section */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
            {/* Personal Information */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                  <User className="h-4 w-4 sm:h-5 sm:w-5" />
                  {t('profile.personalInfo')}
                </CardTitle>
                <CardDescription>
                  {t('profile.editInfo')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-sm">
                        {t('common.email')}
                      </Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="email"
                          type="email"
                          value={user?.email || ''}
                          disabled
                          className="pl-10 bg-muted"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t('profile.emailCantChange')}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="full_name" className="text-sm">
                        {t('profile.fullName')}
                      </Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="full_name"
                          type="text"
                          value={formData.full_name}
                          onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                          placeholder={t('profile.fullNamePlaceholder')}
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-sm">
                      {t('common.phone')}
                    </Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder={t('profile.phonePlaceholder')}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button type="submit" disabled={loading} className="gap-2">
                      <Save className="h-4 w-4" />
                      {loading ? t('common.saving') : t('common.save')}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Security Section */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                  <Lock className="h-4 w-4 sm:h-5 sm:w-5" />
                  {t('profile.security')}
                </CardTitle>
                <CardDescription>
                  {t('profile.changePassword')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="new_password" className="text-sm">
                      {t('profile.newPassword')}
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="new_password"
                        type="password"
                        value={passwordData.newPassword}
                        onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                        placeholder="••••••••"
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm_password" className="text-sm">
                      {t('profile.confirmPassword')}
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="confirm_password"
                        type="password"
                        value={passwordData.confirmPassword}
                        onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                        placeholder="••••••••"
                        className="pl-10"
                      />
                    </div>
                  </div>
                </div>

                {passwordData.newPassword && passwordData.newPassword.length < 6 && (
                  <div className="flex items-center gap-2 text-sm text-amber-600">
                    <AlertCircle className="h-4 w-4" />
                    {t('profile.passwordMinWarning')}
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handlePasswordUpdate}
                    disabled={pwdLoading || !passwordData.newPassword}
                    className="gap-2"
                  >
                    <Lock className="h-4 w-4" />
                    {pwdLoading ? t('profile.updating') : t('profile.update')}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Language Section */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                  <Globe className="h-4 w-4 sm:h-5 sm:w-5" />
                  {t('profile.language')}
                </CardTitle>
                <CardDescription>
                  {t('profile.languageDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <LanguageSelector variant="full" />
              </CardContent>
            </Card>

            {/* Activity History */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                  <Activity className="h-4 w-4 sm:h-5 sm:w-5" />
                  {t('profile.activityHistory')}
                </CardTitle>
                <CardDescription>
                  {t('profile.last20Actions')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingHistory ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                  </div>
                ) : activityHistory.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>{t('profile.noActivity')}</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[300px] pr-4">
                    <div className="space-y-3">
                      {activityHistory.map((activity) => (
                        <div
                          key={activity.id}
                          className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                        >
                          <div className={`p-2 rounded-full ${getActivityColor(activity.action_type)}`}>
                            {getActivityIcon(activity.action_type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {activity.description}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                {activity.entity_type}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(activity.created_at), "dd MMM yyyy 'à' HH:mm", { locale: fr })}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
    </>
  );
};

export default Profile;
