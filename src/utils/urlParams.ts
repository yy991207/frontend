export function getUrlParam(param: string): string | null {
  const urlParams = new URLSearchParams(window.location.search);
  console.log('[urlParams] window.location.search:', window.location.search);
  console.log('[urlParams] urlParams:', urlParams.toString());
  const value = urlParams.get(param);
  console.log('[urlParams] getUrlParam', param, '=', value);
  return value;
}

export function getUrlUserId(): string | null {
  const userId = getUrlParam('user_id');
  console.log('[urlParams] getUrlUserId():', userId);
  return userId;
}

export function getConfigUrl(): string {
  const isDev = import.meta.env.DEV;
  if (isDev) {
    return '/config.yaml';
  }
  return '/frontend/config.yaml';
}