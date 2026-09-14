/** Transport feedback is deliberately distinct from a completed business operation. */
export type ActionStatus = 'sending' | 'sent' | 'failed'
export const ACTION_MESSAGES: Record<ActionStatus, string> = {
  sending: '正在发送请求；尚未执行完成。',
  sent: '请求已发送给助手；不代表业务操作成功，请查看助手的处理结果。',
  failed: '请求发送失败，未确认执行；请检查当前会话后重试。',
}
let notice: HTMLElement | undefined
let generation = 0
export function mountActionFeedback(): () => void {
  const element = document.createElement('div')
  element.dataset.lawyerGenuiFeedback = ''
  element.setAttribute('role', 'status')
  element.setAttribute('aria-live', 'polite')
  Object.assign(element.style, { position: 'fixed', bottom: '16px', right: '16px', maxWidth: '420px', padding: '12px', zIndex: '10000', background: 'var(--dsw-alias-bg-base)', color: 'var(--dsw-alias-text-primary)' })
  element.hidden = true
  document.body.appendChild(element)
  notice = element
  return () => { generation++; element.remove(); if (notice === element) notice = undefined }
}
function report(status: ActionStatus): void {
  if (!notice) return
  notice.hidden = false
  notice.setAttribute('role', status === 'failed' ? 'alert' : 'status')
  notice.textContent = ACTION_MESSAGES[status]
}
export async function sendLawyerAction(send: ((text: string) => Promise<unknown>) | undefined, action: string, payload: Record<string, unknown>, panel = false): Promise<ActionStatus> {
  const ticket = ++generation
  report('sending')
  try {
    if (!send) throw new Error('conversation unavailable')
    await send(`[genui-action] ${JSON.stringify(action)}。这是用户请求，不代表业务已执行成功。按现有权限和确认规则处理，仅在真实工具确认后报告成功。${panel ? '按需更新 panel:true 面板。' : '按需更新展示。'}组件数据: ${JSON.stringify(payload)}`)
    if (ticket === generation) report('sent')
    return 'sent'
  } catch {
    // Never log case fields, payloads, or server errors containing user data.
    if (ticket === generation) report('failed')
    return 'failed'
  }
}
