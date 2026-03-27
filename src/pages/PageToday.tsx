import { useState, useCallback, useMemo } from 'react';
import { ActivityDefinition } from '../types';
import { useLanguage } from '../i18n';
import {
  loadActivities,
  saveActivities,
  deleteActivity,
  getTranslatedActivity,
} from '../utils/activities';
import { getDayEntry, getTodayDate } from '../utils/storage';
import ActivityCard from '../components/ActivityCard';
import ActivityFlow from '../components/ActivityFlow';
import ActivityEditor from '../components/ActivityEditor';

export default function PageToday() {
  const { t, language } = useLanguage();
  const [activities, setActivities] = useState<ActivityDefinition[]>(() => loadActivities());
  const [activeActivity, setActiveActivity] = useState<ActivityDefinition | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editingActivity, setEditingActivity] = useState<ActivityDefinition | null>(null);
  const [showNewActivity, setShowNewActivity] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Translate activities for display - depends on language to ensure re-render on language change
  const translatedActivities = useMemo(() =>
    activities.map(a => getTranslatedActivity(a, t)),
    [activities, t, language]
  );

  const timedActivities = translatedActivities.filter((a) => a.durationMinutes !== null);
  const untimedActivities = translatedActivities.filter((a) => a.durationMinutes === null);

  const completedTodayCounts = useMemo(() => {
    const todayEntry = getDayEntry(getTodayDate());
    const counts = new Map<string, number>();
    if (!todayEntry) return counts;
    todayEntry.activities.forEach((a) => {
      counts.set(a.type, (counts.get(a.type) || 0) + 1);
    });
    return counts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const handleActivityClick = (activity: ActivityDefinition) => {
    // Find the original activity for editing
    const originalActivity = activities.find(a => a.type === activity.type);
    if (editMode) {
      setEditingActivity(originalActivity || activity);
    } else {
      // Use translated activity for display in flow
      setActiveActivity(activity);
    }
  };

  const handleSaveActivity = useCallback((activity: ActivityDefinition) => {
    const current = loadActivities();
    const index = current.findIndex((a) => a.type === activity.type);

    if (index >= 0) {
      current[index] = activity;
    } else {
      current.push(activity);
    }

    saveActivities(current);
    setActivities(current);
    setEditingActivity(null);
    setShowNewActivity(false);
  }, []);

  const handleDeleteActivity = useCallback(() => {
    if (!editingActivity) return;

    const updated = deleteActivity(editingActivity.type);
    setActivities(updated);
    setEditingActivity(null);
  }, [editingActivity]);

  const handleMoveActivity = useCallback((activityType: string, direction: 'up' | 'down') => {
    const current = [...activities];
    const index = current.findIndex((a) => a.type === activityType);
    if (index < 0) return;

    const activity = current[index];
    const isTimed = activity.durationMinutes !== null;

    // Find indices of same type activities (timed or untimed)
    const sameTypeIndices = current
      .map((a, i) => ({ a, i }))
      .filter(({ a }) => (a.durationMinutes !== null) === isTimed)
      .map(({ i }) => i);

    const posInGroup = sameTypeIndices.indexOf(index);

    if (direction === 'up' && posInGroup > 0) {
      const targetIndex = sameTypeIndices[posInGroup - 1];
      [current[index], current[targetIndex]] = [current[targetIndex], current[index]];
    } else if (direction === 'down' && posInGroup < sameTypeIndices.length - 1) {
      const targetIndex = sameTypeIndices[posInGroup + 1];
      [current[index], current[targetIndex]] = [current[targetIndex], current[index]];
    }

    saveActivities(current);
    setActivities(current);
  }, [activities]);

  const handleAddNew = () => {
    setShowNewActivity(true);
  };

  const renderActivityWithControls = (activity: ActivityDefinition, index: number, total: number) => (
    <div key={activity.type} className="relative flex items-center gap-2">
      {editMode && (
        <div className="flex flex-col gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleMoveActivity(activity.type, 'up');
            }}
            disabled={index === 0}
            className="p-1 text-themed-faint hover:text-themed-accent-solid disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleMoveActivity(activity.type, 'down');
            }}
            disabled={index === total - 1}
            className="p-1 text-themed-faint hover:text-themed-accent-solid disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      )}

      <div className="flex-1 relative">
        <ActivityCard
          activity={activity}
          onClick={() => handleActivityClick(activity)}
          completedToday={completedTodayCounts.has(activity.type)}
          completedCount={completedTodayCounts.get(activity.type) || 0}
        />
        {editMode && (
          <div className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
                style={{ backgroundColor: 'var(--accent-solid)' }}>
            <svg className="w-2.5 h-2.5" style={{ color: 'var(--accent-text-on-solid)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="page-container">
      <header className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-serif text-3xl text-themed-primary">{t.today.title}</h1>
          <p className="text-themed-faint mt-1">{t.today.subtitle}</p>
        </div>
        <button
          onClick={() => setEditMode(!editMode)}
          className="px-3 py-1.5 text-sm rounded-xl transition-colors flex items-center gap-2"
          style={{
            backgroundColor: editMode ? 'var(--accent-solid)' : 'var(--bg-input)',
            color: editMode ? 'var(--accent-text-on-solid)' : 'var(--text-secondary)',
          }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          {editMode ? t.today.done : t.today.edit}
        </button>
      </header>

      {editMode && (
        <div className="mb-4 p-3 rounded-xl border" style={{ backgroundColor: 'var(--accent-bg)', borderColor: 'var(--accent-border)' }}>
          <p className="text-sm text-themed-accent">{t.today.editHint}</p>
        </div>
      )}

      <section className="mb-6">
        <h2 className="font-serif text-base text-themed-secondary mb-3">{t.today.timedSection}</h2>
        <div className="space-y-2">
          {timedActivities.map((activity, index) =>
            renderActivityWithControls(activity, index, timedActivities.length)
          )}

          {editMode && (
            <button
              onClick={handleAddNew}
              className="w-full p-3 rounded-xl border-2 border-dashed border-themed-medium
                       text-themed-faint hover:border-themed-accent hover:text-themed-accent-solid
                       transition-colors flex items-center justify-center gap-2 text-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {t.today.addTimed}
            </button>
          )}
        </div>
      </section>

      <section>
        <h2 className="font-serif text-base text-themed-secondary mb-3">{t.today.momentsSection}</h2>
        <div className="space-y-2">
          {untimedActivities.map((activity, index) =>
            renderActivityWithControls(activity, index, untimedActivities.length)
          )}

          {editMode && (
            <button
              onClick={handleAddNew}
              className="w-full p-3 rounded-xl border-2 border-dashed border-themed-medium
                       text-themed-faint hover:border-themed-accent hover:text-themed-accent-solid
                       transition-colors flex items-center justify-center gap-2 text-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {t.today.addMoment}
            </button>
          )}
        </div>
      </section>

      {activeActivity && (
        <ActivityFlow
          activity={activeActivity}
          onClose={() => {
            setActiveActivity(null);
            setRefreshKey((k) => k + 1);
          }}
        />
      )}

      {editingActivity && (
        <ActivityEditor
          activity={editingActivity}
          onSave={handleSaveActivity}
          onDelete={handleDeleteActivity}
          onClose={() => setEditingActivity(null)}
        />
      )}

      {showNewActivity && (
        <ActivityEditor
          onSave={handleSaveActivity}
          onClose={() => setShowNewActivity(false)}
        />
      )}
    </div>
  );
}
