let urlUserId: string | null = null;

export function setUrlUserId(userId: string) {
  urlUserId = userId;
}

export function getUrlUserId(): string | null {
  return urlUserId;
}