import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { setLawyerMode } from '../src/client/product-policy.ts'
import { safeMediaSrc } from '../src/client/genui-runtime/value-utils.ts'
import { saveBlockState, loadBlockState } from '../src/client/interaction-store.ts'
import { applyPanelOperation, clearSessionPanel, getPanelSpec } from '../src/client/panel-store.ts'
import { recordFence, recordPanel, recordInteraction } from '../src/client/achievement-store.ts'
import { GenuiPanel } from '../src/client/panel.tsx'
import { GenuiBlock } from '../src/client/GenuiBlock.tsx'
import { GenuiActionContext } from '../src/client/action-context.ts'
import { mountActionFeedback, sendLawyerAction, ACTION_MESSAGES } from '../src/lawyer/action-feedback.ts'
import { constrainLawyerMedia } from '../src/lawyer/media-policy.ts'
import type { GenuiSpec } from '../src/client/spec.ts'

const spec: GenuiSpec = { title: '材料分析', items: [{ type: 'text', content: '敏感案情' }] }
afterEach(() => {
  cleanup(); clearSessionPanel('legal-test'); setLawyerMode(false)
  localStorage.clear(); vi.restoreAllMocks(); vi.useRealTimers()
})

describe('LawyerDesk policy is opt-in', () => {
  it('keeps upstream persistence and external media unchanged', () => {
    setLawyerMode(false)
    saveBlockState('s', { fields: { detail: 'saved' } })
    expect(loadBlockState('s')?.fields?.detail).toBe('saved')
    expect(safeMediaSrc('https://external.example/image.png')).toContain('external.example')
    expect(constrainLawyerMedia(spec)).toBe(spec)
  })
  it('neither reads nor writes sensitive browser storage in legal mode', () => {
    saveBlockState('s', { fields: { detail: 'old-data' } })
    setLawyerMode(true)
    const get = vi.spyOn(Storage.prototype, 'getItem')
    const set = vi.spyOn(Storage.prototype, 'setItem')
    saveBlockState('s', { fields: { detail: 'new-data' } })
    expect(loadBlockState('s')).toBeNull()
    applyPanelOperation('legal-test', { sourceId: 'one', order: [1, 0, 0], mode: 'replace', spec })
    expect(getPanelSpec('legal-test')).toEqual(spec)
    recordFence(spec); recordPanel(); recordInteraction()
    clearSessionPanel('legal-test')
    expect(getPanelSpec('legal-test')).toBeNull()
    expect(get).not.toHaveBeenCalled(); expect(set).not.toHaveBeenCalled()
  })
  it('removes templates, achievements and onboarding from the legal dock', () => {
    setLawyerMode(true)
    applyPanelOperation('legal-test', { sourceId: 'one', order: [1, 0, 0], mode: 'replace', spec })
    const { container } = render(<GenuiPanel {...{ sessionId: 'legal-test', sendGenuiAction: vi.fn(), insertTemplate: vi.fn() } as never} />)
    expect(container.querySelector('[data-genui-panel]')).not.toBeNull()
    expect(screen.queryByRole('button', { name: '模板中心' })).toBeNull()
    expect(screen.queryByRole('button', { name: '探索成就' })).toBeNull()
    expect(container.textContent).not.toContain('点右上角')
  })
  it('blocks external, protocol-relative, data and backslash media, allowing same origin', () => {
    setLawyerMode(true)
    for (const value of ['https://outside.example/a', '//outside.example/a', '/\\outside.example/a', 'data:image/png;base64,AA', 'javascript:alert(1)', 'https://user:pass@localhost:3000/a']) {
      expect(safeMediaSrc(value)).toBeUndefined()
    }
    expect(safeMediaSrc('/approved/media.png')).toBe('/approved/media.png')
    expect(safeMediaSrc(`${location.origin}/approved/media.png`)).toBe('/approved/media.png')
  })
  it('blocks media and chart image sources at the final render boundary too', () => {
    setLawyerMode(true)
    const input = { items: [{ type: 'image', src: 'https://outside.example/a' }, { type: 'echart', option: { series: [{ symbol: 'image://https://outside.example/a' }], graphic: { style: { image: 'https://outside.example/a' } } } }] } as GenuiSpec
    expect(JSON.stringify(constrainLawyerMedia(input))).not.toContain('outside.example')
    const { container } = render(<GenuiBlock spec={input} />)
    expect(container.querySelector('img[src*="outside"]')).toBeNull()
    expect(container.textContent).toContain('仅允许受管同源资源')
  })
  it('declines Mermaid image nodes before layout can load their sources', () => {
    setLawyerMode(true)
    const input: GenuiSpec = { items: [{ type: 'mermaid', code: 'flowchart LR\nA@{ img: "https://outside.example/a" }' }] }
    const output = constrainLawyerMedia(input)
    expect(JSON.stringify(output)).not.toContain('outside.example')
    expect(JSON.stringify(output)).toContain('未自动加载')
  })
  it('keeps actual button callbacks while distinguishing trigger from success', async () => {
    setLawyerMode(true); vi.useFakeTimers()
    const action = vi.fn()
    render(<GenuiActionContext.Provider value={action}><GenuiBlock spec={{ items: [{ type: 'button', label: '分析材料', action: 'analyze' }] }} /></GenuiActionContext.Provider>)
    fireEvent.click(screen.getByRole('button', { name: '分析材料' }))
    expect(screen.getByText('请求待处理')).toBeDefined()
    await act(async () => { vi.advanceTimersByTime(350) })
    expect(action).toHaveBeenCalledWith('analyze', expect.any(Object))
  })
})

describe('legal action transport feedback', () => {
  it('reports accepted transport without claiming business success', async () => {
    const dispose = mountActionFeedback()
    try {
      const send = vi.fn().mockResolvedValue(undefined)
      expect(await sendLawyerAction(send, 'save', { detail: '案情' })).toBe('sent')
      expect(screen.getByRole('status').textContent).toBe(ACTION_MESSAGES.sent)
      expect(send.mock.calls[0][0]).toContain('真实工具确认')
    } finally { dispose() }
  })
  it('visibly reports unavailable service, rejection and synchronous failure without leaking fields', async () => {
    const dispose = mountActionFeedback()
    try {
      for (const send of [undefined, vi.fn().mockRejectedValue(new Error('secret')), () => { throw new Error('secret') }]) {
        expect(await sendLawyerAction(send, 'save', { detail: 'secret' })).toBe('failed')
        expect(screen.getByRole('alert').textContent).toBe(ACTION_MESSAGES.failed)
        expect(document.body.textContent).not.toContain('secret')
      }
    } finally { dispose() }
  })
})
