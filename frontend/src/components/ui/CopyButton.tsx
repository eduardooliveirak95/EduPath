import { useState } from 'react'
import { Check, Copy } from 'lucide-react'

interface CopyButtonProps {
  text: string
  label: string
  /** Pergunta do `window.prompt`, se o browser não deixar copiar (o texto aparece lá para copiar à mão). */
  promptMessage: string
}

/** Botão que copia um texto e mostra "Copiado" durante 2 segundos. */
export function CopyButton({ text, label, promptMessage }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt(promptMessage, text)
    }
  }

  return (
    <button type="button" className="btn btn--ghost btn--sm" onClick={copy}>
      {copied ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}
      {copied ? 'Copiado' : label}
    </button>
  )
}
