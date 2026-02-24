export const getJwtExpiryMs = (token: string): number | null => {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4);
    const json = atob(padded);
    const parsed = JSON.parse(json) as { exp?: number };
    if (typeof parsed.exp !== 'number') return null;
    return parsed.exp * 1000;
  } catch {
    return null;
  }
};

export const isJwtExpired = (token: string, skewSeconds: number = 15): boolean => {
  const expiry = getJwtExpiryMs(token);
  if (!expiry) return false;
  return Date.now() + skewSeconds * 1000 >= expiry;
};

export const notifyAuthExpired = () => {
  if (typeof window === 'undefined') return;
  const now = Date.now();
  const key = 'auth_expired_notified_at';
  const prev = Number(localStorage.getItem(key) || '0');
  if (now - prev < 5000) return;
  localStorage.setItem(key, String(now));
  window.dispatchEvent(new CustomEvent('auth:expired'));
};

export const handleAuthExpired = () => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('token');
  notifyAuthExpired();
  if (!window.location.pathname.startsWith('/login')) {
    window.location.href = '/login?reason=expired';
  }
};
