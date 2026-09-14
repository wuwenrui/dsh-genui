# LawyerDesk GenUI redistribution notices

## Scope and mechanism

Only the legal build overlay changes. `tsdown.config.ts`, the ordinary package manifest and generic entry behavior remain untouched. `scripts/lawyer-bundle-evidence.mjs` attaches a Rolldown `generateBundle` hook to **every** legal configuration, including the host, client, Mermaid, Three and both ECharts assets. Each emitted JavaScript file has an adjacent `.modules.json` containing its actual output module table and external imports. Retained zero-length module entries are included conservatively; this is not a recursive dump of devDependencies.

Some npm inputs are already bundles. `scripts/lawyer-embedded.mjs` additionally reads their original versioned module markers: Mermaid's js-yaml chunk, the parser's Langium/Chevrotain/VSCode/lodash code, and Three's explicit Earcut version marker. Those are separate exact package identities, not the locally installed version guessed from a dependency range. The checked-in `legal/embedded/` contains original package.json and LICENSE/NOTICE files obtained from the exact public npm tarballs; `provenance.json` records source URLs and verified SHA-512 tarball integrity. Ordinary packaging is offline and does not refetch, install or execute those packages.

Rough.js's minified npm entry hides four dependency identities. In the **legal overlay only**, resolution uses the same installed Rough.js package's `bin/rough.js` source modules instead of `bundled/rough.esm.js`. Rolldown now accounts for hachure-fill, path-data-parser, points-on-curve and points-on-path using their actual installed modules/versions. No generic build or runtime policy is changed. This is a build-input change, so Lead must retain normal desktop/Mermaid rendering acceptance before publishing.

The collector copies original LICENSE/COPYING/NOTICE/copyright files byte-for-byte, including ECharts NOTICE and its nested d3 license, tslib CopyrightNotice, and embedded package originals. It also retains original copyright/license block comments from bundled inputs in `third-party-licenses/embedded-source-notices.txt`, including Cytoscape's borrowed-code attributions and layout-base's Apache text. Snippets with no independent published version are attributed by enclosing package/version and source path; no author or version is invented. Package-level nested notice files may be conservatively broader than the actual used code (for example Three's font notices); fonts themselves are not shipped.

## Reviewed license decisions

- Accepted standalone expressions: MIT, ISC, BSD-2-Clause, BSD-3-Clause, Apache-2.0 and 0BSD. A new/unknown expression or missing original license fails packaging, rather than silently treating it as MIT.
- DOMPurify 3.4.13 declares `(MPL-2.0 OR Apache-2.0)`. Distribution elects **Apache-2.0**; both original license files and the original header are retained. This does not turn an OR into an AND or assert that MPL requirements were satisfied.
- Khroma 2.1.0 has no package.json license field. Its actual `license` file grants MIT and names Fabio Spampinato and Andrew Maney. The exception is exact-version and original-file-SHA-256 pinned (`66b333b0f66759a0b710459e03f7029abe17f4358114a128d2c972e642961b49`); the report retains a null declared field and separately records the selected MIT license.
- No missing copyright is generated from package author metadata. Apache boilerplate placeholders in originals remain originals. Notices are a redistribution engineering audit, not an assurance about rights outside these source materials.

## Repeatable commands and evidence

```sh
# Typecheck, clean legal build, collect/check notices, npm pack --ignore-scripts,
# compare the complete tar member list and every member byte with the checked stage.
node scripts/package-lawyer.mjs

# Read-only recheck of stage against actual installed source and embedded originals.
node scripts/lawyer-notices.mjs

node_modules/.bin/vitest run tests/lawyer-host.spec.ts tests/lawyer-policy.spec.tsx tests/lawyer-client.spec.tsx tests/lawyer-package.spec.tsx tests/lawyer-notices.spec.ts --maxWorkers=2 --minWorkers=1

# Explicit maintenance only, after reviewing new prebundle version markers:
# reads public npm tarballs and verifies dist.integrity; never installs/runs them.
node scripts/refresh-lawyer-embedded.mjs
```

Delivered inside the tarball: root MIT `LICENSE`, `THIRD-PARTY-NOTICES.txt`, `third-party-manifest.json`, original files under `third-party-licenses/`, and per-output module evidence. `dist-lawyer/license-check-evidence.json` binds final tar SHA-256/byte count to notice and actual tar verification results. The manifest binds every emitted output and original document to its SHA-256; the checker rejects missing output metadata, changed bundle bytes, changed/missing notices, absent embedded identities and unreviewed license expressions.

Tests use disposable directories in this worktree, do not access production and prove byte-preserving/repeatable copying, missing-license/metadata failure, unknown/copyleft-expression failure, tamper detection and real packaged engine coverage. Packaging never commits, publishes, signs, reads credentials or changes product seeds. Lead owns subsequent product-seed and desktop acceptance.
