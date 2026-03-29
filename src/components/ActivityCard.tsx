import { ActivityDefinition } from '../types';
import { useLanguage } from '../i18n';

interface ActivityCardProps {
  activity: ActivityDefinition;
  onClick: () => void;
  completedToday?: boolean;
  completedCount?: number;
  completedYesterday?: boolean;
  yesterdayCount?: number;
  totalCount?: number;
  totalSeconds?: number;
}

function formatTotalTime(seconds: number): string {
  if (seconds === 0) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h${m > 0 ? ` ${m}m` : ''}`;
  return `${m}m`;
}

export default function ActivityCard({ activity, onClick, completedToday, completedCount, completedYesterday: _completedYesterday, yesterdayCount: _yesterdayCount, totalSeconds }: ActivityCardProps) {
  const { t } = useLanguage();

  return (
    <button
      onClick={onClick}
      className="card w-full text-left transition-colors"
      style={{ backgroundColor: 'var(--bg-card)' }}
      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-input)'}
      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-card)'}
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl">{activity.emoji}</span>
        <span className="font-serif text-themed-primary flex-1">{activity.name}</span>

        {/* Total time for timed activities */}
        {activity.durationMinutes && (totalSeconds || 0) > 0 && (
          <span className="text-xs text-themed-faint opacity-50">
            {formatTotalTime(totalSeconds || 0)}
          </span>
        )}

        {/* Session count (when >1) */}
        {(completedCount || 0) > 1 && (
          <span className="text-xs font-medium text-themed-accent-solid">{completedCount}</span>
        )}

        {/* Duration badge for timed */}
        {activity.durationMinutes && (
          <span className="text-sm text-themed-accent-solid bg-themed-accent px-2 py-0.5 rounded-full">
            {activity.durationMinutes} {t.today.min}
          </span>
        )}

        {/* Session check - always last */}
        <span className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center ${
          completedToday ? '' : 'opacity-20'
        }`} style={{ backgroundColor: completedToday ? 'var(--accent-solid)' : 'var(--text-faint)' }}>
          <svg className="w-3 h-3" style={{ color: completedToday ? 'var(--accent-text-on-solid)' : 'var(--bg-card)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </span>
      </div>
    </button>
  );
}
