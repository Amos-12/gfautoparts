import { useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import i18n from '@/i18n';

export interface UserProfile {
  id: string;
  user_id: string;
  full_name: string;
  phone?: string;
  role?: 'admin' | 'seller' | 'super_admin';
  is_active?: boolean;
  company_id?: string;
}

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [role, setRole] = useState<'admin' | 'seller' | 'super_admin' | null>(null);
  const [isActive, setIsActive] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchProfile = async (userId: string) => {
      let fetchedRole: string | null = null;
      try {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', userId)
          .limit(1)
          .maybeSingle();

        if (profileError) throw profileError;

        const { data: roleData, error: roleError } = await supabase
          .from('user_roles')
          .select('role, is_active')
          .eq('user_id', userId)
          .order('role', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (roleError) throw roleError;

        fetchedRole = roleData?.role ?? null;

        if (!isMounted) return;

        setIsActive(roleData?.is_active ?? true);

        if (profileData) {
          setProfile({
            ...profileData,
            role: (roleData?.role as any),
            is_active: roleData?.is_active,
            company_id: profileData.company_id
          });
          setRole(roleData?.role as 'admin' | 'seller' | 'super_admin' | null);
        } else {
          setProfile({
            id: userId,
            user_id: userId,
            full_name: '',
            role: (roleData?.role as any),
            is_active: roleData?.is_active,
            company_id: undefined
          });
          setRole(roleData?.role as 'admin' | 'seller' | 'super_admin' | null);
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
        // Don't show error toast for super_admin who may not have a profile row
        if (isMounted && fetchedRole !== 'super_admin') {
          toast({
            title: i18n.t('common.error'),
            description: i18n.t('toasts.auth.profileLoadError'),
            variant: "destructive"
          });
        }
      }
    };

    // Set up auth state listener (sync only). Defer network calls.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;

      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false); // do not block UI while fetching profile/role

      if (session?.user) {
        setTimeout(() => {
          if (isMounted) fetchProfile(session.user!.id);
        }, 0);
      } else {
        setProfile(null);
        setRole(null);
        setIsActive(true);
      }
    });

    // Initialize from existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) return;

      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      if (session?.user) {
        setTimeout(() => {
          if (isMounted) fetchProfile(session.user!.id);
        }, 0);
      } else {
        setProfile(null);
        setRole(null);
        setIsActive(true);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, fullName: string, phone?: string, companyName?: string, companyId?: string) => {
    try {
      const redirectUrl = `${window.location.origin}/`;
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: fullName,
            phone: phone || '',
            company_name: companyName || '',
            company_id: companyId || ''
          }
        }
      });

      if (error) {
        if (error.message.includes('User already registered')) {
          toast({
            title: i18n.t('toasts.auth.accountExistsTitle'),
            description: i18n.t('toasts.auth.accountExistsDescription'),
            variant: "destructive"
          });
        } else {
          toast({
            title: i18n.t('toasts.auth.signupErrorTitle'),
            description: error.message,
            variant: "destructive"
          });
        }
        return { error };
      }

      // Log successful signup (company_id not yet available at signup time)
      if (data.user) {
        await (supabase as any).from('activity_logs').insert({
          user_id: data.user.id,
          action_type: 'user_signup',
          entity_type: 'auth',
          description: `Nouvelle inscription: ${fullName}`,
          metadata: { email, full_name: fullName }
        });
      }

      toast({
        title: i18n.t('toasts.auth.signupSuccessTitle'),
        description: i18n.t('toasts.auth.signupSuccessDescription'),
      });

      return { error: null };
    } catch (error) {
      console.error('Signup error:', error);
      return { error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        // Log failed connection attempt
        if (data?.user) {
          await (supabase as any).from('activity_logs').insert({
            user_id: data.user.id,
            action_type: 'connection_failed',
            entity_type: 'auth',
            description: `Tentative de connexion échouée: ${error.message}`,
            metadata: { email }
          });
        }

        if (error.message.includes('Invalid login credentials')) {
          toast({
            title: i18n.t('toasts.auth.signinErrorTitle'),
            description: i18n.t('toasts.auth.invalidCredentials'),
            variant: "destructive"
          });
        } else {
          toast({
            title: i18n.t('toasts.auth.signinErrorTitle'),
            description: error.message,
            variant: "destructive"
          });
        }
        return { error };
      }

      // Log successful login
      if (data.user) {
        // Fetch company_id for logging
        const { data: profileData } = await supabase.from('profiles').select('company_id').eq('user_id', data.user.id).maybeSingle();
        await (supabase as any).from('activity_logs').insert({
          user_id: data.user.id,
          company_id: profileData?.company_id || null,
          action_type: 'user_login',
          entity_type: 'auth',
          description: `Connexion réussie`,
          metadata: { email }
        });
      }

      // Fetch company name for welcome message
      const { data: companyData } = await supabase
        .from('companies')
        .select('name')
        .limit(1)
        .maybeSingle();

      toast({
        title: i18n.t('toasts.auth.signinSuccessTitle'),
        description: i18n.t('toasts.auth.signinSuccessDescription', {
          company: companyData?.name || i18n.t('index.workspaceFallback')
        }),
      });

      return { error: null };
    } catch (error) {
      console.error('Signin error:', error);
      return { error };
    }
  };

  const signOut = async () => {
    try {
      const currentUser = user;
      
      // Log logout before signing out (best-effort, don't block on failure)
      if (currentUser) {
        try {
          await (supabase as any).from('activity_logs').insert({
            user_id: currentUser.id,
            company_id: profile?.company_id || null,
            action_type: 'user_logout',
            entity_type: 'auth',
            description: `Déconnexion`,
            metadata: { email: currentUser.email }
          });
        } catch (logErr) {
          console.warn('Could not log logout activity:', logErr);
        }
      }

      // Clear local state FIRST to prevent auto-redirect
      setUser(null);
      setSession(null);
      setProfile(null);
      setRole(null);

      // Sign out from Supabase (clears localStorage tokens)
      await supabase.auth.signOut().catch(() => {});

      toast({
        title: i18n.t('toasts.auth.signoutSuccessTitle'),
        description: i18n.t('toasts.auth.signoutSuccessDescription'),
      });

      // Hard redirect to /auth to fully reset app state
      window.location.replace('/auth');
    } catch (error) {
      console.error('Signout error:', error);
      // Force redirect even on unexpected errors
      window.location.replace('/auth');
    }
  };

  return { 
    user, 
    session, 
    profile, 
    role,
    isActive,
    loading, 
    signUp, 
    signIn, 
    signOut 
  };
};