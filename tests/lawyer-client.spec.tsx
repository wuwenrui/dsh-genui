import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import { apply, lawyerPanelInjection } from '../src/lawyer/client.tsx'
import { setLawyerMode } from '../src/client/product-policy.ts'
import { clearSessionPanel } from '../src/client/panel-store.ts'

let dispose: (() => void) | undefined
afterEach(() => { dispose?.(); dispose = undefined; cleanup(); clearSessionPanel('legal'); document.body.innerHTML = ''; setLawyerMode(false); localStorage.clear() })
function host(send = vi.fn().mockResolvedValue(undefined)) {
  const views = new Map<string, any>()
  const ctx = {
    sessions: { list: { getSnapshot: () => ({ current: 'legal' }) }, scope: () => ({ get: () => ({ send }) }) },
    slots: { inject: (_: unknown, fn: () => any) => fn(), register: (slot: { name: string }, view: unknown) => { views.set(slot.name, view); return () => views.delete(slot.name) } },
  } as unknown as Context
  return { ctx, views, send }
}
function fence(raw: string) {
  const row = document.createElement('div')
  row.dataset.chatAnchorKey = 'legal-message'
  row.dataset.chatFlowKind = 'assistant-step'
  row.dataset.streaming = ''
  const block = document.createElement('div'); block.className = 'md-code-block'
  const label = document.createElement('div'); label.textContent = 'dsh-ui'
  const banner = document.createElement('div'); banner.append(label)
  const pre = document.createElement('pre'); const code = document.createElement('code'); code.textContent = raw; pre.append(code)
  block.append(banner, pre); row.append(block); document.body.append(row)
  return { row, code }
}

describe('legal browser entry uses the existing renderer', () => {
  it('streams finished components and sends a real inline action', async () => {
    setLawyerMode(true)
    const { ctx, send } = host(); dispose = apply(ctx)
    const { code } = fence('{"items":[{"type":"text","content":"法律分析"},')
    await waitFor(() => expect(document.querySelector('[data-genui]')?.textContent).toContain('法律分析'))
    code.textContent = '{"items":[{"type":"text","content":"法律分析"},{"type":"button","label":"继续分析","action":"next"}]}'
    await waitFor(() => expect(screen.getByRole('button', { name: '继续分析' })).toBeDefined())
    fireEvent.click(screen.getByRole('button', { name: '继续分析' }))
    await waitFor(() => expect(send).toHaveBeenCalledTimes(1))
    expect(send.mock.calls[0][0]).toContain('[genui-action]')
    expect(document.querySelector('[data-genui-achievement-toasts]')).toBeNull()
    expect(localStorage.length).toBe(0)
  })
  it('wires tool-card buttons instead of presenting an inert card', async () => {
    setLawyerMode(true)
    const { ctx, views, send } = host(); dispose = apply(ctx)
    const View = views.get('tool.call.toolview')
    render(<View toolName="render_ui" sessionId="legal" block={{ callId: 'call-1', seq: 1, meta: { items: [{ type: 'button', label: '分析引用', action: 'analyze' }] } }} />)
    fireEvent.click(screen.getByRole('button', { name: '分析引用' }))
    await waitFor(() => expect(send).toHaveBeenCalledTimes(1))
  })
  it('resolves missing conversation at click time and reports the failure', async () => {
    setLawyerMode(true)
    const { ctx } = host(); dispose = apply(ctx)
    ctx.sessions.scope = (() => ({ get: () => undefined })) as never
    lawyerPanelInjection(ctx, 'legal' as never).sendGenuiAction('save', {})
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('请求发送失败'))
  })
})
