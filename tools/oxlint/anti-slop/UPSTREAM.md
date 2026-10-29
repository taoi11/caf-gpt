# Vendored anti-slop

- Source: [dmmulroy/anti-slop](https://github.com/dmmulroy/anti-slop), canonical `src/`.
- Reconciled upstream revision: [`13909c9e07590f5a85d93c62712259fe14a883f7`](https://github.com/dmmulroy/anti-slop/commit/13909c9e07590f5a85d93c62712259fe14a883f7) (2026-10-14).
- Previous pristine source: [`446268e5d15baa968eaec669ff65358d36ae6259`](https://github.com/dmmulroy/anti-slop/commit/446268e5d15baa968eaec669ff65358d36ae6259). Every original plugin source file imported in CAF-GPT commit `07a4cad` matches this revision after the repository's Biome formatting. Git history through pre-update CAF-GPT commit `382e044` adds only the upstream MIT license (`3d352dc`); no local behavioral changes were found.

## Reconciled changes

All generic production files were compared with the recovered base and incoming snapshot. Existing unchanged files were retained; changed files and new helpers were adopted after review. This includes alias/scope and function-parameter analysis fixes, known-value predicate checks, `typeof ... === "undefined"` probes, static member-name handling, and non-empty/configurable safety markers with exported-declaration support.

The three new generic rules are registered and enabled at error severity: `no-array-filter-map`, `no-reduce-accumulator-copy`, and `require-readable-spacing`. The native companion `oxc/no-accumulating-spread` is also enabled. Both `oxlint` and `@oxlint/plugins` are exact-pinned at the already-resolved compatible version `1.78.0`; unrelated dependency resolutions remain unchanged.

## Intentional local differences

- Generic production source is formatted with CAF-GPT's Biome settings (two spaces, 100-column width, no trailing function-argument commas). No behavior customization or pending generic merge conflict remains.
- Optional `effect/` is not copied or enabled: CAF-GPT does not use Effect.
- Upstream test files remain outside the production vendor copy. During this update all 18 generic RuleTester suites from the pinned snapshot were executed against the reconciled local files. The CLI spacing regression was also run, replacing only its `pnpm exec oxlint` invocation with the installed npm project's Oxlint binary.
- Existing plugin path, severities, ignores, and `typescript/no-explicit-any` remain in `oxlint.config.ts`. `ClefAiRunner.run` has one documented `no-unknown-returns` boundary exception: raw external AI data stays untrusted until both consumers immediately schema-parse it, rather than disguising `unknown` through a type alias.
- The root MIT `LICENSE` is retained. The spacing engine additionally retains ESLint Stylistic's MIT license and separate provenance in `vendor/eslint-stylistic/`.

## Verification (2026-10-28)

- All 18 generic upstream RuleTester suites: passed.
- Exported plugin CLI spacing checks (multi-file rejection, autofix, repeat-fix stability): passed.
- Vendored plugin explicit TypeScript check with upstream's strict compiler contract: passed. The application compiler excludes `tools/`; it is not evidence for vendor type correctness. An extra `noUncheckedIndexedAccess` probe (not enabled upstream or in CAF-GPT) finds an upstream indexed-access diagnostic in `shared/dictionary-types.ts`; source was not changed for an unconfigured compiler option.
- `npm run format` and `npm run lint`: passed (zero lint findings).
- `npm run compile`: passed.
- Unit tests: 323 passed; three existing `formatOutlookSentDate` fixtures fail on Node `26.12.1` / ICU `78.3` / tzdata `2026e`. The same three failures reproduce on untouched CAF-GPT `382e044`: runtime `America/Edmonton` is UTC-6 for those November/January dates, while fixtures expect UTC-7. Date behavior and fixture expectations are not changed by this lint update.
- Workers tests, run separately because the unit command stops on failure: 60 passed.
- Application cleanup includes required blank-line fixes, a single-pass normalized-recipient collection, typed Clef request/test seams, and schema-based Clef answer validation (including numeric probability values). Malformed external data remains fail-closed with the existing response-versus-answer reason codes; focused malformed-payload regression tests were added.

## Next update

Follow the pinned upstream [reviewed-merge procedure](https://github.com/dmmulroy/anti-slop/blob/13909c9e07590f5a85d93c62712259fe14a883f7/skills/install-anti-slop/references/update.md). Stage incoming source separately; use this revision as the pristine base and compare both base-to-local and base-to-incoming. Preserve local configuration and formatting; do not replace the directory wholesale. Keep both MIT licenses and the nested Stylistic provenance. Pre-update source/configuration is recoverable from CAF-GPT commit `382e044`; no user work was stashed or overwritten.
