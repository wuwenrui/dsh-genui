import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import * as React from 'react'
import * as jsx from 'react/jsx-runtime'
import * as dom from 'react-dom/client'
import * as primitives from '@deepseek-ai/dsh-client-ui-primitives'
const stage = resolve('dist-lawyer/package')
let dispose: (() => void) | undefined
afterEach(() => { dispose?.(); dispose = undefined; cleanup(); document.body.innerHTML = ''; localStorage.clear(); vi.restoreAllMocks() })

// Explicitly run after scripts/package-lawyer.mjs. Ordinary upstream test runs
// without a product build need not create artifacts or trigger build side effects.
describe.skipIf(!existsSync(resolve(stage, 'lib/client.js')))('built LawyerDesk artifact', () => {
  it('declares the exact managed manifest and root composition without dependencies/scripts', () => {
    const manifest = JSON.parse(readFileSync(resolve(stage, 'package.json'), 'utf8'))
    expect(manifest.name).toBe('@changfenhuang/dsh-genui')
    expect(manifest.version).toBe('0.10.0-lawyer.1')
    expect(manifest.exports['./client']).toBe('./lib/client.js')
    expect(manifest.exports['./package.json']).toBe('./package.json')
    expect(manifest.main).toBe('./lib/lawyer.js')
    expect(manifest.dependencies).toBeUndefined()
    expect(manifest.peerDependencies).toBeUndefined()
    expect(manifest.scripts).toBeUndefined()
    expect(readFileSync(resolve(stage, 'cordis.patch.yml'), 'utf8')).toContain('name: "@changfenhuang/dsh-genui"')
  })
  it('executes the shipped Mermaid engine after transparent Rough.js bundling', async () => {
    const original = Object.getOwnPropertyDescriptor(SVGElement.prototype, 'getBBox')
    Object.defineProperty(SVGElement.prototype, 'getBBox', { configurable: true, value: () => ({ x: 0, y: 0, width: 100, height: 30 }) })
    try {
      new Function(readFileSync(resolve(stage, 'lib/assets/mermaid.js'), 'utf8'))()
      const engine = (globalThis as any).__GenuiAssets__.mermaid
      const svg = await engine.renderMermaid('flowchart TD\nA[Start] --> B[End]')
      expect(svg).toContain('<svg')
      expect(svg).toContain('Start')
      expect(svg).toContain('End')
    } finally {
      if (original) Object.defineProperty(SVGElement.prototype, 'getBBox', original)
      else delete (SVGElement.prototype as any).getBBox
      delete (globalThis as any).__GenuiAssets__
    }
  })
  it('loads the actual browser factory with legal policy active before store initialization', async () => {
    let plugin: any
    const modules: Record<string, unknown> = { react: React, 'react/jsx-runtime': jsx, 'react-dom/client': dom, '@deepseek-ai/dsh-client-ui-primitives': primitives }
    const reads = vi.spyOn(Storage.prototype, 'getItem')
    const writes = vi.spyOn(Storage.prototype, 'setItem')
    const loader = { load: ({ id, factory }: any) => {
      expect(id).toBe('@changfenhuang/dsh-genui')
      plugin = factory((name: string) => { if (!(name in modules)) throw new Error(`Unexpected browser external: ${name}`); return modules[name] })
    } }
    ;(window as any).__ModuleLoader__ = loader
    new Function('window', readFileSync(resolve(stage, 'lib/client.js'), 'utf8'))(window)
    expect(plugin.inject).toEqual(['slots', 'sessions'])
    const views = new Map<string, any>()
    const send = vi.fn().mockResolvedValue(undefined)
    const ctx = {
      sessions: { list: { getSnapshot: () => ({ current: 'packaged' }) }, scope: () => ({ get: () => ({ send }) }) },
      slots: { inject: (_: unknown, fn: () => any) => fn(), register: (slot: any, view: any) => { views.set(slot.name, view); return () => {} } },
    }
    dispose = plugin.apply(ctx)
    const View = views.get('tool.call.toolview')
    render(<View toolName="render_ui" sessionId="packaged" block={{ callId: 'call-1', seq: 1, meta: { items: [{ type: 'button', label: '请求分析', action: 'analyze' }] } }} />)
    fireEvent.click(screen.getByRole('button', { name: '请求分析' }))
    await waitFor(() => expect(send).toHaveBeenCalledTimes(1))
    expect(document.body.textContent).toContain('不代表业务操作成功')
    expect(reads).not.toHaveBeenCalled(); expect(writes).not.toHaveBeenCalled()
  })
})
