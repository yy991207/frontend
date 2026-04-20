export function getUrlParam(param: string): string | null {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(param);
}

export function getUrlUserId(): string | null {
  return getUrlParam('user_id');
}