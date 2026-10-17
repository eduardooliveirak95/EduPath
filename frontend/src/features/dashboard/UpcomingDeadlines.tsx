import { CalendarClock } from 'lucide-react'
import { Panel } from '../../components/ui/Panel'
import type { Goal } from '../../types'
import { daysBetween, describeDaysLeft, parseISODate } from '../../utils/date'

const MAX_ITEMS = 4
const monthFormat = new Intl.DateTimeFormat('pt-PT', { month: 'short' })

interface UpcomingDeadlinesProps {
  goals: Goal[]
  today: string
}

export function UpcomingDeadlines({ goals, today }: UpcomingDeadlinesProps) {
  const upcoming = [...goals].sort((a, b) => a.targetDate.localeCompare(b.targetDate)).slice(0, MAX_ITEMS)

  return (
    <Panel title="Próximos prazos" icon={<CalendarClock size={18} aria-hidden />}>
      <ul className="deadlines">
        {upcoming.map((goal) => {
          const date = parseISODate(goal.targetDate)
          return (
            <li key={goal.id} className="deadline">
              <time className="deadline__date" dateTime={goal.targetDate}>
                <span className="deadline__day">{date.getDate()}</span>
                <span className="deadline__month">{monthFormat.format(date).replace('.', '')}</span>
              </time>
              <div className="deadline__body">
                <p className="deadline__title">{goal.title}</p>
                <p className="deadline__left">{describeDaysLeft(daysBetween(today, goal.targetDate))}</p>
              </div>
              <span className="deadline__progress">{goal.progress}%</span>
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}
