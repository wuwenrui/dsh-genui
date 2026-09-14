# LawyerDesk GenUI license verification

Artifact: `dist-lawyer/changfenhuang-dsh-genui-0.10.0-lawyer.1.tgz`

- SHA-256: `9c8dc5082855043d4ee84e752894aacf27568379ef130e763fc7975ec7024b7d`
- Exact size: **1,793,452 bytes**.
- A second clean offline package build produced the identical SHA-256 and byte count; the explicit equality assertion passed.
- Notice check: **82** exact package identities, **6** output bundles, **90** original-document files (including the supplemental source-notice compilation).
- Distributed tar check: **108** members; complete member set and every member byte compared with the notice-verified stage.
- Typecheck: `node node_modules/typescript/bin/tsc --noEmit`, run by `node scripts/package-lawyer.mjs`, passed.
- Legal tests: **5 files / 24 tests passed** using the command in `lawyerdesk-licenses.md`. Includes execution of the real bundled client factory and actual packaged Mermaid flowchart SVG rendering (jsdom with a deterministic SVG bounding-box stub, not an Electron visual test).
- `git diff --check` passed. Generic `tsdown.config.ts`, `package.json`, `pnpm-lock.yaml` unchanged by this task.

Machine-readable artifact verification: `dist-lawyer/license-check-evidence.json`. Package-level module paths, output hashes, license document hashes, exact versions and embedded-source provenance are in the tarball's `third-party-manifest.json`. Original texts are retained under `third-party-licenses/`, including ECharts NOTICE, selected DOMPurify Apache-2.0 grant, Earcut ISC and the exact embedded parser dependencies. The audit method and exceptions are documented in `lawyerdesk-licenses.md`.

No unresolved missing-license or disallowed-license blocker was found for this build. This records the source-material engineering audit, not a legal opinion. New dependencies/prebundle changes require review; collection never synthesizes copyright holders. The ordinary build remains untouched. Legal Rough.js input resolution changes from its opaque bundle to its same-package source modules, so Lead must retain the normal desktop/Mermaid acceptance.

Non-failing existing tooling warnings: tsdown recommends ESM rather than the required browser module-loader CJS format; Vite reports a missing sourcemap in the installed host-provided UI-primitives package. No production access, credentials, commit, push, signing, publishing or changes outside the authorized GenUI worktree were performed.
