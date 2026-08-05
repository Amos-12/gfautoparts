import { useEffect, useState, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useSessionTimeout } from '@/hooks/useSessionTimeout';
import { isSessionError } from '@/lib/sessionErrors';

interface ProtectedRouteProps {
  children: ReactNode;
  /** Rôles autorisés. Vide = tout utilisateur authentifié. */
  roles?: Array<'admin' | 'seller' | 'super_admin'>;
}

export const ProtectedRoute = ({ children, roles }: ProtectedRouteProps) => {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useSessionTimeout(allowed);

  useEffect(() => {
    let mounted = true;

    const verify = async () => {
      try {
        const { data, error } = await supabase.auth.getUser();

        if (error || !data?.user) {
          if (mounted) {
            setAllowed(false);
            setChecking(false);
          }
          navigate(
            `/auth?reason=${isSessionError(error) ? 'expired' : 'signin'}`,
            { replace: true }
          );
          return;
        }

        if (roles && roles.length > 0) {
          const { data: roleRows } = await supabase
            .from('user_roles')
            .select('role, is_active')
            .eq('user_id', data.user.id);

          const rows = (roleRows as any[]) || [];
          const hasRole = rows.some(
            (r) => roles.includes(r.role) && r.is_active !== false
          );

          if (!hasRole) {
            if (mounted) {
              setAllowed(false);
              setChecking(false);
            }
            navigate('/', { replace: true });
            return;
          }
        }

        if (mounted) {
          setAllowed(true);
          setChecking(false);
        }
      } catch (err) {
        if (mounted) {
          setAllowed(false);
          setChecking(false);
        }
        navigate('/auth?reason=expired', { replace: true });
      }
    };

    verify();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        navigate('/auth?reason=expired', { replace: true });
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [navigate, roles?.join(',')]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Vérification de votre session...</p>
      </div>
    );
  }

  if (!allowed) return null;

  return <>{children}</>;
};

export default ProtectedRoute;
