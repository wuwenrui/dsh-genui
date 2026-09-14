#!/usr/bin/env node
/** Explicit maintenance command: read public npm tarballs; never install or execute them. */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve, join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const modules = ['mermaid', 'three'].flatMap(name => JSON.parse(readFileSync(join(root, `lib-lawyer/assets/${name}.js.modules.json`))).modules)
const names = new Map()
for (const module of modules.filter(m => m.includes('node_modules/'))) {
  const source = readFileSync(join(root, module), 'utf8')
  const earcut = source.match(/\/\/ copy of mapbox\/earcut version (\d+\.\d+\.\d+)/)
  if (earcut) names.set(`earcut@${earcut[1]}`, { name: 'earcut', version: earcut[1] })
  for (const [, store, name] of source.matchAll(/^\/\/ .*node_modules\/\.pnpm\/([^/]+)\/node_modules\/((?:@[^/]+\/)?[^/]+)\//gm)) {
    const version = store.slice(name.replace('/', '+').length + 1).split('_')[0]
    names.set(`${name}@${version}`, { name, version })
  }
}
for (const [key, { name, version }] of [...names].sort()) {
  const metadataUrl = `https://registry.npmjs.org/${encodeURIComponent(name)}/${version}`
  const response = await fetch(metadataUrl)
  if (!response.ok) throw new Error(`${metadataUrl}: ${response.status}`)
  const metadata = await response.json()
  const responseTar = await fetch(metadata.dist.tarball)
  if (!responseTar.ok) throw new Error(`Tarball: ${responseTar.status}`)
  const bytes = Buffer.from(await responseTar.arrayBuffer())
  const integrity = 'sha512-' + createHash('sha512').update(bytes).digest('base64')
  if (integrity !== metadata.dist.integrity) throw new Error(`Integrity mismatch: ${key}`)
  const entries = execFileSync('tar', ['-tzf', '-'], { input: bytes, encoding: 'utf8' }).trim().split('\n')
  const chosen = entries.filter(p => p === 'package/package.json' || /(^|\/)(?:licen[cs]e(?:[.-][^/]*)?|copying(?:[.-][^/]*)?|notice(?:[.-][^/]*)?|copyright(?:notice)?(?:[.-][^/]*)?)$/i.test(p))
  const target = join(root, 'legal/embedded', encodeURIComponent(key))
  for (const path of chosen) {
    if (!path.startsWith('package/') || path.includes('..') || path.endsWith('/')) continue
    const output = join(target, path.slice(8))
    mkdirSync(dirname(output), { recursive: true })
    writeFileSync(output, execFileSync('tar', ['-xzOf', '-', path], { input: bytes }))
  }
  writeFileSync(join(target, 'provenance.json'), JSON.stringify({ name, version, metadataUrl, tarball: metadata.dist.tarball, integrity, files: chosen }, null, 2) + '\n')
  console.log(key)
}
