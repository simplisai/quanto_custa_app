import { type ReactNode } from 'react'

interface QuizShellProps {
  step: number
  total: number
  children: ReactNode
  themeColor?: string
}

export function QuizShell({ step, total, children, themeColor = '#6366f1' }: QuizShellProps) {
  const progress = total > 0 ? ((step + 1) / total) * 100 : 0

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Progress bar */}
      {total > 0 && (
        <div className="fixed top-0 left-0 right-0 z-50">
          <div className="h-1 w-full bg-border">
            <div
              className="h-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%`, backgroundColor: themeColor }}
            />
          </div>
        </div>
      )}

      {/* Step counter */}
      {total > 0 && (
        <div className="fixed top-2 right-4 z-50 text-xs text-muted-foreground font-medium tabular-nums">
          {step + 1} / {total}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-5 py-16 max-w-lg mx-auto w-full">
        {children}
      </div>
    </div>
  )
}
