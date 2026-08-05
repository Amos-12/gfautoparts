import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export const INACTIVITY_LIMIT_MS = 15 * 60 * 1000; // 15 minutes
const WARNING_BEFORE_MS = 60 * 1000; // avertissement 1 minute avant

const ACTIVITY_EVENTS = [
  'mousedown',
  'mousemove',
  'keydown',
  'scroll',
  'touchstart',
  'click',
  'visibilitychange',
];

/**
 * Déconnecte l'utilisateur après 15 minutes d'inactivité
 * et l'invite clairement à se reconnecter.
 */
export const useSessionTimeout = (enabled: boolean = true) => {
  const warningTimer = useRef<ReturnType<typeof setTimeout>>();
  const logoutTimer = useRef<ReturnType<typeof setTimeout>>();
  const expiredRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    const clearTimers = () => {
      if (warningTimer.current) clearTimeout(warningTimer.current);
      if (logoutTimer.current) clearTimeout(logoutTimer.current);
    };

    const expireSession = async () => {
      if (expiredRef.current) return;
      expiredRef.current = true;
      clearTimers();
      try {
        await supabase.auth.signOut();
      } catch {
        // on redirige quand même
      }
      window.location.href = '/auth?reason=timeout';
    };

    const resetTimers = () => {
      if (expiredRef.current) return;
      if (document.visibilityState === 'hidden') return;
      clearTimers();

      warningTimer.current = setTimeout(() => {
        toast({
          title: 'Session bientôt expirée',
          description:
            'Votre session va expirer dans 1 minute. Bougez la souris ou touchez l’écran pour rester connecté.',
        });
      }, INACTIVITY_LIMIT_MS - WARNING_BEFORE_MS);

      logoutTimer.current = setTimeout(expireSession, INACTIVITY_LIMIT_MS);
    };

    ACTIVITY_EVENTS.forEach((evt) =>
      window.addEventListener(evt, resetTimers, { passive: true })
    );
    resetTimers();

    return () => {
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, resetTimers));
      clearTimers();
    };
  }, [enabled]);
};
