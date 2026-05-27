interface QuizCompleteProps {
  formTitle: string
}

export function QuizComplete({ formTitle }: QuizCompleteProps) {
  return (
    <div className="w-full flex flex-col items-center text-center gap-6 animate-in fade-in zoom-in-95 duration-500">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-500/10 text-5xl">
        ✅
      </div>
      <div>
        <h2 className="text-2xl font-extrabold text-foreground">Informações enviadas!</h2>
        <p className="mt-3 text-base text-muted-foreground max-w-sm">
          Recebemos seus dados com sucesso. Em breve nossa equipe entrará em contato com você.
        </p>
      </div>
      <div className="rounded-2xl border border-border bg-card px-6 py-4 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{formTitle}</span>
        <br />
        Obrigado por responder!
      </div>
    </div>
  )
}
