import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { ActivityDefinition, Rating } from '../types';
import { useLanguage } from '../i18n';
import {
  loadActivities,
  saveActivities,
  deleteActivity,
  getTranslatedActivity,
  markActivityModified,
} from '../utils/activities';
import { getDayEntry, getTodayDate, loadAllData, generateId, addActivity, updateActivityById, findActivityById } from '../utils/storage';
import ActivityCard from '../components/ActivityCard';
import ActivityFlow from '../components/ActivityFlow';
import ActivityEditor from '../components/ActivityEditor';
import StarRating from '../components/StarRating';


export default function PageToday({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const { t, language } = useLanguage();
  const [activities, setActivities] = useState<ActivityDefinition[]>(() => loadActivities());
  const [activeActivity, setActiveActivity] = useState<ActivityDefinition | null>(null);
  const [editingActivity, setEditingActivity] = useState<ActivityDefinition | null>(null);
  const [showNewActivity, setShowNewActivity] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [moodRating, setMoodRating] = useState<Rating | null>(null);
  const [moodComment, setMoodComment] = useState('');
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const moodRatingRef = useRef<Rating | null>(null);
  const moodCommentRef = useRef('');
  const moodTextareaRef = useRef<HTMLTextAreaElement>(null);

  const setMoodRatingSync = (r: Rating | null) => {
    moodRatingRef.current = r;
    setMoodRating(r);
  };
  const setMoodCommentSync = (c: string) => {
    moodCommentRef.current = c;
    setMoodComment(c);
  };

  const flushMood = useCallback(() => {
    const r = moodRatingRef.current;
    const c = moodCommentRef.current;
    if (!r && !c.trim()) return;
    const now = new Date().toISOString();
    const id = generateId();

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
        text: c.trim(),
        createdAt: now,
        rating: r || undefined,
      }],
      linkedFromId: prevInSession?.id,
    });

    if (prevInSession) {
      updateActivityById(prevInSession.id, {
        linkedActivityIds: [...(prevInSession.linkedActivityIds || []), id],
      });
    }

    setMoodRatingSync(null);
    setMoodCommentSync('');
    if (moodTextareaRef.current) {
      moodTextareaRef.current.style.height = 'auto';
    }
    setRefreshKey((k) => k + 1);
  }, []);

  // Flush mood on page navigation or tab hide
  useEffect(() => {
    const handleBeforeNav = () => flushMood();
    window.addEventListener('pra-flush-mood', handleBeforeNav);
    const handleVisibility = () => { if (document.hidden) flushMood(); };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('pra-flush-mood', handleBeforeNav);
      document.removeEventListener('visibilitychange', handleVisibility);
      flushMood();
    };
  }, [flushMood]);

  // Translate all activities for display (including core for reorder)
  const allTranslated = useMemo(() =>
    activities.map(a => getTranslatedActivity(a, t)),
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
    flushMood();
    setActiveActivity(activity);
  };

  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (index: number) => {
    if (dragIndex === null || dragIndex === index) return;
    setDragOverIndex(index);
  };

  const handleDragEnd = () => {
    if (dragIndex !== null && dragOverIndex !== null && dragIndex !== dragOverIndex) {
      const reordered = [...activities];
      const [moved] = reordered.splice(dragIndex, 1);
      reordered.splice(dragOverIndex, 0, moved);
      saveActivities(reordered);
      setActivities(reordered);
    }
    setDragIndex(null);
    setDragOverIndex(null);
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

  return (
    <div className="page-container">
      <header className="mb-6">
        <h1 className="font-serif text-3xl text-themed-primary">{t.today.title}</h1>
        <div className="flex items-center justify-between mt-1">
          <p className="text-themed-faint">{t.today.subtitle}</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                flushMood();
                const now = new Date().toISOString();
                setSessionStart(now);
                localStorage.setItem('pra_session_start', now);
                setRefreshKey((k) => k + 1);
              }}
              className="px-2.5 py-1.5 text-sm rounded-xl transition-colors flex items-center"
              style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-secondary)' }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </button>
            <button
              onClick={() => setShowNewActivity(true)}
              className="px-2.5 py-1.5 text-sm rounded-xl transition-colors flex items-center"
              style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-secondary)' }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        </div>
      </header>



      <section>
        <div className="space-y-2">
          {allTranslated.map((activity, index) => (
            <div
              key={activity.type}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => { e.preventDefault(); handleDragOver(index); }}
              onDragEnd={handleDragEnd}
              onTouchStart={() => handleDragStart(index)}
              onTouchMove={(e) => {
                if (dragIndex === null) return;
                const touch = e.touches[0];
                const el = document.elementFromPoint(touch.clientX, touch.clientY);
                const row = el?.closest('[data-activity-index]');
                if (row) handleDragOver(Number(row.getAttribute('data-activity-index')));
              }}
              onTouchEnd={handleDragEnd}
              data-activity-index={index}
              className={`transition-opacity ${dragIndex === index ? 'opacity-40' : ''} ${dragOverIndex === index ? 'border-t-2 border-themed-accent' : ''}`}
            >
              {activity.core ? (
                /* Core activity (mood) */
                <div
                  className="card p-3"
                  onBlur={(e) => {
                    // Delay to allow clicks within the container
                    setTimeout(() => {
                      if (!e.currentTarget.contains(document.activeElement)) {
                        flushMood();
                      }
                    }, 100);
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <StarRating value={moodRating} onChange={(r) => setMoodRatingSync(r)} size="md" />
                    <span className="flex items-center gap-2">
                      {(totalCountPerActivity.get(activity.type) || 0) > 0 && (
                        <span className="text-xs text-themed-faint opacity-50">{totalCountPerActivity.get(activity.type)}</span>
                      )}
                      {(completedTodayCounts.get(activity.type) || 0) > 1 && (
                        <span className="text-xs font-medium text-themed-accent-solid">{completedTodayCounts.get(activity.type)}</span>
                      )}
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center ${
                        completedTodayCounts.has(activity.type) ? '' : 'opacity-20'
                      }`} style={{ backgroundColor: completedTodayCounts.has(activity.type) ? 'var(--accent-solid)' : 'var(--text-faint)' }}>
                        <svg className="w-3 h-3" style={{ color: completedTodayCounts.has(activity.type) ? 'var(--accent-text-on-solid)' : 'var(--bg-card)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                    </span>
                  </div>
                  <textarea
                    ref={moodTextareaRef}
                    value={moodComment}
                    onChange={(e) => {
                      setMoodCommentSync(e.target.value);
                      e.target.style.height = 'auto';
                      e.target.style.height = e.target.scrollHeight + 'px';
                    }}
                    placeholder={language === 'cs' ? 'Jak se cítíš...' : 'How do you feel...'}
                    className="w-full p-2 rounded-xl bg-themed-input border border-themed
                             focus:outline-none focus:border-themed-accent resize-none min-h-[2.5rem]
                             text-themed-primary placeholder:text-themed-faint text-sm overflow-hidden"
                  />
                </div>
              ) : (
                /* Regular activity */
                <div className="relative">
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
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {activeActivity && (
        <ActivityFlow
          activity={activeActivity}
          onClose={() => {
            setActiveActivity(null);
            setActivities(loadActivities());
            setRefreshKey((k) => k + 1);
          }}
          onEdit={() => {
            const original = activities.find(a => a.type === activeActivity.type);
            setActiveActivity(null);
            setEditingActivity(original || activeActivity);
          }}
          onNavigateLinked={(targetId) => {
            const found = findActivityById(targetId);
            if (found) {
              setActiveActivity(null);
              setRefreshKey((k) => k + 1);
              // Navigate to time page to edit linked activity
              if (onNavigate) onNavigate('time' as import('../types').Page);
            }
          }}
          onNavigatePage={(page) => {
            setActiveActivity(null);
            setActivities(loadActivities());
            setRefreshKey((k) => k + 1);
            if (onNavigate) onNavigate(page as import('../types').Page);
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
