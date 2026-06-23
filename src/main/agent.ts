import type { AppSettings, AgentStep, ChatMessage } from '../shared/types'
import { configuredProviders } from './providers'
import type { CompletionRequest } from './providers/types'
import { runTool, toolSpecs, type ToolContext } from './tools'

const AGENT_PERSONA = `You are myMVP — an enthusiastic, hyper-capable autonomous assistant with "I GOT YOU" energy. You complete tasks on the user's machine using the tools available to you.

Rules:
- Take action. Use tools to inspect, create, run, and verify. Don't just describe what you'd do — do it.
- Work in small steps: call a tool, read the result, decide the next move.
- Be careful with destructive actions; verify paths before overwriting or deleting.
- When the task is done, give a short, upbeat summary of what you accomplished.`

const MAX_STEPS = 12

/**
 * The agent loop: a tool-capable provider plans and executes steps until done.
 * Calls onStep for each thought / tool call / result so the UI can stream them.
 */
export async function runAgent(
  settings: AppSettings,
  history: ChatMessage[],
  onStep: (step: AgentStep) => void
): Promise<void> {
  // Use the first tool-capable scout as myMVP's hands for agent mode.
  const candidates = configuredProviders(settings).filter(
    (p) => !!p.completeWithTools
  )

  const agentProvider = candidates[0]

  if (!agentProvider || !agentProvider.completeWithTools) {
    onStep({
      kind: 'error',
      content:
        'Agent mode needs a scout with hands. Add an OpenAI key in Settings (GPT scout handles tool-calling) and we\'re good to go.'
    })
    return
  }

  const ctx: ToolContext = { workspaceDir: settings.workspaceDir }
  const messages: ChatMessage[] = [
    { role: 'system', content: `${AGENT_PERSONA}\n\nWorking directory: ${ctx.workspaceDir}` },
    ...history
  ]

  for (let step = 0; step < MAX_STEPS; step++) {
    const req: CompletionRequest = { messages, tools: toolSpecs, temperature: 0.3 }

    let result
    try {
      result = await agentProvider.completeWithTools(req)
    } catch (err) {
      onStep({ kind: 'error', content: err instanceof Error ? err.message : String(err) })
      return
    }

    if (result.content.trim()) {
      onStep({ kind: 'thought', content: result.content.trim() })
    }

    if (result.toolCalls.length === 0) {
      onStep({ kind: 'final', content: result.content.trim() || 'Done.' })
      return
    }

    // Record the assistant's tool-call turn so the model keeps context.
    messages.push({
      role: 'assistant',
      content: result.content || `[calling ${result.toolCalls.map((t) => t.name).join(', ')}]`
    })

    for (const call of result.toolCalls) {
      onStep({ kind: 'tool_call', tool: call.name, args: call.args, content: '' })
      let output: string
      try {
        output = await runTool(ctx, call.name, call.args)
      } catch (err) {
        output = `Tool error: ${err instanceof Error ? err.message : String(err)}`
      }
      onStep({ kind: 'tool_result', tool: call.name, content: output })
      messages.push({
        role: 'user',
        content: `[tool: ${call.name}] result:\n${output}`
      })
    }
  }

  onStep({
    kind: 'final',
    content: "I hit my step limit on that one — but I made progress. Tell me to keep going and I'll pick right back up."
  })
}
