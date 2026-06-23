#!/usr/bin/env node
/**
 * Assembles static deploy folders for pauloventura.org.
 *
 * Default (subpaths): deploy/pauloventura.org/
 *   /mymvp/, /mindandventure/, /delphi/ + hub at /
 *
 * Wix mode (SITE_MODE=wix): deploy/wix/
 *   Separate folders per subdomain — does NOT touch your Wix homepage.
 *   mymvp.pauloventura.org, mindandventure.pauloventura.org, delphi.pauloventura.org
 */
import { spawnSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const WIX_MODE = process.argv.includes('--wix') || process.env.SITE_MODE === 'wix'
const OUT = resolve(ROOT, 'deploy', WIX_MODE ? 'wix' : 'pauloventura.org')
const MV_SRC = resolve(ROOT, '..', 'Mind-and-Venture')

const MV_SKIP = new Set([
  'node_modules',
  '.git',
  '.cursor',
  'test-results',
  '.deploy-msg.txt',
  'package-lock.json',
  'C#',
  '.vs',
  'DEPLOY.bat',
  'PLAY.bat',
  'TEST.bat',
  'AUTO-TEST.bat',
  'WATCH-TEST.bat',
  'AGENT-LOOP.txt',
  'docs',
  'tileset',
  'scripts',
  '.github',
  'test-run.html',
  'package.json',
  'sync-awdjoo-map.ps1',
  'desktop.ini'
])

function run(cmd, args, env = {}) {
  const r = spawnSync(cmd, args, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, ...env }
  })
  if (r.status !== 0) process.exit(r.status ?? 1)
}

function hubHtml() {
  const mymvp = WIX_MODE ? 'https://mymvp.pauloventura.org/' : '/mymvp/'
  const mv = WIX_MODE ? 'https://mindandventure.pauloventura.org/' : '/mindandventure/'
  const delphi = WIX_MODE ? 'https://delphi.pauloventura.org/' : '/delphi/'

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Paulo Ventura — projects</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui, -apple-system, Segoe UI, sans-serif;
      background: #0a0a12;
      color: #e8e8f0;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 2rem;
    }
    h1 { font-size: 1.75rem; font-weight: 600; margin-bottom: 0.5rem; }
    p { color: #9a9ab0; margin-bottom: 2rem; text-align: center; max-width: 32rem; }
    nav { display: flex; flex-direction: column; gap: 0.75rem; width: 100%; max-width: 20rem; }
    a {
      display: block;
      padding: 1rem 1.25rem;
      background: #16162a;
      border: 1px solid #2a2a44;
      border-radius: 10px;
      color: #c8c8ff;
      text-decoration: none;
      font-weight: 500;
    }
    a span { display: block; font-size: 0.8rem; color: #7a7a98; font-weight: 400; margin-top: 0.25rem; }
  </style>
</head>
<body>
  <h1>Paulo Ventura</h1>
  <p>Project links (optional — add these on your Wix site as external links).</p>
  <nav>
    <a href="${mymvp}">myMVP<span>Enthusiastic assistant — web scouts, no API keys</span></a>
    <a href="${mv}">Mind &amp; Venture<span>2D platformer — play in your browser</span></a>
    <a href="${delphi}">Delphi<span>Coming soon</span></a>
  </nav>
</body>
</html>
`
}

function delphiPlaceholderHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Delphi — Paulo Ventura</title>
  <style>
    body {
      font-family: system-ui, sans-serif;
      background: #0a0a12;
      color: #e8e8f0;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 2rem;
    }
    a { color: #8a8aff; }
  </style>
</head>
<body>
  <h1>Delphi</h1>
  <p>Placeholder — add your Delphi project when ready.</p>
  <p><a href="https://pauloventura.org">← Back to pauloventura.org</a></p>
</body>
</html>
`
}

function copyMindAndVenture(dest, { subdomainRoot }) {
  if (!existsSync(MV_SRC)) {
    console.warn(`[warn] Mind-and-Venture not found at ${MV_SRC}`)
    mkdirSync(dest, { recursive: true })
    writeFileSync(
      join(dest, 'index.html'),
      `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:2rem">
<h1>Mind &amp; Venture</h1>
<p>Clone <code>Mind-and-Venture</code> next to <code>myMVP</code> and rebuild.</p></body></html>`
    )
    return
  }

  rmSync(dest, { recursive: true, force: true })
  mkdirSync(dest, { recursive: true })

  for (const name of readdirSafe(MV_SRC)) {
    if (MV_SKIP.has(name)) continue
    cpSync(join(MV_SRC, name), join(dest, name), { recursive: true })
  }

  if (!subdomainRoot) {
    const indexPath = join(dest, 'index.html')
    let html = readFileSync(indexPath, 'utf8')
    if (!html.includes('<base ')) {
      html = html.replace(/<head>/i, '<head>\n<base href="/mindandventure/">')
    }
    writeFileSync(indexPath, html)
  }

  console.log(`[ok] Mind & Venture → ${dest}`)
}

function readdirSafe(dir) {
  try {
    return readdirSync(dir)
  } catch {
    return []
  }
}

const mymvpBase = WIX_MODE ? '/' : '/mymvp/'

console.log(WIX_MODE ? '=== Wix-friendly build (subdomains) ===\n' : '=== Building pauloventura.org site ===\n')

rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })

console.log(`[1/3] Building myMVP (base: ${mymvpBase})...`)
run('node', [join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js'), 'build', '--config', 'vite.web.config.ts'], {
  MYMVP_BASE: mymvpBase
})

const mymvpDest = WIX_MODE ? join(OUT, 'mymvp') : join(OUT, 'mymvp')
rmSync(mymvpDest, { recursive: true, force: true })
cpSync(resolve(ROOT, 'dist', 'web'), mymvpDest, { recursive: true })
if (WIX_MODE) {
  writeFileSync(join(mymvpDest, 'CNAME'), 'mymvp.pauloventura.org\n')
}
console.log()

console.log('[2/3] Mind & Venture...')
const mvDest = join(OUT, WIX_MODE ? 'mindandventure' : 'mindandventure')
copyMindAndVenture(mvDest, { subdomainRoot: WIX_MODE })
if (WIX_MODE) {
  writeFileSync(join(mvDest, 'CNAME'), 'mindandventure.pauloventura.org\n')
}
console.log()

console.log('[3/3] Delphi placeholder...')
const delphiDest = join(OUT, 'delphi')
mkdirSync(delphiDest, { recursive: true })
writeFileSync(join(delphiDest, 'index.html'), delphiPlaceholderHtml())
if (WIX_MODE) {
  writeFileSync(join(delphiDest, 'CNAME'), 'delphi.pauloventura.org\n')
}

if (!WIX_MODE) {
  console.log('\n[4/4] Hub page + apex CNAME...')
  writeFileSync(join(OUT, 'index.html'), hubHtml())
  writeFileSync(join(OUT, 'CNAME'), 'pauloventura.org\n')
  console.log('\nLive URLs (replaces root — not for Wix):')
  console.log('  https://pauloventura.org/')
  console.log('  https://pauloventura.org/mymvp/')
  console.log('  https://pauloventura.org/mindandventure/')
  console.log('  https://pauloventura.org/delphi/')
} else {
  writeFileSync(join(OUT, 'LINKS.html'), hubHtml())
  console.log('\nWix homepage stays at https://pauloventura.org — unchanged.')
  console.log('Upload each subfolder to static hosting, then add DNS in Wix:')
  console.log('  mymvp.pauloventura.org          → deploy/wix/mymvp/')
  console.log('  mindandventure.pauloventura.org → deploy/wix/mindandventure/')
  console.log('  delphi.pauloventura.org         → deploy/wix/delphi/')
  console.log('\nOptional: open deploy/wix/LINKS.html for copy-paste URLs on your Wix site.')
}

console.log(`\n=== Done ===\nOutput: ${OUT}`)
