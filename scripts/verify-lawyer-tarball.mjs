import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/** Verify the distributed tar, not only the pre-pack staging directory. */
export function verifyLawyerTarball(file, stage) {
  const walk = (dir, prefix = '') => readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = prefix + entry.name
    if (entry.isSymbolicLink()) throw new Error(`Unexpected staged symlink: ${path}`)
    return entry.isDirectory() ? walk(join(dir, entry.name), `${path}/`) : [path]
  }).sort()
  const expected = walk(stage)
  const actual = execFileSync('tar', ['-tzf', file], { encoding: 'utf8' }).trim().split('\n').filter(p => !p.endsWith('/')).sort()
  if (JSON.stringify(actual) !== JSON.stringify(expected.map(p => `package/${p}`))) throw new Error('Packed file set differs from verified stage')
  for (const path of expected) {
    const bytes = execFileSync('tar', ['-xzOf', file, `package/${path}`], { maxBuffer: 20 * 1024 * 1024 })
    if (!bytes.equals(readFileSync(join(stage, path)))) throw new Error(`Packed bytes differ: ${path}`)
  }
  return { verified: true, files: actual.length, method: 'tar member set and every member byte-compared to notice-verified stage' }
}
