import { ActivityDefinition } from '../types';
import { useLanguage } from '../i18n';

interface ActivityCardProps {
  activity: ActivityDefinition;
  onClick: () => void;
  completedToday?: boolean;
  completedCount?: number;
}

export default function ActivityCard({ activity, onClick, completedToday, completedCount }: ActivityCardProps) {
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
        {completedToday && (
          <span className="flex items-center gap-1">
            <span className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--accent-solid)' }}>
              <svg className="w-3 h-3" style={{ color: 'var(--accent-text-on-solid)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </span>
            {(completedCount || 0) > 1 && (
              <span className="text-xs font-medium text-themed-accent-solid">{completedCount}</span>
            )}
          </span>
        )}
        {activity.durationMinutes && (
          <span className="text-sm text-themed-accent-solid bg-themed-accent px-2 py-0.5 rounded-full">
            {activity.durationMinutes} {t.today.min}
          </span>
        )}
      </div>
    </button>
  );
}
