#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { embeddedPackages } from './lawyer-embedded.mjs'

export const sha256 = data => createHash('sha256').update(data).digest('hex')
const json = file => JSON.parse(readFileSync(file, 'utf8'))
const sorted = values => [...values].sort()
function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    if (e.name === 'node_modules' || e.name === '.git' || e.isSymbolicLink()) return []
    const path = join(dir, e.name)
    return e.isDirectory() ? files(path) : [path]
  }).sort()
}
function owner(root, module) {
  let dir = dirname(resolve(root, module))
  while (dir !== root && dirname(dir) !== dir) {
    const path = join(dir, 'package.json')
    if (existsSync(path)) {
      const pkg = json(path)
      if (pkg.name && pkg.version) return { dir, pkg }
    }
    dir = dirname(dir)
  }
  throw new Error(`No package identity for bundled module: ${module}`)
}
// Deliberately small reviewed permissive set; new expressions require review.
const accepted = new Set(['MIT', 'ISC', 'BSD-2-Clause', 'BSD-3-Clause', 'Apache-2.0', '0BSD'])
export function collectNotices(root, lib) {
  const evidence = files(lib).filter(p => p.endsWith('.modules.json'))
  const js = files(lib).filter(p => p.endsWith('.js'))
  if (!js.length || evidence.length !== js.length || js.some(path => !existsSync(`${path}.modules.json`))) throw new Error('Missing output module evidence')
  const packages = new Map()
  const legalComments = new Map()
  const outputs = evidence.map(path => {
    const entry = json(path)
    if (!entry.modules?.length || !existsSync(join(lib, entry.output))) throw new Error(`Invalid evidence: ${path}`)
    for (const module of entry.modules) {
      if (!module.includes('node_modules/')) {
        if (!(module.startsWith('src/') || module.startsWith('\0') || module.startsWith('rolldown:'))) throw new Error(`Unclassified module: ${module}`)
        continue
      }
      const { dir, pkg } = owner(root, module)
      const comments = readFileSync(resolve(root, module), 'utf8').match(/\/\*[\s\S]*?\*\//g) ?? []
      const originals = comments.filter(comment => /copyright|@license|licensed under|permission is hereby|Apache License|SPDX-License-Identifier/i.test(comment))
      if (originals.length) legalComments.set(module, originals.join('\n\n'))
      const key = `${pkg.name}@${pkg.version}`
      if (!packages.has(key)) packages.set(key, { dir, pkg, modules: new Set(), outputs: new Set() })
      packages.get(key).modules.add(relative(dir, resolve(root, module)).replaceAll('\\', '/'))
      packages.get(key).outputs.add(entry.output)
      for (const embedded of embeddedPackages(root, module)) {
        const embeddedKey = `${embedded.pkg.name}@${embedded.pkg.version}`
        if (!packages.has(embeddedKey)) packages.set(embeddedKey, { ...embedded, modules: new Set(), outputs: new Set() })
        for (const file of embedded.files) packages.get(embeddedKey).modules.add(`embedded: ${file}`)
        packages.get(embeddedKey).outputs.add(entry.output)
      }
    }
    return { ...entry, sha256: sha256(readFileSync(join(lib, entry.output))), bytes: statSync(join(lib, entry.output)).size }
  }).sort((a, b) => a.output < b.output ? -1 : 1)
  const documents = [{ path: 'third-party-licenses/embedded-source-notices.txt', bytes: Buffer.from([...legalComments].sort(([a], [b]) => a < b ? -1 : 1).map(([module, text]) => `Source module: ${module}\n\n${text}`).join('\n\n')) }]
  const inventory = sorted(packages.keys()).map(key => {
    const { dir, pkg, modules, outputs } = packages.get(key)
    let selectedLicense = pkg.license === '(MPL-2.0 OR Apache-2.0)' && pkg.name === 'dompurify' ? 'Apache-2.0' : pkg.license
    // khroma omits the manifest field, but ships this reviewed original MIT grant.
    if (key === 'khroma@2.1.0' && pkg.license === undefined && sha256(readFileSync(join(dir, 'license'))) === '66b333b0f66759a0b710459e03f7029abe17f4358114a128d2c972e642961b49') selectedLicense = 'MIT'
    if (!accepted.has(selectedLicense)) throw new Error(`Unreviewed license: ${key}: ${JSON.stringify(pkg.license)}`)
    const sources = files(dir).filter(path => !/\.(?:[cm]?js|ts)$/i.test(path) && /(^|\/)(licen[cs]e[^/]*|copying[^/]*|notice[^/]*|copyright[^/]*|authors[^/]*)($|\/)/i.test(relative(dir, path)))
    if (!sources.some(p => /(^|\/)(licen[cs]e|copying)/i.test(relative(dir, p)))) throw new Error(`Missing LICENSE original: ${key}`)
    const licenses = sources.map(path => {
      const source = relative(dir, path).replaceAll('\\', '/')
      const bytes = readFileSync(path)
      const target = `third-party-licenses/${encodeURIComponent(key)}/${source}`
      documents.push({ path: target, bytes })
      return { source, path: target, sha256: sha256(bytes), bytes: bytes.length }
    })
    return { name: pkg.name, version: pkg.version, license: pkg.license ?? null, selectedLicense,
      provenance: existsSync(join(dir, 'provenance.json')) ? json(join(dir, 'provenance.json')) : { source: 'installed package, exact identity from package.json' },
      outputs: sorted(outputs), modules: sorted(modules), documents: licenses }
  })
  const notice = 'LawyerDesk GenUI — Third-party notices\n\n'
    + 'Scope: actual Rolldown output module tables for host, client and every lazy engine.\n'
    + 'Host-supplied externals are not redistributed by this package. Bundled license comments remain intact.\n'
    + 'Original license/notice files are reproduced byte-for-byte under third-party-licenses/.\n'
    + 'Package-level documents may describe embedded third-party code; those originals are retained in full.\n'
    + 'Additional original source notices: third-party-licenses/embedded-source-notices.txt.\n'
    + 'Bundled snippets without independent versions are attributed by enclosing package and source path, not invented identities.\n\n'
    + inventory.map(p => `${p.name}@${p.version}\nDeclared license: ${p.license}\nDistribution license: ${p.selectedLicense}\nOutputs: ${p.outputs.join(', ')}\n` + p.documents.map(d => `Original: ${d.path}\n`).join('')).join('\n')
  return { report: { schemaVersion: 1, method: 'Rolldown generateBundle output.modules, upstream prebundle module markers and original source notices (conservative inclusion)', outputs, packages: inventory, supplementalDocuments: documents.filter(d => d.path === 'third-party-licenses/embedded-source-notices.txt').map(d => ({ path: d.path, sha256: sha256(d.bytes), bytes: d.bytes.length })) }, notice, documents }
}
export function writeNotices(root, stage) {
  const result = collectNotices(root, join(stage, 'lib'))
  for (const doc of result.documents) {
    const path = join(stage, doc.path)
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, doc.bytes)
  }
  writeFileSync(join(stage, 'THIRD-PARTY-NOTICES.txt'), result.notice)
  writeFileSync(join(stage, 'third-party-manifest.json'), JSON.stringify(result.report, null, 2) + '\n')
  return checkNotices(root, stage)
}
export function checkNotices(root, stage) {
  const expected = collectNotices(root, join(stage, 'lib'))
  const check = (path, bytes) => {
    if (!existsSync(join(stage, path)) || !readFileSync(join(stage, path)).equals(Buffer.from(bytes))) throw new Error(`Notice verification failed: ${path}`)
  }
  check('THIRD-PARTY-NOTICES.txt', expected.notice)
  check('third-party-manifest.json', JSON.stringify(expected.report, null, 2) + '\n')
  for (const doc of expected.documents) check(doc.path, doc.bytes)
  return { verified: true, packages: expected.report.packages.length, outputs: expected.report.outputs.length, originalDocuments: expected.documents.length }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  console.log(JSON.stringify(checkNotices(root, resolve(process.argv[2] ?? join(root, 'dist-lawyer/package')))))
}
