import { relative, dirname, resolve } from 'node:path'
import { createRequire } from 'node:module'

/** Capture the final Rolldown output module table, not the dependency graph. */
export function lawyerBundleEvidence(root) {
  return {
    name: 'lawyer-bundle-license-evidence',
    resolveId(source) {
      // Same installed Rough.js implementation, before its opaque minified rollup.
      // This exposes its four embedded dependencies to the output module table.
      if (source === 'roughjs') {
        const require = createRequire(resolve(root, 'package.json'))
        return resolve(dirname(require.resolve('roughjs')), '../bin/rough.js')
      }
    },
    generateBundle(_options, bundle) {
      for (const output of Object.values(bundle)) {
        if (output.type !== 'chunk') continue
        const modules = Object.keys(output.modules).sort().map(id => {
          if (id.startsWith('\0')) return id.replaceAll(root, '<root>')
          return relative(root, id).replaceAll('\\', '/')
        })
        this.emitFile({ type: 'asset', fileName: `${output.fileName}.modules.json`, source: JSON.stringify({
          schemaVersion: 1, output: output.fileName, modules,
          imports: output.imports, dynamicImports: output.dynamicImports,
        }, null, 2) + '\n' })
      }
    },
  }
}
