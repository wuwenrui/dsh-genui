/** LawyerDesk surface: upstream renderer, independent composition and action wiring. */
import './enable.ts'
import type { Context } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { IConversation } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { ToolCallViewProps } from '@deepseek-ai/dsh-client-ui-tool/client'
import { GenuiActionContext } from '../client/action-context.ts'
import { installDomFenceRenderer } from '../client/dom-fence.tsx'
import { GenuiPanel, type GenuiPanelInjected } from '../client/panel.tsx'
import { GenuiToolView } from '../client/toolview.tsx'
import { mountActionFeedback, sendLawyerAction } from './action-feedback.ts'

export const inject = ['slots', 'sessions']

export function lawyerPanelInjection(ctx: Context, sessionId: SessionId): GenuiPanelInjected {
  return {
    sessionId,
    sendGenuiAction: (action, payload) => {
      // Resolve at click time: service availability/session attachment may change.
      void sendLawyerAction(async text => {
        const conversation = ctx.sessions.scope(sessionId)?.get('conversation') as IConversation | undefined
        if (!conversation) throw new Error('conversation unavailable')
        return conversation.send(text)
      }, action, payload, true)
    },
    insertTemplate: () => { /* Generic templates are not part of LawyerDesk. */ },
  }
}

export function apply(ctx: Context): () => void {
  const disposers: Array<() => void> = [mountActionFeedback()]
  // Current product has no fence registry. The upstream DOM channel retains
  // streaming support and lets us own transport/error semantics without kernel changes.
  disposers.push(installDomFenceRenderer(ctx, (sessionId, action, payload) => {
    void sendLawyerAction(async text => {
      const conversation = ctx.sessions.scope(sessionId)?.get('conversation') as IConversation | undefined
      if (!conversation) throw new Error('conversation unavailable')
      return conversation.send(text)
    }, action, payload)
  }))
  const LawyerToolView = (props: ToolCallViewProps) => (
    <GenuiActionContext.Provider value={lawyerPanelInjection(ctx, props.sessionId).sendGenuiAction}>
      <GenuiToolView {...props} />
    </GenuiActionContext.Provider>
  )
  disposers.push(ctx.slots.inject('tool.call.toolview', () => ctx.slots.register({
    name: 'tool.call.toolview', key: 'render_ui',
  }, LawyerToolView)))
  disposers.push(ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
    name: 'conversation.input.dock', id: 'lawyer-genui-panel', order: 50,
    inject: (sessionId: SessionId) => lawyerPanelInjection(ctx, sessionId),
  }, GenuiPanel)))
  console.info('[genui] client active; fence-channel=dom; product=lawyerdesk')
  return () => { for (const dispose of disposers.reverse()) dispose() }
}
