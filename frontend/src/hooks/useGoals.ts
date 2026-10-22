import { useEffect, useRef, useState } from 'react'
import { api, errorMessage } from '../api/client'
import type { Goal, GoalChanges, GoalOutcome, NewGoal, PlanStep } from '../types'
import { withPlan } from '../utils/goals'
import { toggleDay } from '../utils/habits'
import { onResume } from '../utils/resume'

type LoadState = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready' }

function byTargetDate(a: Goal, b: Goal): number {
  return a.targetDate.localeCompare(b.targetDate) || a.id - b.id
}

/** Objetivos vindos da API e as ações que os alteram. */
export function useGoals() {
  const [goals, setGoals] = useState<Goal[]>([])
  const [loadState, setLoadState] = useState<LoadState>({ kind: 'loading' })
  const [actionError, setActionError] = useState<string | null>(null)

  const [reloadKey, setReloadKey] = useState(0)
  // Conta as alterações feitas nesta app, para uma lista pedida antes delas não as desfazer.
  const changeCount = useRef(0)

  useEffect(() => {
    let cancelled = false
    api.listGoals().then(
      (result) => {
        if (cancelled) return
        setGoals(result)
        setLoadState({ kind: 'ready' })
      },
      (error: unknown) => {
        if (!cancelled) setLoadState({ kind: 'error', message: errorMessage(error) })
      },
    )
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  // Ao voltar à app, pede a lista outra vez, sem o "A carregar…". Se falhar (ex.: sem rede),
  // fica a que havia. Se entretanto mudou alguma coisa aqui, a lista pedida já vem atrasada.
  useEffect(
    () =>
      onResume(() => {
        const countBefore = changeCount.current
        api.listGoals().then(
          (result) => {
            if (changeCount.current !== countBefore) return
            setGoals(result)
            setLoadState({ kind: 'ready' })
          },
          () => {},
        )
      }),
    [],
  )

  const reload = () => {
    setLoadState({ kind: 'loading' })
    setReloadKey((key) => key + 1)
  }

  /** Todas as alterações à lista passam por aqui (ver `changeCount`). */
  const changeGoals = (change: (current: Goal[]) => Goal[]) => {
    changeCount.current += 1
    setGoals(change)
  }

  const replaceGoal = (updated: Goal) =>
    changeGoals((current) => current.map((goal) => (goal.id === updated.id ? updated : goal)))

  // Com o progresso calculado pelos passos, a percentagem acompanha logo o plano.
  const updatePlan = (goalId: number, change: (plan: PlanStep[]) => PlanStep[]) =>
    changeGoals((current) => current.map((goal) => (goal.id === goalId ? withPlan(goal, change(goal.plan)) : goal)))

  /** Corre uma ação; se falhar, guarda a mensagem para o aviso global. */
  const run = async (action: () => Promise<void>) => {
    setActionError(null)
    try {
      await action()
    } catch (error) {
      setActionError(errorMessage(error))
    }
  }

  return {
    goals,
    loadState,
    reload,
    actionError,
    dismissActionError: () => setActionError(null),

    // Estas três lançam ApiError se falharem, para o formulário mostrar o erro.
    createGoal: async (input: NewGoal) => {
      const goal = await api.createGoal(input)
      changeGoals((current) => [...current, goal].sort(byTargetDate))
    },

    updateGoal: async (goalId: number, changes: GoalChanges) => {
      const updated = await api.updateGoal(goalId, changes)
      // A data limite pode ter mudado, por isso volta a ordenar.
      changeGoals((current) => current.map((goal) => (goal.id === updated.id ? updated : goal)).sort(byTargetDate))
    },

    deleteGoal: async (goalId: number) => {
      await api.deleteGoal(goalId)
      changeGoals((current) => current.filter((goal) => goal.id !== goalId))
    },

    evaluateGoal: (goalId: number, outcome: GoalOutcome, note?: string) =>
      run(async () => replaceGoal(await api.evaluateGoal(goalId, outcome, note))),

    reopenGoal: (goalId: number) => run(async () => replaceGoal(await api.reopenGoal(goalId))),

    // Mostra logo a mudança (a caixa do passo não fica à espera da API) e desfá-la se falhar.
    setStepDone: (goalId: number, stepId: number, done: boolean) =>
      run(async () => {
        const mark = (value: boolean) =>
          updatePlan(goalId, (plan) => plan.map((s) => (s.id === stepId ? { ...s, done: value } : s)))
        mark(done)
        try {
          const step = await api.updateStep(goalId, stepId, { done })
          updatePlan(goalId, (plan) => plan.map((s) => (s.id === step.id ? step : s)))
        } catch (error) {
          mark(!done)
          throw error
        }
      }),

    // Num objetivo recorrente, marca ou desmarca um dia. Mostra-o logo e põe depois o objetivo
    // que a API devolve, com a percentagem (dos dias feitos) já calculada por ela.
    setCheckin: (goalId: number, day: string, done: boolean) =>
      run(async () => {
        const mark = (value: boolean) =>
          changeGoals((current) =>
            current.map((goal) => (goal.id === goalId ? { ...goal, checkins: toggleDay(goal.checkins, day, value) } : goal)),
          )
        mark(done)
        try {
          replaceGoal(await (done ? api.addCheckin(goalId, day) : api.removeCheckin(goalId, day)))
        } catch (error) {
          mark(!done)
          throw error
        }
      }),

    // Lança ApiError se falhar, para o formulário do passo mostrar o erro e manter o texto.
    addStep: async (goalId: number, title: string) => {
      const step = await api.addStep(goalId, title)
      updatePlan(goalId, (plan) => [...plan, step])
    },
  }
}

export type GoalActions = Pick<
  ReturnType<typeof useGoals>,
  'evaluateGoal' | 'reopenGoal' | 'setStepDone' | 'addStep' | 'setCheckin'
>
