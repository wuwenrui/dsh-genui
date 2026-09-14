import type { GenuiSpec } from '../client/spec.ts'
import { isLawyerMode, lawyerMediaSource } from '../client/product-policy.ts'

/** Defense at the final render boundary, including ECharts image symbols/styles.
 * Runs only on already guard-bounded specs; no script/HTML or external image fetch.
 */
export function constrainLawyerMedia(spec: GenuiSpec): GenuiSpec {
  if (!isLawyerMode()) return spec
  function walk(value: unknown, key = '', depth = 0): unknown {
    if (depth > 32) return undefined
    if (typeof value === 'string') {
      if (/^image:\/\//i.test(value)) {
        const source = lawyerMediaSource(value.slice(8))
        return source ? `image://${source}` : undefined
      }
      return ['src', 'poster', 'image'].includes(key) ? lawyerMediaSource(value) : value
    }
    if (Array.isArray(value)) return value.map(item => walk(item, '', depth + 1))
    if (value && typeof value === 'object') {
      const object = value as Record<string, unknown>
      // Mermaid may preload image nodes while laying out, before SVG sanitization.
      if (object.type === 'mermaid' && typeof object.code === 'string' && /(?:img|image)\s*:|<img\b|url\s*\(/i.test(object.code)) {
        return { type: 'text', content: '图表包含图片资源，未自动加载；请改用文字节点。', size: 'muted' }
      }
      if (['image', 'audio', 'video'].includes(String(object.type)) &&
          (typeof object.src !== 'string' || !lawyerMediaSource(object.src))) {
        return { type: 'text', content: '该媒体未加载：仅允许受管同源资源。', size: 'muted' }
      }
      return Object.fromEntries(Object.entries(object).map(([k, v]) => [k, walk(v, k, depth + 1)]).filter(([, v]) => v !== undefined))
    }
    return value
  }
  return walk(spec) as GenuiSpec
}
