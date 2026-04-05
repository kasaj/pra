import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { ActivityDefinition, Rating } from '../types';
import { useLanguage } from '../i18n';
import {
  loadActivities,
  saveActivities,
  deleteActivity,
  getTranslatedActivity,
  markActivityModified,
  getConfigProperties,
} from '../utils/activities';
import { getDayEntry, getTodayDate, loadAllData, generateId, addActivity, updateActivityById, findActivityById } from '../utils/storage';
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
  useEffect(() => {
    try {
      const stored = localStorage.getItem('pra_hidden_properties');
      setHiddenProperties(stored ? new Set(JSON.parse(stored)) : new Set());
    } catch { /* */ }
  }, [refreshKey]);
  const toggleHideProperty = (prop: string) => {
    setHiddenProperties(prev => {
      const next = new Set(prev);
      if (next.has(prop)) next.delete(prop); else next.add(prop);
      localStorage.setItem('pra_hidden_properties', JSON.stringify([...next]));
      return next;
    });
  };
  const [hiddenActivities, setHiddenActivities] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('pra_hidden_activities');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  });
  useEffect(() => {
    try {
      const stored = localStorage.getItem('pra_hidden_activities');
      setHiddenActivities(stored ? new Set(JSON.parse(stored)) : new Set());
    } catch { /* */ }
  }, [refreshKey]);
  const toggleHideActivity = (type: string) => {
    setHiddenActivities(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type); else next.add(type);
      localStorage.setItem('pra_hidden_activities', JSON.stringify([...next]));
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
      const next = prev.has(prop) ? new Set<string>() : new Set([prop]);
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

    const coreAct = loadActivities().find(a => a.core);
    const coreDur = coreAct?.defaultDuration ?? 1;
    addActivity({
      id,
      type: 'nalada',
      startedAt: now,
      completedAt: now,
      durationMinutes: null,
      actualDurationSeconds: coreDur * 60,
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

  // Properties used in current session (from stored core activities)
  const usedPropertiesInSession = useMemo(() => {
    const todayEntry = getDayEntry(getTodayDate());
    const used = new Set<string>();
    if (!todayEntry) return used;
    todayEntry.activities.forEach((a) => {
      if (new Date(a.completedAt || a.startedAt) >= new Date(sessionStart)) {
        if (a.selectedVariant) {
          a.selectedVariant.split(', ').forEach(p => used.add(p.trim()));
        }
      }
    });
    return used;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey, sessionStart]);

  const handleActivityClick = (activity: ActivityDefinition) => {
    flushMood();
    setActiveActivity(activity);
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
      <header className="mb-1.5">
        <h1 className="font-serif text-3xl text-themed-primary">{t.today.title}</h1>
      </header>
      <section className="flex flex-col">
          {/* Edit button centered above date/time */}
          <div className="flex justify-center mb-1">
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
          {/* Date/time - editable */}
          <div className="flex items-center mb-1.5">
            <div className="flex-1" />
            <div className="flex items-center gap-2">
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
            <div className="flex-1" />
          </div>


          {/* Core activity centered */}
          <div className="flex items-center gap-1">
          <div className="flex-1">
          <div
            className="card"
            style={{ borderColor: 'var(--bg-base)', backgroundColor: 'var(--bg-base)' }}
            onBlur={(e) => {
              setTimeout(() => {
                if (!e.currentTarget.contains(document.activeElement)) flushMood();
              }, 100);
            }}
          >
            {/* Activity bubbles from config */}
            <div className="flex flex-wrap gap-1.5 mb-2 justify-center">
              {allTranslated.filter(a => !a.core).filter(a => editMode || !hiddenActivities.has(a.type)).map((activity) => (
                <span key={activity.type} className="relative inline-flex">
                  <button
                    onClick={() => {
                      if (editMode) {
                        toggleHideActivity(activity.type);
                      } else {
                        handleActivityClick(activity);
                      }
                    }}
                    className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                      editMode
                        ? hiddenActivities.has(activity.type) ? 'opacity-30 bg-themed-input border-themed text-themed-faint' : 'bg-themed-input border-themed text-themed-muted'
                        : completedTodayCounts.has(activity.type) ? 'bg-themed-accent border-themed-accent text-themed-accent' : 'bg-themed-input border-themed text-themed-muted hover:border-themed-medium'
                    }`}
                  >{activity.emoji} {activity.name}</button>
                  {editMode && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteActivity(activity.type);
                        setActivities(loadActivities());
                      }}
                      className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center text-[10px] leading-none"
                    >✕</button>
                  )}
                </span>
              ))}
              {editMode && (
                <button
                  onClick={() => setShowNewActivity(true)}
                  className="px-3 py-1.5 text-sm rounded-full border border-themed-accent text-themed-accent-solid hover:bg-themed-accent transition-colors"
                >+</button>
              )}
            </div>
            {/* Properties from nalada (stored + config fallback) */}
            {(
              <div className="flex flex-wrap gap-1.5 mb-2 justify-center">
                  {(() => {
                    void registryVersion;
                    // Always read fresh from storage to catch bubbled properties
                    const freshActivities = loadActivities();
                    const naladaActivity = freshActivities.find(a => a.core);
                    const storedProps = naladaActivity?.properties || [];
                    const configProps = getConfigProperties('nalada');
                    const activityProps = storedProps.length > 0 ? storedProps : configProps;
                    return activityProps;
                  })().slice().sort((a, b) => {
                    const aIsEmoji = /^\p{Emoji}/u.test(a);
                    const bIsEmoji = /^\p{Emoji}/u.test(b);
                    if (aIsEmoji !== bIsEmoji) return aIsEmoji ? 1 : -1;
                    return a.localeCompare(b, language);
                  }).filter(prop => editMode || !hiddenProperties.has(prop)).map((prop) => (
                    <span key={prop} className="relative inline-flex">
                      <button
                        onClick={() => editMode ? toggleHideProperty(prop) : toggleProperty(prop)}
                        className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                          editMode && hiddenProperties.has(prop)
                            ? 'opacity-30 border-themed bg-themed-input text-themed-faint'
                            : selectedProperties.has(prop)
                              ? 'bg-themed-accent border-themed-accent text-themed-accent font-medium'
                              : usedPropertiesInSession.has(prop)
                                ? 'bg-themed-accent border-themed-accent text-themed-accent'
                                : 'bg-themed-input border-themed text-themed-muted hover:border-themed-medium'
                        }`}
                      >
                        {prop}
                      </button>
                      {editMode && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            // Remove from core activity properties
                            const all = loadActivities();
                            const coreIdx = all.findIndex(a => a.core);
                            if (coreIdx >= 0 && all[coreIdx].properties?.includes(prop)) {
                              all[coreIdx] = { ...all[coreIdx], properties: all[coreIdx].properties!.filter(p => p !== prop) };
                              saveActivities(all);
                              markActivityModified(all[coreIdx].type);
                            }
                            setRegistryVersion(v => v + 1);
                          }}
                          className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center text-[10px] leading-none"
                        >✕</button>
                      )}
                    </span>
                  ))}
                  {editMode && (
                    <input type="text" value={newPropertyText} onChange={(e) => setNewPropertyText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const text = newPropertyText.trim(); if (text) {
                        const all = loadActivities(); const coreIdx = all.findIndex(a => a.core);
                        if (coreIdx >= 0) { const cp = all[coreIdx].properties || []; if (!cp.includes(text)) { all[coreIdx] = { ...all[coreIdx], properties: [...cp, text] }; saveActivities(all); markActivityModified(all[coreIdx].type); } }
                        setNewPropertyText(''); setRegistryVersion(v => v + 1);
                      } } }}
                      onBlur={() => { const text = newPropertyText.trim(); if (text) {
                        const all = loadActivities(); const coreIdx = all.findIndex(a => a.core);
                        if (coreIdx >= 0) { const cp = all[coreIdx].properties || []; if (!cp.includes(text)) { all[coreIdx] = { ...all[coreIdx], properties: [...cp, text] }; saveActivities(all); markActivityModified(all[coreIdx].type); } }
                        setNewPropertyText(''); setRegistryVersion(v => v + 1);
                      } }}
                      placeholder="+" className="w-20 px-3 py-1.5 text-sm rounded-full border border-dashed border-themed bg-themed-input text-themed-primary placeholder:text-themed-faint focus:outline-none focus:border-themed-accent" />
                  )}
                </div>
            )}
            {/* Core duration setting in edit mode */}
            {editMode && (
              <div className="flex justify-center mb-2">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-themed-faint">{language === 'cs' ? 'Délka' : 'Duration'}</label>
                  <input
                    type="number"
                    min="1"
                    max="120"
                    defaultValue={(() => {
                      const core = loadActivities().find(a => a.core);
                      return core?.defaultDuration ?? 1;
                    })()}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      if (val > 0) {
                        const all = loadActivities();
                        const cIdx = all.findIndex(a => a.core);
                        if (cIdx >= 0) {
                          all[cIdx] = { ...all[cIdx], defaultDuration: val };
                          saveActivities(all);
                          markActivityModified(all[cIdx].type);
                        }
                      }
                    }}
                    className="w-16 px-2 py-1 text-xs rounded-xl bg-themed-input border border-themed focus:outline-none focus:border-themed-accent text-themed-primary text-center"
                  />
                  <span className="text-xs text-themed-faint">m</span>
                </div>
              </div>
            )}
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
            {/* Session total + records */}
            {allTranslated.length > 0 && (
              <>
                {/* Session bubble (left, aligned to last row) + records (right) */}
                {(() => {
                  const todayEntry = getDayEntry(getTodayDate());
                  const todayActivities = todayEntry?.activities || [];
                  const coreActivity = allTranslated.find(a => a.core);
                  const rows: { key: string; emoji: string; total: number; totalMin: number; sessionCount: number }[] = [];
                  if (coreActivity) {
                    const coreRecords = todayActivities.filter(a => a.type === coreActivity.type);
                    let total = 0, totalMin = 0, sessionCount = 0;
                    coreRecords.forEach(r => {
                      total++;
                      totalMin += Math.round((r.actualDurationSeconds || 900) / 60);
                      if (new Date(r.completedAt || r.startedAt) >= new Date(sessionStart)) sessionCount++;
                    });
                    rows.push({ key: coreActivity.type, emoji: coreActivity.emoji, total, totalMin, sessionCount });
                  }
                  allTranslated.filter(a => !a.core).filter(a => !hiddenActivities.has(a.type)).forEach(activity => {
                    const total = totalCountPerActivity.get(activity.type) || 0;
                    const totalSecs = totalTimePerActivity.get(activity.type) || 0;
                    const totalMin = activity.durationMinutes ? Math.round(totalSecs / 60) : total;
                    const sessionCount = completedTodayCounts.get(activity.type) || 0;
                    rows.push({ key: activity.type, emoji: activity.emoji, total, totalMin, sessionCount });
                  });

                  const allDone = allTranslated.every(a => completedTodayCounts.has(a.type));
                  const ss = localStorage.getItem('pra_session_start') || '';
                  const sessionActivities = todayEntry?.activities.filter(act =>
                    new Date(act.completedAt || act.startedAt) >= new Date(ss)
                  ) || [];
                  const sessionTotal = sessionActivities.reduce((sum, act) => {
                    const secs = act.actualDurationSeconds || (act.durationMinutes ? act.durationMinutes * 60 : 60);
                    return sum + Math.round(secs / 60);
                  }, 0);

                  return (
                    <div className="flex items-end gap-3 mt-3">
                      {/* Session bubble - left, aligned to last record row */}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className={`text-sm px-3 py-1 rounded-full ${sessionTotal > 0 ? 'text-themed-accent-solid bg-themed-accent' : 'text-themed-faint bg-themed-input'}`}>
                          {sessionTotal >= 60 ? `${Math.floor(sessionTotal / 60)} h${sessionTotal % 60 > 0 ? ` ${sessionTotal % 60} m` : ''}` : `${sessionTotal} m`}
                        </span>
                        <button
                          onClick={() => {
                            flushMood();
                            const now = new Date().toISOString();
                            setSessionStart(now);
                            localStorage.setItem('pra_session_start', now);
                            setRefreshKey((k) => k + 1);
                          }}
                          className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${allDone ? '' : 'opacity-40'}`}
                          style={{ backgroundColor: allDone ? 'var(--accent-solid)' : 'var(--text-faint)' }}
                        >
                          <svg className="w-4 h-4" style={{ color: allDone ? 'var(--accent-text-on-solid)' : 'var(--bg-card)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                      </div>
                      {/* Records - right */}
                      <div className="flex flex-col space-y-1">
                        {rows.map(row => (
                          <div key={row.key} className="flex items-center gap-2">
                            <div className="flex items-center gap-2 flex-1 justify-end">
                              <span className="text-base">{row.key === coreActivity?.type ? coreActivity.emoji : row.emoji}</span>
                              {row.total > 0 && <span className="text-sm text-themed-faint">{row.total}</span>}
                              {row.totalMin > 0 && (
                                <span className="text-sm text-themed-faint">
                                  {row.totalMin >= 60 ? `${Math.floor(row.totalMin / 60)} h${row.totalMin % 60 > 0 ? ` ${row.totalMin % 60} m` : ''}` : `${row.totalMin} m`}
                                </span>
                              )}
                              {row.sessionCount > 0 && <span className="text-sm font-medium text-themed-accent-solid">{row.sessionCount}</span>}
                            </div>
                            <span className={`w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center ${row.sessionCount > 0 ? '' : 'opacity-40'}`}
                              style={{ backgroundColor: row.sessionCount > 0 ? 'var(--accent-solid)' : 'var(--text-faint)' }}>
                              <svg className="w-2.5 h-2.5" style={{ color: row.sessionCount > 0 ? 'var(--accent-text-on-solid)' : 'var(--bg-card)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </>
            )}
          </div>
          </div>
          </div>

        </section>

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
