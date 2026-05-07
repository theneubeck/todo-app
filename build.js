// Build script: bundles Electron main, preload (CJS Node) and renderer (browser IIFE),
// then copies the renderer HTML into dist/renderer/.
//
// Renderer wiring: src/renderer/index.ts exports mountTodoList(container) but does
// not call it. The footer below boots the app once DOM is ready, so the bundled
// IIFE renders into <body> as soon as it loads. Build-level only — does not
// modify any source file.
const esbuild = require('esbuild')
const fs = require('fs')
const path = require('path')

const root = __dirname
const dist = path.join(root, 'dist')
fs.mkdirSync(path.join(dist, 'renderer'), { recursive: true })

const RENDERER_BOOT = `
;(function () {
  function boot() {
    try {
      var ns = (typeof todozRenderer !== 'undefined') ? todozRenderer : null;
      var fn = (ns && typeof ns.mountApp === 'function') ? ns.mountApp : null;
      if (!fn) { console.error('[todoz] mountApp not exported'); return; }
      fn(document.body).catch(function (e) { console.error('[todoz] mount failed', e); });
    } catch (e) { console.error('[todoz] boot failed', e); }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else { boot(); }
})();
`

async function run() {
  await esbuild.build({
    entryPoints: [path.join(root, 'src/main.ts')],
    outfile: path.join(dist, 'main.js'),
    platform: 'node',
    format: 'cjs',
    target: 'node18',
    bundle: true,
    external: ['electron'],
    sourcemap: true,
    logLevel: 'info',
  })

  await esbuild.build({
    entryPoints: [path.join(root, 'src/preload.ts')],
    outfile: path.join(dist, 'preload.js'),
    platform: 'node',
    format: 'cjs',
    target: 'node18',
    bundle: true,
    external: ['electron'],
    sourcemap: true,
    logLevel: 'info',
  })

  await esbuild.build({
    entryPoints: [path.join(root, 'src/renderer/index.ts')],
    outfile: path.join(dist, 'renderer/index.bundle.js'),
    platform: 'browser',
    format: 'iife',
    globalName: 'todozRenderer',
    target: 'chrome118',
    bundle: true,
    sourcemap: true,
    logLevel: 'info',
    footer: { js: RENDERER_BOOT },
  })

  fs.copyFileSync(
    path.join(root, 'src/renderer/index.html'),
    path.join(dist, 'renderer/index.html')
  )
  console.log('build: done')
}

run().catch((e) => { console.error(e); process.exit(1) })
