#!/usr/bin/env node
/**
 * Push deploy/wix/* to GitHub Pages (gh-pages branch) and enable custom subdomains.
 * Requires: gh CLI authenticated as paulooventura.
 */
import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const WIX = resolve(ROOT, 'deploy', 'wix')
const OWNER = 'paulooventura'

const SITES = [
  { name: 'myMVP', folder: 'mymvp', cname: 'mymvp.pauloventura.org', create: true },
  {
    name: 'Mind-and-Venture',
    folder: 'mindandventure',
    cname: 'mindandventure.pauloventura.org',
    create: false
  },
  { name: 'DELPHI', folder: 'delphi', cname: 'delphi.pauloventura.org', create: false }
]

function gh(...args) {
  const r = spawnSync('gh', args, { encoding: 'utf8', shell: false })
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout)
    throw new Error(`gh ${args.join(' ')} failed`)
  }
  return (r.stdout || '').trim()
}

function git(cwd, ...args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', shell: false })
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout)
    throw new Error(`git ${args.join(' ')} failed`)
  }
  return (r.stdout || '').trim()
}

function repoExists(name) {
  const r = spawnSync('gh', ['repo', 'view', `${OWNER}/${name}`], { encoding: 'utf8', shell: false })
  return r.status === 0
}

function pushGhPages(repo, srcDir) {
  const tmp = mkdtempSync(join(tmpdir(), 'gh-pages-'))
  try {
    git(tmp, 'init')
    git(tmp, 'checkout', '-b', 'gh-pages')
    cpSync(srcDir, tmp, { recursive: true })
    git(tmp, 'add', '-A')
    git(tmp, 'commit', '-m', 'Deploy static site for pauloventura.org subdomain')
    git(tmp, 'branch', '-M', 'gh-pages')
    git(tmp, 'remote', 'add', 'origin', `https://github.com/${OWNER}/${repo}.git`)
    git(tmp, 'push', '-f', 'origin', 'gh-pages')
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
}

function enablePages(repo, cname) {
  const payload = {
    build_type: 'legacy',
    source: { branch: 'gh-pages', path: '/' },
    cname
  }
  const r = spawnSync(
    'gh',
    ['api', '-X', 'POST', `repos/${OWNER}/${repo}/pages`, '--input', '-'],
    {
      input: JSON.stringify(payload),
      encoding: 'utf8',
      shell: false
    }
  )
  if (r.status !== 0) {
    spawnSync(
      'gh',
      ['api', '-X', 'PUT', `repos/${OWNER}/${repo}/pages`, '--input', '-'],
      {
        input: JSON.stringify(payload),
        encoding: 'utf8',
        shell: false
      }
    )
  }
}

function pagesUrl(repo) {
  try {
    const j = JSON.parse(gh('api', `repos/${OWNER}/${repo}/pages`))
    return j.html_url || j.url
  } catch {
    return `https://${OWNER}.github.io/${repo}/`
  }
}

console.log('=== GitHub Pages deploy (Wix subdomains) ===\n')

if (!existsSync(WIX)) {
  console.log('Running build first...')
  spawnSync('node', [join(ROOT, 'scripts', 'build-pauloventura-site.mjs'), '--wix'], {
    cwd: ROOT,
    stdio: 'inherit',
    shell: false
  })
}

const results = []

for (const site of SITES) {
  const src = join(WIX, site.folder)
  if (!existsSync(src)) throw new Error(`Missing ${src} — run build:site:wix first`)

  console.log(`\n--- ${site.name} (${site.cname}) ---`)

  if (site.create && !repoExists(site.name)) {
    console.log(`Creating repo ${OWNER}/${site.name}...`)
    gh('repo', 'create', `${OWNER}/${site.name}`, '--public', '--description', 'myMVP web app')
  } else if (!repoExists(site.name)) {
    throw new Error(`Repo ${OWNER}/${site.name} not found`)
  }

  console.log('Pushing gh-pages branch...')
  pushGhPages(site.name, src)

  console.log('Enabling GitHub Pages + custom domain...')
  enablePages(site.name, site.cname)

  const url = pagesUrl(site.name)
  results.push({ ...site, url })
  console.log(`[ok] ${site.cname} → GitHub Pages configured`)
}

const dnsPath = join(WIX, 'WIX-DNS-RECORDS.txt')
const dns = `Add these CNAME records in Wix (Domains → pauloventura.org → Manage DNS Records).
Your Wix homepage is NOT changed — only new subdomains.

Host name          Points to
mymvp              paulooventura.github.io
mindandventure     paulooventura.github.io
delphi             paulooventura.github.io

After DNS propagates (5–60 min), these URLs go live:
  https://mymvp.pauloventura.org/
  https://mindandventure.pauloventura.org/
  https://delphi.pauloventura.org/

GitHub Pages (works immediately while DNS propagates):
  ${results.map((r) => `  ${r.name}: ${r.url}`).join('\n  ')}

On your Wix site: add external links to the subdomain URLs above.
`
writeFileSync(dnsPath, dns)

console.log('\n=== Deploy complete ===')
console.log(dns)
console.log(`Saved: ${dnsPath}`)
