export function resolveAuthNextPath(search: string, fallback = '/pin-login') {
  const next = new URLSearchParams(search).get('next')?.trim() ?? '';

  if (!next.startsWith('/') || next.startsWith('//')) {
    return fallback;
  }

  return next;
}
