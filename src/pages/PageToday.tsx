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
import { loadVariantRegistry, addToRegistry } from '../utils/variantRegistry';
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
  const [selectedProperties, setSelectedProperties] = useState<Set<string>>(new Set());
  const [editMode, setEditMode] = useState(false);
  const [registryVersion, setRegistryVersion] = useState(0);
  const viewMode = localStorage.getItem('pra_view_mode') || 'default';
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null);
  const [customTime, setCustomTime] = useState<string | null>(null);
  const customTimeRef = useRef<string | null>(null);
  const setCustomTimeSync = (t: string | null) => { customTimeRef.current = t; setCustomTime(t); };
  const [newPropertyText, setNewPropertyText] = useState('');
  const [hiddenProperties, setHiddenProperties] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('pra_hidden_properties');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  });
  const toggleHideProperty = (prop: string) => {
    setHiddenProperties(prev => {
      const next = new Set(prev);
      if (next.has(prop)) next.delete(prop); else next.add(prop);
      localStorage.setItem('pra_hidden_properties', JSON.stringify([...next]));
      return next;
    });
  };
  const moodRatingRef = useRef<Rating | null>(null);
  const moodCommentRef = useRef('');
  const moodTextareaRef = useRef<HTMLTextAreaElement>(null);
  const selectedPropertiesRef = useRef<Set<string>>(new Set());

  const setMoodRatingSync = (r: Rating | null) => {
    moodRatingRef.current = r;
    setMoodRating(r);
  };
  const setMoodCommentSync = (c: string) => {
    moodCommentRef.current = c;
    setMoodComment(c);
  };
  const toggleProperty = (prop: string) => {
    setSelectedProperties(prev => {
      const next = new Set(prev);
      if (next.has(prop)) next.delete(prop); else next.add(prop);
      selectedPropertiesRef.current = next;
      return next;
    });
  };

  const flushMood = useCallback(() => {
    const r = moodRatingRef.current;
    const c = moodCommentRef.current;
    const props = [...selectedPropertiesRef.current];
    if (!r && !c.trim() && props.length === 0) return;
    const now = customTimeRef.current || new Date().toISOString();
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
        text: [props.length > 0 ? props.join(', ') : '', c.trim()].filter(Boolean).join(' — '),
        createdAt: now,
        rating: r || undefined,
      }],
      linkedFromId: prevInSession?.id,
      selectedVariant: props.length > 0 ? props.join(', ') : undefined,
    });

    if (prevInSession) {
      updateActivityById(prevInSession.id, {
        linkedActivityIds: [...(prevInSession.linkedActivityIds || []), id],
      });
    }

    setMoodRatingSync(null);
    setMoodCommentSync('');
    selectedPropertiesRef.current = new Set();
    setSelectedProperties(new Set());
    setCustomTimeSync(null);
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


  const handleMoveActivity = useCallback((type: string, direction: 'up' | 'down') => {
    const current = [...activities];
    const index = current.findIndex(a => a.type === type);
    if (index < 0) return;
    // Skip core activities for swap targets
    const findTarget = (from: number, dir: number): number => {
      let i = from + dir;
      while (i >= 0 && i < current.length) {
        if (!current[i].core) return i;
        i += dir;
      }
      return -1;
    };
    const target = findTarget(index, direction === 'up' ? -1 : 1);
    if (target < 0) return;
    [current[index], current[target]] = [current[target], current[index]];
    saveActivities(current);
    setActivities(current);
  }, [activities]);

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
    <div className={`page-container ${viewMode === 'beta' ? 'min-h-screen flex flex-col' : ''}`}>
      <div className="flex items-center justify-between mb-1.5">
          <h1 className="font-serif text-3xl text-themed-primary">{t.today.title}</h1>
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
            <button
              onClick={() => {
                const next = !editMode;
                setEditMode(next);
              }}
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
      {(
        <section className={viewMode === 'beta' ? 'flex-1 flex flex-col justify-center' : ''}>
          {/* Date/time - editable */}
          <div className="flex items-center justify-center gap-2 mb-1.5">
            <input
              type="date"
              value={(() => { const d = customTime ? new Date(customTime) : new Date(); const pad = (n: number) => n.toString().padStart(2, '0'); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; })()}
              onChange={(e) => {
                if (e.target.value) {
                  const current = customTime ? new Date(customTime) : new Date();
                  const [y, m, d] = e.target.value.split('-').map(Number);
                  current.setFullYear(y, m - 1, d);
                  setCustomTimeSync(current.toISOString());
                }
              }}
              className="text-xs text-themed-faint bg-transparent border-none focus:outline-none focus:text-themed-muted cursor-pointer"
            />
            <input
              type="time"
              value={(() => { const d = customTime ? new Date(customTime) : new Date(); const pad = (n: number) => n.toString().padStart(2, '0'); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; })()}
              onChange={(e) => {
                if (e.target.value) {
                  const current = customTime ? new Date(customTime) : new Date();
                  const [h, min] = e.target.value.split(':').map(Number);
                  current.setHours(h, min);
                  setCustomTimeSync(current.toISOString());
                }
              }}
              className="text-xs text-themed-faint bg-transparent border-none focus:outline-none focus:text-themed-muted cursor-pointer"
            />
          </div>
          {/* Properties above core */}
          <div className="flex flex-wrap gap-1.5 mb-1.5 justify-center">
            {(() => { void registryVersion; return loadVariantRegistry(); })().slice().sort((a, b) => {
              const aIsEmoji = /^\p{Emoji}/u.test(a);
              const bIsEmoji = /^\p{Emoji}/u.test(b);
              if (aIsEmoji !== bIsEmoji) return aIsEmoji ? 1 : -1;
              return a.localeCompare(b, language);
            }).filter(prop => editMode || !hiddenProperties.has(prop)).map((prop) => (
              <div key={prop} className="relative">
                <button
                  onClick={() => editMode ? toggleHideProperty(prop) : toggleProperty(prop)}
                  className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                    editMode && hiddenProperties.has(prop)
                      ? 'opacity-30 border-themed bg-themed-input text-themed-faint line-through'
                      : selectedProperties.has(prop)
                        ? 'bg-themed-accent border-themed-accent text-themed-accent'
                        : 'bg-themed-input border-themed text-themed-muted hover:border-themed-medium'
                  }`}
                >
                  {prop}
                </button>
              </div>
            ))}
            {editMode && (
              <input
                type="text"
                value={newPropertyText}
                onChange={(e) => setNewPropertyText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const text = newPropertyText.trim();
                    if (text) {
                      addToRegistry(text);
                      setNewPropertyText('');
                    }
                  }
                }}
                onBlur={() => {
                  const text = newPropertyText.trim();
                  if (text) { addToRegistry(text); setNewPropertyText(''); }
                }}
                placeholder="+"
                className="w-20 px-3 py-1.5 text-sm rounded-full border border-dashed border-themed bg-themed-input
                         text-themed-primary placeholder:text-themed-faint focus:outline-none focus:border-themed-accent"
              />
            )}
          </div>

          {/* Beta: activities as bubbles below properties */}
          {viewMode === 'beta' && (
            <>
              <div className="border-t border-themed mb-1.5 mt-1.5" />
              <div className="flex flex-wrap gap-1.5 mb-1.5 justify-center">
                {/* Duration bubbles */}
                {(() => {
                  const durations = [...new Set(allTranslated.filter(a => !a.core && a.durationMinutes).map(a => a.durationMinutes!))].sort((a, b) => a - b);
                  return durations.map(d => (
                    <button
                      key={`dur-${d}`}
                      onClick={() => setSelectedDuration(selectedDuration === d ? null : d)}
                      className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                        selectedDuration === d
                          ? 'bg-themed-accent border-themed-accent text-themed-accent'
                          : 'bg-themed-input border-themed text-themed-faint hover:border-themed-medium'
                      }`}
                    >
                      {d} min
                    </button>
                  ));
                })()}
                {/* Activity bubbles */}
                {allTranslated.filter(a => !a.core).map((activity) => (
                  <button
                    key={activity.type}
                    onClick={() => {
                      if (selectedDuration && activity.durationMinutes) {
                        const modified = { ...activity, durationMinutes: selectedDuration };
                        handleActivityClick(modified);
                      } else {
                        handleActivityClick(activity);
                      }
                    }}
                    className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                      completedTodayCounts.has(activity.type)
                        ? 'bg-themed-accent border-themed-accent text-themed-accent'
                        : 'bg-themed-input border-themed text-themed-muted hover:border-themed-medium'
                    }`}
                  >
                    {activity.emoji} {activity.name}
                  </button>
                ))}
              </div>
            </>
          )}
          {/* Core activity centered */}
          <div className="flex items-center gap-1">
          <div className="w-5" />
          <div className="flex-1">
          <div
            className="card p-3"
            onBlur={(e) => {
              setTimeout(() => {
                if (!e.currentTarget.contains(document.activeElement)) flushMood();
              }, 100);
            }}
          >
            <div className="flex justify-center mb-3">
              <StarRating value={moodRating} onChange={(r) => setMoodRatingSync(r)} size="lg" />
            </div>
            <textarea
              ref={moodTextareaRef}
              value={moodComment}
              onChange={(e) => {
                setMoodCommentSync(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = e.target.scrollHeight + 'px';
              }}
              placeholder={language === 'cs' ? 'Tak jak?' : 'So how?'}
              rows={1}
              className="w-full px-3 py-2 rounded-xl bg-themed-input border border-themed
                       focus:outline-none focus:border-themed-accent resize-none
                       text-themed-primary placeholder:text-themed-faint text-base overflow-hidden"
            />
            <div className="flex items-center justify-end gap-2 mt-2">
              {(totalCountPerActivity.get('nalada') || 0) > 0 && (
                <span className="text-xs text-themed-faint opacity-50">{totalCountPerActivity.get('nalada')}</span>
              )}
              {(completedTodayCounts.get('nalada') || 0) >= 1 && (
                <span className="text-xs font-medium text-themed-accent-solid">{completedTodayCounts.get('nalada')}</span>
              )}
              <span className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center ${
                completedTodayCounts.has('nalada') ? '' : 'opacity-20'
              }`} style={{ backgroundColor: completedTodayCounts.has('nalada') ? 'var(--accent-solid)' : 'var(--text-faint)' }}>
                <svg className="w-3 h-3" style={{ color: completedTodayCounts.has('nalada') ? 'var(--accent-text-on-solid)' : 'var(--bg-card)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </span>
            </div>
            {/* Beta: activities inside core card */}
            {viewMode === 'beta' && allTranslated.filter(a => !a.core).length > 0 && (
              <div className="mt-3 pt-3 border-t border-themed space-y-1.5">
                {allTranslated.filter(a => !a.core).map((activity) => (
                  <div key={activity.type} className="flex items-center gap-2 opacity-50">
                    <span className="text-sm">{activity.emoji}</span>
                    <span className="text-xs text-themed-muted flex-1">{activity.name}</span>
                    {activity.durationMinutes ? (
                      (totalTimePerActivity.get(activity.type) || 0) > 0 && (
                        <span className="text-xs text-themed-faint">
                          {(() => { const s = totalTimePerActivity.get(activity.type) || 0; const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); return h > 0 ? `${h} h${m > 0 ? ` ${m} m` : ''}` : `${m} m`; })()}
                        </span>
                      )
                    ) : (
                      (totalCountPerActivity.get(activity.type) || 0) > 0 && (
                        <span className="text-xs text-themed-faint">{totalCountPerActivity.get(activity.type)}</span>
                      )
                    )}
                    {(completedTodayCounts.get(activity.type) || 0) >= 1 && (
                      <span className="text-xs font-medium text-themed-accent-solid">{completedTodayCounts.get(activity.type)}</span>
                    )}
                    <span className={`w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center ${
                      completedTodayCounts.has(activity.type) ? '' : 'opacity-20'
                    }`} style={{ backgroundColor: completedTodayCounts.has(activity.type) ? 'var(--accent-solid)' : 'var(--text-faint)' }}>
                      <svg className="w-2.5 h-2.5" style={{ color: completedTodayCounts.has(activity.type) ? 'var(--accent-text-on-solid)' : 'var(--bg-card)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          </div>
          <div className="w-5" />
          </div>

          {/* All non-core activities - default view only */}
          {viewMode !== 'beta' && (
            <div className="mt-1.5 space-y-1.5">
              {allTranslated.filter(a => !a.core).map((activity, idx, arr) => (
                <div key={activity.type} className="flex items-center gap-1">
                  {editMode ? (
                    <div className="flex flex-col w-5">
                      <button onClick={() => handleMoveActivity(activity.type, 'up')} disabled={idx === 0} className="p-0.5 text-themed-faint hover:text-themed-accent-solid disabled:opacity-20">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                      </button>
                      <button onClick={() => handleMoveActivity(activity.type, 'down')} disabled={idx === arr.length - 1} className="p-0.5 text-themed-faint hover:text-themed-accent-solid disabled:opacity-20">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                      </button>
                    </div>
                  ) : <div className="w-5" />}
                  <div className="flex-1">
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
                  {editMode ? (
                    <div className="flex flex-col w-5">
                      <button onClick={() => handleMoveActivity(activity.type, 'up')} disabled={idx === 0} className="p-0.5 text-themed-faint hover:text-themed-accent-solid disabled:opacity-20">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                      </button>
                      <button onClick={() => handleMoveActivity(activity.type, 'down')} disabled={idx === arr.length - 1} className="p-0.5 text-themed-faint hover:text-themed-accent-solid disabled:opacity-20">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                      </button>
                    </div>
                  ) : <div className="w-5" />}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {activeActivity && (
        <ActivityFlow
          activity={activeActivity}
          onClose={() => {
            setActiveActivity(null);
            setActivities(loadActivities());
            setRefreshKey((k) => k + 1);
            setRegistryVersion((v) => v + 1);
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
          onClose={() => { setEditingActivity(null); setRegistryVersion((v) => v + 1); }}
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
