export const INTERNAL_HOSTS = ['newsandniche.com', 'www.newsandniche.com'];

// Allow overriding via env: BLOCKED_COMPETITOR_HOSTS=domain1.com,domain2.com
const envBlocked = (process.env.BLOCKED_COMPETITOR_HOSTS || '')
  .split(',')
  .map(s => s.trim().toLowerCase())
  .filter(Boolean);

export const BLOCKED_COMPETITOR_HOSTS = envBlocked.length > 0 ? envBlocked : [
  'competitor1.com',
  'competitor2.com'
];

export function isInternalHost(hostname) {
  return INTERNAL_HOSTS.some(h => hostname === h || hostname.endsWith(`.${h}`));
}


