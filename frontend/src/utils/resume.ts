/** Tempo mínimo fora da app para, ao voltar, os dados serem pedidos outra vez. */
const MIN_AWAY_MS = 60_000

const listeners = new Set<() => void>()
let hiddenSince: number | null = null

// Uma app instalada no telemóvel pode ficar dias aberta em segundo plano. Quando volta ao
// primeiro plano, mostrava os objetivos e o dia de quando foi aberta.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    hiddenSince = Date.now()
    return
  }
  const away = hiddenSince === null ? 0 : Date.now() - hiddenSince
  hiddenSince = null
  if (away >= MIN_AWAY_MS) listeners.forEach((listener) => listener())
})

/** Avisa quando a app volta ao primeiro plano depois de pelo menos um minuto escondida
 * (outra app, outro separador, ecrã desligado). Devolve a função para cancelar. */
export function onResume(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
