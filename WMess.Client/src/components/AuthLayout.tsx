import type { ReactNode } from 'react'

// Shared field styles so login and register stay visually identical and match
// the workspace modals (same input/button look).
export const authField =
  'w-full h-[42px] px-3 rounded-[10px] border border-line bg-panel text-sm text-ink placeholder:text-faint font-ui focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/20'
export const authPrimaryBtn =
  'w-full h-[42px] rounded-[10px] bg-accent text-white font-semibold text-sm cursor-pointer hover:bg-accent-deep font-ui mt-1'
export const authError =
  'text-[13px] text-danger bg-danger/10 border border-danger/25 rounded-[9px] px-3 py-2.5'
export const authLink = 'text-accent font-semibold hover:text-accent-deep'

interface AuthLayoutProps {
  title: string
  subtitle: string
  children: ReactNode
  footer: ReactNode
}

export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-app font-ui text-ink p-4">
      <div className="w-[400px] max-w-full bg-white border border-line rounded-2xl shadow-[0_24px_60px_rgba(43,42,38,.12)] p-8 animate-[wmPop_.14s_ease]">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="text-accent font-extrabold text-[52px] leading-none tracking-[-1px] mb-3">
            W
          </div>
          <h1 className="font-ui text-[22px] font-extrabold tracking-[-.4px] text-ink m-0">
            {title}
          </h1>
          <p className="text-[13px] text-faint mt-1.5">{subtitle}</p>
        </div>
        {children}
        <div className="text-center text-[13px] text-faint mt-5">{footer}</div>
      </div>
    </div>
  )
}
