---
name: Headless test mode
slug: headless-test-mode
status: planned
frozen: true
created: 2026-05-11
---

# Headless test mode

## Pattern summary

When `npm run verify` runs the eight Playwright-driven verify scripts, each one spawns a real Electron app and a visible BrowserWindow pops up on screen and bounces the macOS dock icon, then closes a few seconds later. Over a full run this is a barrage of popups. This feature suppresses the window display and the dock icon during test runs while keeping the offscreen render path intact so Playwright assertions and screenshots continue to work. The hook is `process.env.NODE_ENV === 'test'`: in that case `src/main.ts` constructs the BrowserWindow with `show: false` and calls `app.dock?.hide()` on `app.whenReady()`. Every existing verify script already sets `NODE_ENV=test` via the `env` argument to `electron.launch`, so no script-level changes are strictly required — but `test/verify/package.verify.ts` launches the **packaged** `.app` with `executablePath`, and that env propagation must be confirmed so the post-build smoke check is also silent. Production runs (i.e. `npm start` and any installed-DMG launch) are unaffected — the dock icon and window stay visible by default.

**In scope:** the `NODE_ENV === 'test'` branch in `src/main.ts` that sets `show: false` on the BrowserWindow and calls `app.dock.hide()`; confirming all eight `test/verify/*.verify.ts` scripts pass `env: { ...process.env, NODE_ENV: 'test' }` to `electron.launch` (or to the packaged `.app` launch in `package.verify.ts`); one new unit test asserting the BrowserWindow options-builder respects the env flag; one new Playwright verify script that exercises a hidden window end-to-end (asserts `isVisible() === false` while still confirming the renderer produced "TODO").

**Out of scope:** the OS folder picker in `vault-picker.verify.ts` (separate dialog — already stubbed/handled in the renderer test path); macOS permission prompts that Electron triggers on first use; suppressing the `npm run start` window (production behavior stays unchanged); a CLI `--headless` flag (env var is enough); Linux/Windows headless variants (Linux already runs fine in CI under Xvfb if anyone wires that up later — out of scope here).

## Acceptance criteria

1. Given the Electron app is launched with `NODE_ENV=test`, when Playwright connects and the first window opens, then `BrowserWindow.isVisible()` returns `false` (queried via `app.evaluate` on the main process).
2. Given the Electron app is launched without `NODE_ENV` set (or set to anything other than `test`), when the first window opens, then `BrowserWindow.isVisible()` returns `true`.
3. Given the Electron app is launched with `NODE_ENV=test`, when Playwright reads `[data-brand]` from the first window, then the text content equals "TODO" (the offscreen render still produces correct output).
4. Given the full `npm run verify` chain runs, when complete, then all eight existing Playwright verify scripts pass without modification to their assertions, and their captured screenshots show the same content as before (regression guard).

## Step-definition file

**Not applicable.** This feature has no Cucumber surface (skill deviation — same as `package` plan). All ACs are exercised by `test/data/headlessOptions.spec.ts` (unit) and `test/verify/headlessTestMode.verify.ts` (Playwright).

## BDD test list

[file: test/data/headlessOptions.spec.ts]
- `describe("buildWindowOptions")` > `it("returns show false when NODE_ENV is test")`
- `describe("buildWindowOptions")` > `it("returns show true when NODE_ENV is unset")`
- `describe("buildWindowOptions")` > `it("returns show true when NODE_ENV is production")`

No Tallahassee/DOM tests for this feature (no renderer surface change).

## File map

### New files
- `src/main/windowOptions.ts` — exports `buildWindowOptions(): Electron.BrowserWindowConstructorOptions` that returns the existing BrowserWindow options object plus `show: process.env.NODE_ENV !== 'test'`. Extracted so `test/data/headlessOptions.spec.ts` can import the pure function without spinning up Electron.
- `test/data/headlessOptions.spec.ts` — three unit tests over `buildWindowOptions` (env variable sets the right `show` value).
- `test/verify/headlessTestMode.verify.ts` — Playwright script. Launches Electron with `NODE_ENV=test`, captures `app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisible())` and asserts `false`; reads `[data-brand]` and asserts `"TODO"`; takes one screenshot (`headlessTestMode-rendered.png`) confirming the offscreen renderer still emits correct DOM. Also exercises the inverse case in a second sub-launch: launch without `NODE_ENV=test`, assert `isVisible()` is `true`, close immediately (no screenshot needed — the inverse is to show that production still pops the window).

### Files to update
- `src/main.ts`:
  - Replace the inline `new BrowserWindow({...})` call with `new BrowserWindow(buildWindowOptions())`. Keep the existing options shape; only `show` is new.
  - In the `app.whenReady().then(createWindow)` block (or near it), add `if (process.env.NODE_ENV === 'test' && app.dock) app.dock.hide()`. This must run before the first window appears.
- `test/verify/package.verify.ts` — verify the env propagation when launching the packaged `.app`: ensure the call to `electron.launch({ executablePath: ..., env: ... })` (or equivalent) includes `NODE_ENV: 'test'`. If today's script doesn't, add it. No assertion change.
- `package.json` — append `&& ts-node test/verify/headlessTestMode.verify.ts` to the `verify:playwright` script.

### DOM contract
No new selectors. The feature does not change the rendered DOM.

### Visual treatment
No styling changes. The only "visual" effect is the **absence** of a visible window during test runs.

## Skill deviations (recorded)

Same shape as the `package` plan: no Gherkin `.feature` file, no Cucumber step defs, no Tallahassee/DOM tests, no vault fixtures. Build/test-infrastructure feature, not a UI feature. AC traceability via three unit tests on `buildWindowOptions` + one verify script that exercises the hidden-window behavior end-to-end.

## Data fixtures

None.
