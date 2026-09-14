/** Product build overlays entries only; upstream build remains unchanged. */
import upstream from './tsdown.config.ts'
import type { UserConfig } from 'tsdown'
import { lawyerBundleEvidence } from './scripts/lawyer-bundle-evidence.mjs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = dirname(fileURLToPath(import.meta.url))
const [host, client, ...assets] = upstream
if (!host || !client) throw new Error('Upstream build layout changed; review LawyerDesk adapter')
export default [
  { ...host, name: 'lawyer-genui-host', entry: { lawyer: 'src/lawyer/index.ts' }, outDir: 'lib-lawyer',
    deps: { alwaysBundle: [/.*/] }, outputOptions: { entryFileNames: '[name].js', codeSplitting: false } },
  { ...client, name: 'lawyer-genui-client', entry: { client: 'src/lawyer/client.tsx' }, outDir: 'lib-lawyer' },
  ...assets.map(config => ({ ...config, outDir: 'lib-lawyer' })),
] .map(config => ({ ...config, plugins: [...(config.plugins ?? []), lawyerBundleEvidence(root)] })) satisfies UserConfig[]
