/** Explicit product mode; ordinary upstream entry keeps its original defaults. */
let lawyerMode = false
export function isLawyerMode(): boolean { return lawyerMode }
/** Set before mounting the renderer; one mode per plugin/browser instance. */
export function setLawyerMode(enabled: boolean): void { lawyerMode = enabled }

/** Automatic media requests must stay on the app origin. No opaque/data URLs. */
export function lawyerMediaSource(value: string): string | undefined {
  if (/[\\\u0000-\u0020]/.test(value) || value.startsWith('//')) return undefined
  if (typeof location === 'undefined') return value.startsWith('/') ? value : undefined
  try {
    const url = new URL(value, location.href)
    return url.origin === location.origin && /^https?:$/.test(url.protocol) && !url.username && !url.password
      ? url.pathname + url.search + url.hash : undefined
  } catch { return undefined }
}
