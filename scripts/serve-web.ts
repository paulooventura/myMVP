/**
 * Static web app + digest API — for public tunnel links.
 */
import { createServer } from 'node:http'
import { readFileSync, existsSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { handleDigest } from '../src/main/web/digest-http.ts'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist', 'web')
const port = Number(process.env.PORT ?? 3456)

const mime: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml'
}

function readBody(req: import('node:http').IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

createServer(async (req, res) => {
  const url = req.url?.split('?')[0] ?? '/'

  if (url === '/.netlify/functions/digest') {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      })
      return res.end()
    }
    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ error: 'POST only' }))
    }
    try {
      const body = JSON.parse(await readBody(req)) as { question?: string }
      const result = await handleDigest(body.question ?? '')
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(result))
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }))
    }
    return
  }

  const path = url === '/' ? '/index.html' : url
  const file = join(dist, path)

  if (!existsSync(file) || statSync(file).isDirectory()) {
    const fallback = join(dist, 'index.html')
    if (existsSync(fallback)) {
      res.writeHead(200, { 'Content-Type': 'text/html' })
      return res.end(readFileSync(fallback))
    }
    res.writeHead(404)
    return res.end('Not found')
  }

  const ext = extname(file)
  res.writeHead(200, { 'Content-Type': mime[ext] ?? 'application/octet-stream' })
  res.end(readFileSync(file))
}).listen(port, () => {
  console.log(`myMVP web http://localhost:${port}`)
})
