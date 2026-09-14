import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { checkNotices, writeNotices } from '../scripts/lawyer-notices.mjs'
const fixtures: string[] = []
afterEach(() => { for (const f of fixtures.splice(0)) rmSync(f, { recursive: true, force: true }) })
function fixture(license = 'MIT') {
  const root = mkdtempSync(resolve('.lawyer-notice-test-')); fixtures.push(root)
  const stage = join(root, 'stage')
  mkdirSync(join(stage, 'lib'), { recursive: true })
  mkdirSync(join(root, 'node_modules/example'), { recursive: true })
  writeFileSync(join(root, 'node_modules/example/package.json'), JSON.stringify({ name: 'example', version: '1.2.3', license }))
  writeFileSync(join(root, 'node_modules/example/index.js'), 'export const a = 1')
  writeFileSync(join(root, 'node_modules/example/LICENSE'), 'Original fixture text\r\nCopyright Example\r\n')
  writeFileSync(join(stage, 'lib/client.js'), 'const a=1;')
  writeFileSync(join(stage, 'lib/client.js.modules.json'), JSON.stringify({ output: 'client.js', modules: ['node_modules/example/index.js'], imports: [], dynamicImports: [] }))
  return { root, stage }
}
describe('legal third-party notice gate', () => {
  it('copies originals byte-for-byte with exact identity and deterministic evidence', () => {
    const { root, stage } = fixture()
    expect(writeNotices(root, stage)).toMatchObject({ verified: true, packages: 1, outputs: 1 })
    const first = readFileSync(join(stage, 'third-party-manifest.json'))
    writeNotices(root, stage)
    expect(readFileSync(join(stage, 'third-party-manifest.json'))).toEqual(first)
    expect(readFileSync(join(stage, 'third-party-licenses/example%401.2.3/LICENSE'))).toEqual(readFileSync(join(root, 'node_modules/example/LICENSE')))
  })
  it('rejects unknown or copyleft expressions rather than silently labelling MIT', () => {
    const { root, stage } = fixture('GPL-3.0-only')
    expect(() => writeNotices(root, stage)).toThrow('Unreviewed license')
  })
  it('fails on missing license originals and missing output module evidence', () => {
    const { root, stage } = fixture()
    rmSync(join(root, 'node_modules/example/LICENSE'))
    expect(() => writeNotices(root, stage)).toThrow('Missing LICENSE')
    rmSync(join(stage, 'lib/client.js.modules.json'))
    expect(() => writeNotices(root, stage)).toThrow('Missing output module evidence')
  })
  it('detects tampered original notices and changed asset bytes', () => {
    const { root, stage } = fixture(); writeNotices(root, stage)
    writeFileSync(join(stage, 'third-party-licenses/example%401.2.3/LICENSE'), 'changed')
    expect(() => checkNotices(root, stage)).toThrow('Notice verification failed')
    writeNotices(root, stage)
    writeFileSync(join(stage, 'lib/client.js'), 'changed')
    expect(() => checkNotices(root, stage)).toThrow('Notice verification failed')
  })
  it('verifies all actual packaged engines and excludes unbundled development tooling', () => {
    const root = resolve('.'), stage = resolve('dist-lawyer/package')
    expect(checkNotices(root, stage)).toMatchObject({ verified: true, outputs: 6 })
    const manifest = JSON.parse(readFileSync(join(stage, 'third-party-manifest.json'), 'utf8'))
    expect(manifest.outputs.map((o: any) => o.output)).toEqual(['assets/echarts-core.js', 'assets/echarts-full.js', 'assets/mermaid.js', 'assets/three.js', 'client.js', 'lawyer.js'])
    const names = manifest.packages.map((p: any) => p.name)
    for (const name of ['mermaid', 'three', 'echarts', 'zrender', 'js-yaml', 'langium', 'chevrotain', 'hachure-fill', 'points-on-path', 'earcut']) expect(names).toContain(name)
    for (const name of ['typescript', 'vitest', 'tsdown', 'react', 'jsdom']) expect(names).not.toContain(name)
    const dom = manifest.packages.find((p: any) => p.name === 'dompurify')
    expect(dom.selectedLicense).toBe('Apache-2.0')
  })
})
