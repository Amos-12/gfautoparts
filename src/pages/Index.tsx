import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { ArrowRight, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import logo from '@/assets/logo.png';

const Index = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, profile, loading, isActive, signOut } = useAuth();
  const [isCreatingAdmin, setIsCreatingAdmin] = useState(false);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Fetch company name for display
  useEffect(() => {
    const fetchCompanyName = async () => {
      const { data } = await supabase
        .from('companies')
        .select('name')
        .limit(1)
        .maybeSingle();
      if (data?.name && mountedRef.current) {
        setCompanyName(data.name);
      }
    };
    fetchCompanyName();
  }, []);

  const handleCreateAdmin = async () => {
    if (!user?.email) return;
    
    try {
      if (mountedRef.current) {
        setIsCreatingAdmin(true);
      }
      
      const { error } = await supabase.rpc('promote_user_to_admin', {
        user_email: user.email
      });

      if (error) throw error;

      if (mountedRef.current) {
        toast({
          title: t('index.adminCreatedTitle'),
          description: t('index.adminCreatedDescription'),
        });
        
        // Use navigate instead of window.location for better React integration
        setTimeout(() => {
          if (mountedRef.current) {
            navigate('/admin', { replace: true });
          }
        }, 1500);
      }
    } catch (error) {
      console.error('Error creating admin:', error);
      if (mountedRef.current) {
        toast({
          title: t('common.error'),
          description: t('index.adminCreateError'),
          variant: "destructive"
        });
      }
    } finally {
      if (mountedRef.current) {
        setIsCreatingAdmin(false);
      }
    }
  };

  useEffect(() => {
    if (!loading && !user && mountedRef.current) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  // Redirect based on user role using navigate instead of window.location
  useEffect(() => {
    if (profile?.role && isActive && mountedRef.current) {
      if (profile.role === 'super_admin') {
        navigate('/super-admin', { replace: true });
      } else if (profile.role === 'admin') {
        navigate('/admin', { replace: true });
      } else if (profile.role === 'seller') {
        navigate('/seller', { replace: true });
      }
    }
  }, [profile?.role, isActive, navigate]);
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-light to-background pt-[var(--safe-area-top,0px)] pb-[var(--safe-area-bottom,0px)]">
        {/* Safe area background */}
        <div 
          className="fixed top-0 left-0 right-0 z-[60] bg-background"
          style={{ height: 'var(--safe-area-top, 0px)' }}
        />
        <div className="text-center">
          <img src={logo} alt="Logo" className="w-14 h-14 object-contain mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">{t('index.loadingWorkspace')}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-light to-background p-4 pt-[calc(16px+var(--safe-area-top,0px))] pb-[calc(16px+var(--safe-area-bottom,0px))]">
        {/* Safe area background */}
        <div 
          className="fixed top-0 left-0 right-0 z-[60] bg-background"
          style={{ height: 'var(--safe-area-top, 0px)' }}
        />
        <Card className="max-w-md w-full shadow-lg">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center mb-4">
              <img src={logo} alt="Logo" className="w-12 h-12 object-contain mr-3" />
              <CardTitle className="text-2xl">{companyName || t('index.welcome')}</CardTitle>
            </div>
            <p className="text-muted-foreground">
              {t('index.systemDescription')}
            </p>
          </CardHeader>
          <CardContent className="text-center">
            <p className="mb-6">{t('index.signInPrompt')}</p>
            <Button 
              onClick={() => navigate('/auth')} 
              variant="hero" 
              className="w-full"
            >
              {t('auth.signIn')}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show inactive account message (super_admin bypasses this)
  if (user && !isActive && profile?.role !== 'super_admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-light to-background p-4 pt-[calc(16px+var(--safe-area-top,0px))] pb-[calc(16px+var(--safe-area-bottom,0px))]">
        {/* Safe area background */}
        <div 
          className="fixed top-0 left-0 right-0 z-[60] bg-background"
          style={{ height: 'var(--safe-area-top, 0px)' }}
        />
        <Card className="max-w-md w-full shadow-lg">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center mb-2">
              <Shield className="w-8 h-8 text-warning" />
            </div>
            <CardTitle>{t('index.pendingApprovalTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              {t('index.pendingApprovalDescription')}
            </p>
            <p className="text-sm text-muted-foreground">
              {t('index.contactAdmin')}
            </p>
            <Button 
              onClick={signOut} 
              variant="destructive" 
              className="w-full"
            >
              {t('auth.signOut')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Fallback for users without a role (shouldn't happen with proper setup)
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-light to-background pt-[var(--safe-area-top,0px)] pb-[var(--safe-area-bottom,0px)]">
      {/* Safe area background */}
      <div 
        className="fixed top-0 left-0 right-0 z-[60] bg-background"
        style={{ height: 'var(--safe-area-top, 0px)' }}
      />
      <Card className="max-w-md w-full shadow-lg">
        <CardHeader className="text-center">
          <CardTitle>{t('index.setupTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="mb-4">{t('index.setupDescription')}</p>
          <div className="space-y-2">
            <Button onClick={() => {
              if (mountedRef.current) window.location.reload();
            }} variant="outline" className="w-full">
              {t('common.refresh')}
            </Button>
            <Button 
              onClick={signOut} 
              variant="destructive" 
              className="w-full"
            >
              {t('auth.signOut')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Index;
