import { exec } from 'child_process'
import { promises as fs } from 'fs'
import { resolve, join } from 'path'
import type { ToolSpec } from '../providers/types'

export interface ToolContext {
  workspaceDir: string
}

export const toolSpecs: ToolSpec[] = [
  {
    name: 'run_command',
    description:
      'Run a shell command on the user\'s machine and return its stdout/stderr. Use for git, npm, file system queries, installs, scripts, etc.',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'The shell command to execute.' }
      },
      required: ['command']
    }
  },
  {
    name: 'read_file',
    description: 'Read a UTF-8 text file and return its contents.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path (absolute or relative to workspace).' }
      },
      required: ['path']
    }
  },
  {
    name: 'write_file',
    description: 'Create or overwrite a UTF-8 text file with the given content.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path (absolute or relative to workspace).' },
        content: { type: 'string', description: 'Full file content to write.' }
      },
      required: ['path', 'content']
    }
  },
  {
    name: 'list_dir',
    description: 'List the entries (files and folders) in a directory.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Directory path (absolute or relative to workspace). Defaults to workspace root.' }
      }
    }
  }
]

function resolvePath(ctx: ToolContext, p?: string): string {
  if (!p || p === '.' || p === './') return ctx.workspaceDir
  return resolve(ctx.workspaceDir, p)
}

export async function runTool(
  ctx: ToolContext,
  name: string,
  args: Record<string, unknown>
): Promise<string> {
  switch (name) {
    case 'run_command':
      return runCommand(String(args.command ?? ''), ctx.workspaceDir)
    case 'read_file': {
      const path = resolvePath(ctx, args.path as string)
      const content = await fs.readFile(path, 'utf-8')
      return content.length > 20000 ? content.slice(0, 20000) + '\n…[truncated]' : content
    }
    case 'write_file': {
      const path = resolvePath(ctx, args.path as string)
      await fs.writeFile(path, String(args.content ?? ''), 'utf-8')
      return `Wrote ${path}`
    }
    case 'list_dir': {
      const path = resolvePath(ctx, args.path as string)
      const entries = await fs.readdir(path, { withFileTypes: true })
      return entries
        .map((e) => (e.isDirectory() ? `${e.name}/` : e.name))
        .join('\n')
    }
    default:
      return `Unknown tool: ${name}`
  }
}

function runCommand(command: string, cwd: string): Promise<string> {
  return new Promise((resolve) => {
    if (!command.trim()) return resolve('No command provided.')
    exec(
      command,
      { cwd, timeout: 120_000, maxBuffer: 10 * 1024 * 1024, windowsHide: true },
      (error, stdout, stderr) => {
        const out = [stdout, stderr].filter(Boolean).join('\n').trim()
        if (error && !out) return resolve(`Error: ${error.message}`)
        resolve(out || '(no output)')
      }
    )
  })
}

export { join }
