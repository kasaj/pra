import { useState, useCallback, useMemo, useEffect } from 'react';
import { ActivityDefinition, Rating } from '../types';
import { useLanguage } from '../i18n';
import {
  loadActivities,
  saveActivities,
  deleteActivity,
  getTranslatedActivity,
  markActivityModified,
} from '../utils/activities';
import { getDayEntry, getTodayDate, loadAllData, generateId, addActivity, updateActivityById } from '../utils/storage';
import ActivityCard from '../components/ActivityCard';
import ActivityFlow from '../components/ActivityFlow';
import ActivityEditor from '../components/ActivityEditor';
import StarRating from '../components/StarRating';


export default function PageToday() {
  const { t, language } = useLanguage();
  const [activities, setActivities] = useState<ActivityDefinition[]>(() => loadActivities());
  const [activeActivity, setActiveActivity] = useState<ActivityDefinition | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editingActivity, setEditingActivity] = useState<ActivityDefinition | null>(null);
  const [showNewActivity, setShowNewActivity] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [moodRating, setMoodRating] = useState<Rating | null>(null);
  const [moodComment, setMoodComment] = useState('');

  const saveMoodEntry = useCallback((rating: Rating | null, text: string) => {
    if (!rating && !text.trim()) return;
    const now = new Date().toISOString();
    const id = generateId();

    // Find previous nalada in current session to auto-link
    const ss = localStorage.getItem('pra_session_start') || now;
    const todayEntry = getDayEntry(getTodayDate());
    const prevInSession = todayEntry?.activities
      .filter(a => a.type === 'nalada' && new Date(a.completedAt || a.startedAt) >= new Date(ss))
      .sort((a, b) => new Date(b.completedAt || b.startedAt).getTime() - new Date(a.completedAt || a.startedAt).getTime())
      [0];

    addActivity({
      id,
      type: 'nalada',
      startedAt: now,
      completedAt: now,
      durationMinutes: null,
      comments: [{
        id: `c-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        text: text.trim(),
        createdAt: now,
        rating: rating || undefined,
      }],
      linkedFromId: prevInSession?.id,
    });

    if (prevInSession) {
      updateActivityById(prevInSession.id, {
        linkedActivityIds: [...(prevInSession.linkedActivityIds || []), id],
      });
    }

    if (rating) setMoodRating(rating);
    setRefreshKey((k) => k + 1);
  }, []);

  // Translate activities for display - filter out core activities
  const translatedActivities = useMemo(() =>
    activities.filter(a => !a.core).map(a => getTranslatedActivity(a, t)),
    [activities, t, language]
  );



  // Session timestamp - activities before this are "previous" (gray), after are "current" (blue)
  // Persists across page refresh, only reset via button or midnight
  const [sessionStart, setSessionStart] = useState(() => {
    const stored = localStorage.getItem('pra_session_start');
    if (stored) return stored;
    const now = new Date().toISOString();
    localStorage.setItem('pra_session_start', now);
    return now;
  });

  // Auto-detect midnight - start new session
  useEffect(() => {
    const check = () => {
      const todayMidnight = new Date();
      todayMidnight.setHours(0, 0, 0, 0);
      if (new Date(sessionStart) < todayMidnight) {
        const newSession = todayMidnight.toISOString();
        setSessionStart(newSession);
        localStorage.setItem('pra_session_start', newSession);
        setRefreshKey((k) => k + 1);
      }
    };
    const interval = setInterval(check, 30000);
    const onVisible = () => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', onVisible); };
  }, [sessionStart]);

  // Current session (blue) - activities after sessionStart today
  const completedTodayCounts = useMemo(() => {
    const todayEntry = getDayEntry(getTodayDate());
    const counts = new Map<string, number>();
    if (!todayEntry) return counts;
    todayEntry.activities.forEach((a) => {
      if (new Date(a.completedAt || a.startedAt) >= new Date(sessionStart)) {
        counts.set(a.type, (counts.get(a.type) || 0) + 1);
      }
    });
    return counts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey, sessionStart]);

  // Previous (gray) - activities before sessionStart today
  const completedPreviousCounts = useMemo(() => {
    const todayEntry = getDayEntry(getTodayDate());
    const counts = new Map<string, number>();
    if (!todayEntry) return counts;
    todayEntry.activities.forEach((a) => {
      if (new Date(a.completedAt || a.startedAt) < new Date(sessionStart)) {
        counts.set(a.type, (counts.get(a.type) || 0) + 1);
      }
    });
    return counts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey, sessionStart]);

  // Total time and count per activity type (all history)
  const { totalTimePerActivity, totalCountPerActivity } = useMemo(() => {
    const allData = loadAllData();
    const times = new Map<string, number>();
    const counts = new Map<string, number>();
    allData.forEach((day) => {
      day.activities.forEach((a) => {
        const secs = a.actualDurationSeconds || (a.durationMinutes ? a.durationMinutes * 60 : 60);
        times.set(a.type, (times.get(a.type) || 0) + secs);
        counts.set(a.type, (counts.get(a.type) || 0) + 1);
      });
    });
    return { totalTimePerActivity: times, totalCountPerActivity: counts };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey, sessionStart]);

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
    const isNew = index < 0;

    if (isNew) {
      current.push(activity);
    } else {
      current[index] = activity;
    }

    saveActivities(current);
    markActivityModified(activity.type);
    setActivities(current);

    // Only close editor for new activities
    if (isNew) {
      setEditingActivity(null);
      setShowNewActivity(false);
    }
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
          completedYesterday={completedPreviousCounts.has(activity.type)}
          yesterdayCount={completedPreviousCounts.get(activity.type) || 0}
          totalCount={totalCountPerActivity.get(activity.type) || 0}
          totalSeconds={totalTimePerActivity.get(activity.type) || 0}
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
      <header className="mb-6">
        <h1 className="font-serif text-3xl text-themed-primary">{t.today.title}</h1>
        <div className="flex items-center justify-between mt-1">
          <p className="text-themed-faint">{t.today.subtitle}</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const now = new Date().toISOString();
                setSessionStart(now);
                localStorage.setItem('pra_session_start', now);
                setRefreshKey((k) => k + 1);
              }}
              className="px-2.5 py-1.5 text-sm rounded-xl transition-colors flex items-center"
              style={{
                backgroundColor: 'var(--bg-input)',
                color: 'var(--text-secondary)',
              }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </button>
            <button
              onClick={() => setShowNewActivity(true)}
              className="px-2.5 py-1.5 text-sm rounded-xl transition-colors flex items-center"
              style={{
                backgroundColor: 'var(--bg-input)',
                color: 'var(--text-secondary)',
              }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
            <button
              onClick={() => setEditMode(!editMode)}
              className="px-2.5 py-1.5 text-sm rounded-xl transition-colors flex items-center"
              style={{
                backgroundColor: editMode ? 'var(--accent-solid)' : 'var(--bg-input)',
                color: editMode ? 'var(--accent-text-on-solid)' : 'var(--text-secondary)',
              }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {editMode && (
        <div className="mb-4 p-3 rounded-xl border" style={{ backgroundColor: 'var(--accent-bg)', borderColor: 'var(--accent-border)' }}>
          <p className="text-sm text-themed-accent">{t.today.editHint}</p>
        </div>
      )}

      {/* Quick mood */}
      <div className="card mb-4 p-3">
        <div className="flex items-center justify-between mb-2">
          <StarRating value={moodRating} onChange={(r) => saveMoodEntry(r, '')} size="md" />
          <div className="flex items-center gap-2">
            {(totalCountPerActivity.get('nalada') || 0) > 0 && (
              <span className="text-xs text-themed-faint opacity-50">
                {totalCountPerActivity.get('nalada')}
              </span>
            )}
            {completedTodayCounts.has('nalada') && (
              <span className="flex items-center gap-1">
                <span className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--accent-solid)' }}>
                  <svg className="w-3 h-3" style={{ color: 'var(--accent-text-on-solid)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </span>
                {(completedTodayCounts.get('nalada') || 0) > 1 && (
                  <span className="text-xs font-medium text-themed-accent-solid">{completedTodayCounts.get('nalada')}</span>
                )}
              </span>
            )}
          </div>
        </div>
        <textarea
          value={moodComment}
          onChange={(e) => setMoodComment(e.target.value)}
          placeholder={language === 'cs' ? 'Jak se cítíš...' : 'How do you feel...'}
          className="w-full p-2 rounded-xl bg-themed-input border border-themed
                   focus:outline-none focus:border-themed-accent resize-none h-10
                   text-themed-primary placeholder:text-themed-faint text-sm"
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveMoodEntry(null, moodComment); } }}
          onBlur={() => { if (moodComment.trim()) saveMoodEntry(null, moodComment); }}
        />
      </div>

      <section>
        <div className="space-y-2">
          {translatedActivities.map((activity, index) =>
            renderActivityWithControls(activity, index, translatedActivities.length)
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

      {activeActivity && (
        <ActivityFlow
          activity={activeActivity}
          onClose={() => {
            setActiveActivity(null);
            setRefreshKey((k) => k + 1);
          }}
          onEdit={() => {
            const original = activities.find(a => a.type === activeActivity.type);
            setActiveActivity(null);
            setEditingActivity(original || activeActivity);
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
