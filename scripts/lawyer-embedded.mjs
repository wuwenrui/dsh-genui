import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

/** Upstream esbuild prebundles hide dependencies from Rolldown's module table. */
export function embeddedPackages(root, module) {
  const source = readFileSync(join(root, module), 'utf8')
  const found = new Map()
  for (const match of source.matchAll(/^\/\/ .*node_modules\/\.pnpm\/([^/]+)\/node_modules\/((?:@[^/]+\/)?[^/]+)\/(.+)$/gm)) {
    const [, store, name, file] = match
    const version = store.slice(name.replace('/', '+').length + 1).split('_')[0]
    if (!/^\d+\.\d+\.\d+/.test(version)) throw new Error(`Unclassified embedded version: ${match[0]}`)
    const key = `${name}@${version}`
    const local = join(root, 'node_modules/.pnpm', store, 'node_modules', name)
    const vendored = join(root, 'legal/embedded', encodeURIComponent(key))
    const dir = existsSync(join(vendored, 'package.json')) ? vendored : local
    if (!existsSync(join(dir, 'package.json'))) throw new Error(`Missing exact embedded license source: ${key} (in ${module})`)
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
    if (pkg.name !== name || pkg.version !== version) throw new Error(`Embedded identity mismatch: ${key}`)
    if (!found.has(key)) found.set(key, { dir, pkg, files: [] })
    found.get(key).files.push(`${module} :: ${file}`)
  }
  const earcut = source.match(/\/\/ copy of mapbox\/earcut version (\d+\.\d+\.\d+)/)
  if (earcut) {
    const key = `earcut@${earcut[1]}`
    const dir = join(root, 'legal/embedded', encodeURIComponent(key))
    if (!existsSync(join(dir, 'package.json'))) throw new Error(`Missing exact embedded license source: ${key}`)
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
    if (pkg.name !== 'earcut' || pkg.version !== earcut[1]) throw new Error(`Embedded identity mismatch: ${key}`)
    found.set(key, { dir, pkg, files: [`${module} :: ${earcut[0]}`] })
  }
  return [...found.values()]
}
