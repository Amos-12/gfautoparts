/**
 * Détection centralisée des erreurs de session / authentification
 * et messages clairs à afficher à l'utilisateur.
 */

export const SESSION_EXPIRED_MESSAGE =
  "Votre session a expiré. Veuillez vous reconnecter pour continuer.";

export const SESSION_TIMEOUT_MESSAGE =
  "Session expirée après 15 minutes d'inactivité. Veuillez vous reconnecter.";

const AUTH_ERROR_PATTERNS = [
  'jwt expired',
  'jwt is expired',
  'invalid jwt',
  'token expired',
  'refresh_token_not_found',
  'invalid refresh token',
  'session_not_found',
  'session expired',
  'not authenticated',
  'auth session missing',
  'unauthorized',
  '401',
];

export const isSessionError = (error: unknown): boolean => {
  if (!error) return false;
  const anyErr = error as any;
  if (anyErr?.status === 401 || anyErr?.code === 401) return true;
  const msg = String(anyErr?.message ?? anyErr).toLowerCase();
  return AUTH_ERROR_PATTERNS.some((p) => msg.includes(p));
};

/** Message clair et précis à afficher pour une erreur donnée. */
export const getFriendlyErrorMessage = (
  error: unknown,
  fallback = "Une erreur est survenue. Veuillez réessayer."
): string => {
  if (isSessionError(error)) return SESSION_EXPIRED_MESSAGE;
  const msg = (error as any)?.message;
  return typeof msg === 'string' && msg.trim() ? msg : fallback;
};

/** Redirige vers la page de connexion en indiquant la raison. */
export const redirectToLogin = (reason: 'timeout' | 'expired' = 'expired') => {
  window.location.href = `/auth?reason=${reason}`;
};
