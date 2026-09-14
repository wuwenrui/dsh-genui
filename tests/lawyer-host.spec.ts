import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import * as Lawyer from '../src/lawyer/index.ts'
import { createRenderUiTool } from '../src/plugin/tool.ts'
import { GENUI_SECTION_TEXT } from '../src/plugin/index.ts'

describe('independent LawyerDesk host entry', () => {
  it('replaces the mandatory UI prompt while preserving upstream instructions', async () => {
    const ctx = new Context()
    await ctx.plugin(SystemPrompt)
    const plugin = await ctx.plugin(Lawyer)
    const assembly = await ctx.systemPrompt.assemble({})
    const text = String(assembly.sections.find(s => s.name === 'genui:fence')?.text)
    expect(text).toContain('不按条数强制出图')
    expect(text).toContain('真实结果确认')
    expect(text).not.toContain('至少出一个围栏')
    expect(GENUI_SECTION_TEXT).toContain('至少出一个围栏')
    await plugin.dispose()
  })
  it('keeps render/validate tool registration and removes both on unload', async () => {
    const ctx = new Context()
    await ctx.plugin(SystemPrompt)
    const tools = new Map<string, unknown>()
    ctx.provide('tools', { register: (tool: { name: string }) => { tools.set(tool.name, tool); return () => tools.delete(tool.name) } })
    const plugin = await ctx.plugin(Lawyer)
    expect([...tools.keys()].sort()).toEqual(['render_ui', 'validate_dsh_ui'])
    await plugin.dispose()
    expect(tools.size).toBe(0)
  })
  it('does not mutate the upstream render schema when changing legal descriptions', () => {
    const genericBefore = JSON.stringify(createRenderUiTool().parameters)
    const legal = Lawyer.createLawyerRenderTool()
    expect(legal.description).toContain('普通回答不必调用')
    expect(JSON.stringify(legal.parameters)).not.toContain('USE THIS whenever')
    expect(JSON.stringify(createRenderUiTool().parameters)).toBe(genericBefore)
  })
  it('ships a product skill without mandatory graphics or durability promises', async () => {
    const skill = Lawyer.lawyerSkillProvider()
    const entries = await skill.list()
    expect(entries[0]?.name).toBe('genui')
    const full = await skill.get('genui' as never)
    expect(full?.content).toContain('不按条数强制出图')
    expect(full?.content).toContain('未发送输入会丢失')
    expect(full?.content).not.toContain('默认就该出 UI')
  })
})
