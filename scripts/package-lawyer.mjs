#!/usr/bin/env node
/** Build a fixed, self-contained product artifact. Never install, publish or mutate upstream manifest. */
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { writeNotices } from './lawyer-notices.mjs'
import { verifyLawyerTarball } from './verify-lawyer-tarball.mjs'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist-lawyer')
const stage = join(dist, 'package')
const version = '0.10.0-lawyer.1'
const run = (file, args, cwd = root) => execFileSync(file, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' })
// Use the already-installed worktree tooling. No package manager/network install.
run(process.execPath, [join(root, 'node_modules/typescript/bin/tsc'), '--noEmit'])
rmSync(join(root, 'lib-lawyer'), { recursive: true, force: true })
run(join(root, 'node_modules/.bin/tsdown'), ['--config', 'tsdown.lawyer.config.ts'])
rmSync(stage, { recursive: true, force: true })
mkdirSync(stage, { recursive: true })
cpSync(join(root, 'lib-lawyer'), join(stage, 'lib'), { recursive: true })
for (const name of ['LICENSE', 'LAWYER_SKILL.md']) cpSync(join(root, name), join(stage, name))
const upstream = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const manifest = {
  name: upstream.name, version, type: 'module', license: upstream.license,
  description: 'LawyerDesk 按需法律结果展示（受管适配版）', repository: upstream.repository,
  main: './lib/lawyer.js',
  exports: { '.': './lib/lawyer.js', './lawyer': './lib/lawyer.js', './client': './lib/client.js', './lawyer-client': './lib/client.js', './package.json': './package.json' },
  dsh: { bundle: { patch: './cordis.patch.yml' }, client: { platform: 'web', inject: [] } },
}
writeFileSync(join(stage, 'package.json'), JSON.stringify(manifest, null, 2) + '\n')
writeFileSync(join(stage, 'cordis.patch.yml'), '- insert:\n    - id: lawyer-genui\n      name: "@changfenhuang/dsh-genui"\n')
const licenses = writeNotices(root, stage)
run('npm', ['pack', '--ignore-scripts', '--pack-destination', dist], stage)
const file = join(dist, `changfenhuang-dsh-genui-${version}.tgz`)
const bytes = readFileSync(file)
const tarball = verifyLawyerTarball(file, stage)
const evidence = { file, packageName: manifest.name, version, licenses, tarball, sha256: createHash('sha256').update(bytes).digest('hex'), size: bytes.length }
writeFileSync(join(dist, 'license-check-evidence.json'), JSON.stringify(evidence, null, 2) + '\n')
console.log(JSON.stringify(evidence))
