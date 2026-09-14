# LawyerDesk GenUI adapter

## Maintenance boundary

Upstream baseline: `21ee4f42adc80452ade39fff07d40d646331caa1` (GenUI 0.10.0).
Keep the original package identity, `src/plugin/index.ts`, `src/client/index.tsx`, ordinary build and generic skill intact. Product host/browser composition lives under `src/lawyer/`. Shared renderer changes are small opt-in policy seams, not an upstream UI fork. Do not load the generic and legal browser entries together: mode is per plugin/browser module instance.

`src/lawyer/index.ts` replaces the mandatory-display prompt and render tool description, registers the legal `genui` skill, and retains the existing render/validation tools and local engine asset route. `src/lawyer/client.tsx` mounts the upstream streaming DOM renderer, tool cards and panel; it owns action transport feedback and does not mount generic templates, achievement toasts or the generic `/panel` starter.

## Product constraints

- Legal mode does not read/write form or panel localStorage. Unsent fields remain React memory only; panel state remains per-session memory and is rebuilt from host history after reload. Existing upstream cache is not imported or deleted. **This does not disable host conversation logs:** already-sent action fields and model responses remain governed by LawyerDesk session retention.
- Display and click feedback are not business success. Inline, panel and tool-card actions use the scoped conversation send API; absence, synchronous failure and rejection produce visible generic errors without logging case fields. Accepted sends tell users to wait for actual tool-confirmed results.
- Automatic image/audio/video sources must be same-origin HTTP(S). Reject opaque/data/protocol-relative/backslash sources and credentials. Final renderer also filters ECharts image symbols/styles; Mermaid image-bearing diagrams are declined before the engine can preload images. Origin route authorization and redirects remain the host's responsibility; this is not a substitute for the host CSP/network policy.
- No template/achievement UI or counters in legal mode. The ordinary upstream entry retains original behavior.
- No case database, fake legal data, legal business mutation API, external model provider or Harness core changes are introduced.

## Build and artifact contract

Use an already-installed worktree. Do not run install in parallel with Lead's dependency job.

```sh
node scripts/package-lawyer.mjs
node_modules/.bin/vitest run tests/lawyer-host.spec.ts tests/lawyer-policy.spec.tsx tests/lawyer-client.spec.tsx tests/lawyer-package.spec.tsx tests/lawyer-notices.spec.ts --maxWorkers=2 --minWorkers=1
```

The script typechecks, builds `tsdown.lawyer.config.ts` into `lib-lawyer/`, stages `dist-lawyer/package/`, then uses `npm pack --ignore-scripts` locally. It neither publishes nor changes the root npm manifest.

Artifact: `dist-lawyer/changfenhuang-dsh-genui-0.10.0-lawyer.1.tgz`.

- Package name `@changfenhuang/dsh-genui`; version `0.10.0-lawyer.1`; ESM, no runtime dependencies, peers, or lifecycle scripts in the staged manifest.
- `main` and `exports["."]` point to `./lib/lawyer.js`; `./lawyer` aliases it.
- `exports["./client"]` and `./lawyer-client` are **strings** pointing to `./lib/client.js`; `./package.json` is exported.
- `dsh.client.platform = web`; bundle patch inserts `id: lawyer-genui`, **root** `name: @changfenhuang/dsh-genui` to satisfy product row admission. Browser module-loader ID remains the root package name.
- Engines under `lib/assets/` are served by the bundled host; only host-provided React/primitives remain browser module-loader externals. Host imports are standalone Node built-ins.
- Original MIT license, third-party LICENSE/NOTICE originals and actual output-module evidence are included. Packaging fails on missing or unreviewed licenses and verifies every tar member against the checked stage. See [redistribution notice audit and repeatable checks](lawyerdesk-licenses.md); Lead still owns packaged desktop acceptance.

The built-artifact smoke explicitly executes the actual browser module-loader factory and proves legal policy is active before store initialization, then clicks a tool-card button. It skips only when no product build exists; run it after packaging for product acceptance.

## Integration acceptance owned by Lead

Use the managed signed-product packaging/desktop migration paths, not public npm installation. Validate real LawyerDesk loading, streamed fence render, tool card/panel callbacks, failure feedback, refresh behavior and same-origin asset loading on the product's pinned host. Unit tests and the compiled-factory smoke do not establish that an installed Electron app is updated or production is deployed.

On upstream merges, review renderer entry contracts, store entry points, new automatic resource-loading surfaces and new generic UI entry points. Do not relax the product policy to make upstream tests pass.
