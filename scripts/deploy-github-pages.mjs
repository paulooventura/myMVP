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

const NO_CNAME = process.argv.includes('--no-cname') || process.env.PAGES_NO_CNAME === '1'
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
    // CNAME in repo forces custom domain; only include when Wix DNS is ready.
    if (NO_CNAME) {
      try {
        rmSync(join(tmp, 'CNAME'))
      } catch {
        /* no CNAME */
      }
    }
    writeFileSync(join(tmp, '.nojekyll'), '')
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
  const useCname = !NO_CNAME
  const payload = {
    build_type: 'legacy',
    source: { branch: 'gh-pages', path: '/' },
    ...(useCname ? { cname } : { cname: null })
    // Omit https_enforced until GitHub has issued the cert (avoids 422/404 on first deploy).
  }
  const input = JSON.stringify(payload)
  let r = spawnSync('gh', ['api', '-X', 'POST', `repos/${OWNER}/${repo}/pages`, '--input', '-'], {
    input,
    encoding: 'utf8',
    shell: false
  })
  if (r.status !== 0) {
    r = spawnSync('gh', ['api', '-X', 'PUT', `repos/${OWNER}/${repo}/pages`, '--input', '-'], {
      input,
      encoding: 'utf8',
      shell: false
    })
  }
  if (r.status !== 0) {
    console.warn(`[warn] Pages API for ${repo}: ${(r.stderr || r.stdout || '').trim()}`)
    // CNAME file on gh-pages still registers the domain; retry PUT without https fields.
    if (useCname) {
      spawnSync('gh', ['api', '-X', 'PUT', `repos/${OWNER}/${repo}/pages`, '--input', '-'], {
        input: JSON.stringify({
          build_type: 'legacy',
          source: { branch: 'gh-pages', path: '/' },
          cname
        }),
        encoding: 'utf8',
        shell: false
      })
    }
  }
  spawnSync('gh', ['api', '-X', 'POST', `repos/${OWNER}/${repo}/pages/builds`], {
    encoding: 'utf8',
    shell: false
  })
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

  console.log(NO_CNAME ? 'Enabling GitHub Pages...' : 'Enabling GitHub Pages + custom domain...')
  enablePages(site.name, site.cname)

  const url = NO_CNAME ? `https://${OWNER}.github.io/${site.name}/` : pagesUrl(site.name)
  results.push({ ...site, url })
  console.log(`[ok] ${url}`)
}

const dnsPath = join(WIX, 'WIX-DNS-RECORDS.txt')
const liveUrls = results.map((r) => `  ${r.url}`).join('\n')
const dns = NO_CNAME
  ? `LIVE NOW — add these as external links on your Wix site (homepage unchanged):
${liveUrls}

Optional pretty URLs (after Wix DNS):
  Add CNAME records in Wix → Domains → pauloventura.org → Manage DNS:
    mymvp          → paulooventura.github.io
    mindandventure → paulooventura.github.io
    delphi         → paulooventura.github.io
  Then run: npm run deploy:wix:subdomains
`
  : `Subdomains configured on GitHub Pages:
  https://mymvp.pauloventura.org/
  https://mindandventure.pauloventura.org/
  https://delphi.pauloventura.org/

Ensure Wix DNS CNAME records point to paulooventura.github.io (see above).
`
writeFileSync(dnsPath, dns)

console.log('\n=== Deploy complete ===')
console.log(dns)
console.log(`Saved: ${dnsPath}`)
