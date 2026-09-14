import type { Context } from '@deepseek-ai/cordis'
import type { SkillProvider } from '@deepseek-ai/dsh-skill'
import { readFileSync } from 'node:fs'
import { basename, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { serveGenuiAsset } from '../plugin/index.ts'
import { createRenderUiTool, createValidateDshUiTool } from '../plugin/tool.ts'
import { LAWYER_GENUI_PROMPT, LAWYER_RENDER_DESCRIPTION } from './prompt.ts'

export const name = '@changfenhuang/dsh-genui'
export const inject = ['systemPrompt']

/** Clone the tool schema: never mutate the upstream shared parameter object. */
export function createLawyerRenderTool() {
  const tool = createRenderUiTool()
  const parameters = structuredClone(tool.parameters) as { properties: { spec: { description: string } } }
  parameters.properties.spec.description = LAWYER_RENDER_DESCRIPTION
  return { ...tool, description: LAWYER_RENDER_DESCRIPTION, parameters }
}

export function lawyerSkillProvider(): SkillProvider {
  const dir = dirname(fileURLToPath(new URL(import.meta.url)))
  const path = resolve(dir, basename(dir) === 'lawyer' ? '../../LAWYER_SKILL.md' : '../LAWYER_SKILL.md')
  const base = {
    name: 'genui', description: 'LawyerDesk 按需法律结果展示与交互规范。',
    invocation: { modelInvocable: true, userInvocable: true }, source: 'bundled' as const,
    provider: 'lawyer-genui', path, resourceBase: { kind: 'directory' as const, path: dirname(path) },
  }
  return {
    name: 'lawyer-genui',
    list: async () => [{ ...base, rank: 600, locator: path }],
    get: async () => ({ ...base, content: readFileSync(path, 'utf8') }),
  }
}

export function apply(ctx: Context): void {
  ctx.systemPrompt.section({ name: 'genui:fence', order: ctx.systemPrompt.getSectionOrder('STRUCTURED_OUTPUT'), text: LAWYER_GENUI_PROMPT })
  ctx.inject(['tools'], scope => {
    scope.effect(function* () {
      yield scope.tools.register(createLawyerRenderTool())
      yield scope.tools.register(createValidateDshUiTool())
    }, 'lawyer-genui: tools')
  })
  ctx.inject(['skills'], scope => { scope.skills.registerProvider(() => lawyerSkillProvider()) })
  ctx.inject(['webServer'], scope => {
    const server = scope.reflect.get('webServer') as { register(route: unknown): () => void }
    scope.effect(() => server.register({ kind: 'prefix', path: '/plugins/@changfenhuang/dsh-genui/assets', handler: serveGenuiAsset }), 'lawyer-genui: local assets')
  })
}
