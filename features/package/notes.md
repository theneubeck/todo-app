---
slug: package
frozen: false
---

# Notes — Package

This file is the only place Implement and Verify may write planning-adjacent content.
The plan and the .feature file are frozen — if either turns out to be wrong, append
a `## Problem` block here and stop. The user will re-run the plan-feature skill.

## Problems

(none yet)

## Verify findings

### Verify — package — 2026-05-11

| Check | Result |
|---|---|
| Lint (`npm run lint`) | PASS — 0 errors, 0 warnings |
| Type check (`npm run typecheck`) | PASS — exit 0 |
| Coverage (`npm run test:coverage`) | PASS — 226 tests, branches 90.2% / lines 99.52% / funcs 99.31% / stmts 98.49% (all ≥ 90% threshold) |
| `npm test` (via coverage run) | PASS — 226 passing, 0 failures |
| Gherkin (`npm run test:bdd`) | PASS — 53 scenarios / 211 steps (advisory check) |
| Full chain (`npm run verify`) | PASS — exit 0; all 7 Playwright verify scripts green, including `package.verify.ts` |
| AC1: `npm run package` exits 0 + DMG exists | PASS — exit 0; `release/todoz-0.0.1-arm64.dmg` present |
| AC2: `todoz.app` at mount root | PASS — found at `/Volumes/todoz 0.0.1-arm64/todoz.app` |
| AC3: `CFBundleIdentifier` + `CFBundleName` | PASS — `com.theneubeck.todoz` / `todoz` |
| AC4: app icon is custom, not the Electron diamond | PASS — extracted `icon.icns` matches `assets/icon.png` (black rounded square with white checkmark); also visible as the left-hand DMG-window icon |
| AC5: `todoz.app` + `Applications` symlink at volume root | PASS — both present in `readdirSync(mount)` (entries: `.DS_Store, .VolumeIcon.icns, .background.tiff, Applications, todoz.app`) |
| AC6: launched packaged app renders `[data-brand]` === "TODO" | PASS — Playwright launch via `Contents/MacOS/todoz`; `textContent('[data-brand]')` returned `"TODO"`; visually confirmed in `package-launched-app.png` |
| Screenshot: `package-icon-source.png` | PASS — black square + white checkmark, flat, no gradient |
| Screenshot: `package-app-icon.png` | PASS — pixel-equivalent to the source; extracted from the packaged `.icns` via `sips` |
| Screenshot: `package-dmg-window.png` | PASS — Finder window for "todoz 0.0.1-arm64" shows `todoz.app` (custom icon) + drag-arrow + `Applications` symlink |
| Screenshot: `package-launched-app.png` | PASS — top-left brand text "TODO" visible; main view renders Inbox + tasks + sidebar |

**Overall**: All 6 acceptance criteria pass. The packaged DMG mounts cleanly, ships the custom todoz icon (not the Electron diamond), declares the correct bundle id/name, exposes the Applications symlink for drag-install, and the launched `.app` renders the post-rename `TODO` brand.

## Skill deviations (acknowledged)

This plan has no Gherkin `.feature` file, no Cucumber step defs, and no Tallahassee/DOM tests. The `plan-feature` skill template assumes a UI surface and a vault-data feature — this is a build/distribution feature instead. The deviations are intentional and recorded in `plan.md` under "Skill deviations". Implement should not try to retrofit Gherkin or DOM tests; the unit tests and the verify script are the full test surface.

## Out of scope (next features)

The user explicitly named the immediate next feature: a GitHub Actions workflow that builds and uploads the DMG on tag commits. That work belongs in a separate plan (slug TBD — possibly `release-on-tag` or `ci-package`). Code signing, notarization, and auto-update will likely also need their own plans before public distribution is viable.
