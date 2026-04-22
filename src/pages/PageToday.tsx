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
import { uploadSync, downloadSync } from '../utils/sync';
import { loadConfig } from '../utils/config';
import { loadInfoActivity, applyConfigInfoActivity, InfoActivity } from '../utils/infoActivity';
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
  const syncConfigured = !!(localStorage.getItem('pra_sync_url') && localStorage.getItem('pra_sync_secret'));
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'busy' | 'success' | 'error'>('idle');
  const [downloadStatus, setDownloadStatus] = useState<'idle' | 'busy' | 'success' | 'error'>('idle');
  const [downloadErrorStatus, setDownloadErrorStatus] = useState<number | null>(null);

  const flushMoodRef = useRef<() => void>(() => {});
  const [infoAct, setInfoAct] = useState<InfoActivity>(() => loadInfoActivity());
  const [showInfoPopup, setShowInfoPopup] = useState(false);
  const showInfoPopupRef = useRef(false);

  // Instant activity property panel
  const [expandedActivityType, setExpandedActivityType] = useState<string | null>(null);
  const [selectedActivityProps, setSelectedActivityProps] = useState<Map<string, Set<string>>>(new Map());
  const selectedActivityPropsRef = useRef<Map<string, Set<string>>>(new Map());
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggeredRef = useRef(false);

  const handleUpload = useCallback(async () => {
    if (uploadStatus === 'busy') return;
    flushMoodRef.current(); // ensure pending session data is saved before backup
    setUploadStatus('busy');
    try {
      const theme = localStorage.getItem('pra_theme') || 'modern';
      const name = (() => { try { return JSON.parse(localStorage.getItem('pra_settings') || '{}').name || ''; } catch { return ''; } })();
      await uploadSync(language, theme, name);
      setUploadStatus('success');
      setTimeout(() => setUploadStatus('idle'), 2000);
    } catch {
      setUploadStatus('error');
      setTimeout(() => setUploadStatus('idle'), 3000);
    }
  }, [uploadStatus, language]);

  const handleDownload = useCallback(async () => {
    if (downloadStatus === 'busy') return;
    // Flush any pending session state before download so it can be preserved
    flushMoodRef.current();
    // Capture current session's nalada records (they may be lost if server data overwrites local history)
    const ss = localStorage.getItem('pra_session_start');
    const localSessionNalada = ss
      ? (getDayEntry(getTodayDate())?.activities.filter(
          a => a.type === 'nalada' && new Date(a.completedAt || a.startedAt) >= new Date(ss)
        ) || [])
      : [];
    setDownloadStatus('busy');
    setDownloadErrorStatus(null);
    try {
      await downloadSync();
      // Re-add any local session nalada records that weren't on the server
      if (localSessionNalada.length > 0) {
        const serverEntry = getDayEntry(getTodayDate());
        const serverIds = new Set(serverEntry?.activities.map(a => a.id) || []);
        localSessionNalada.forEach(record => {
          if (!serverIds.has(record.id)) addActivity(record);
        });
      }
      setDownloadStatus('success');
      setTimeout(() => { window.scrollTo(0, 0); window.location.reload(); }, 800);
    } catch (e) {
      const status = (e as { status?: number }).status ?? null;
      setDownloadErrorStatus(status);
      setDownloadStatus('error');
      setTimeout(() => { setDownloadStatus('idle'); setDownloadErrorStatus(null); }, 5000);
    }
  }, [downloadStatus]);
  const [registryVersion, setRegistryVersion] = useState(0);
  // Re-render once config finishes loading (it's async, app renders before it resolves)
  // Also refresh activities: on first render mergeWithConfig runs before config is cached
  // and may overwrite config-based activities (e.g. rozjimani) with hardcoded defaults
  useEffect(() => {
    loadConfig().then((cfg) => {
      if (cfg.infoActivity) applyConfigInfoActivity(cfg.infoActivity);
      setActivities(loadActivities());
      setInfoAct(loadInfoActivity());
      setRegistryVersion(v => v + 1);
    });
  }, [language]);

  // Reload info activity when page becomes visible (user may have edited it on Info page)
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') setInfoAct(loadInfoActivity()); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);
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
  const resizeTextarea = () => {
    if (moodTextareaRef.current) {
      moodTextareaRef.current.style.height = 'auto';
      moodTextareaRef.current.style.height = moodTextareaRef.current.scrollHeight + 'px';
    }
  };
  const toggleProperty = (prop: string) => {
    setSelectedProperties(prev => {
      const next = new Set(prev);
      if (next.has(prop)) {
        next.delete(prop);
        const lines = moodCommentRef.current.split('\n');
        setMoodCommentSync(lines.filter(l => l.trim() !== prop.trim()).join('\n').trimStart());
      } else {
        next.add(prop);
        const current = moodCommentRef.current.trimEnd();
        setMoodCommentSync(current ? current + '\n' + prop : prop);
      }
      selectedPropertiesRef.current = next;
      setTimeout(resizeTextarea, 0);
      return next;
    });
  };


  const updateCommentForActivity = useCallback((emoji: string, name: string, props: Set<string>) => {
    const prefix = `${emoji} ${name}`;
    const fragment = props.size > 0 ? `${prefix} - ${[...props].join(', ')}` : '';
    const lines = moodCommentRef.current.split('\n');
    const idx = lines.findIndex(l => l.startsWith(prefix));
    if (idx >= 0) {
      if (fragment) lines[idx] = fragment;
      else lines.splice(idx, 1);
    } else if (fragment) {
      lines.push(fragment);
    }
    setMoodCommentSync(lines.filter(Boolean).join('\n'));
    setTimeout(resizeTextarea, 0);
  }, []);

  const toggleActivityProp = useCallback((activity: ActivityDefinition, prop: string) => {
    setSelectedActivityProps(prev => {
      const next = new Map(prev);
      const props = new Set(next.get(activity.type) || []);
      if (props.has(prop)) props.delete(prop); else props.add(prop);
      if (props.size === 0) next.delete(activity.type); else next.set(activity.type, props);
      selectedActivityPropsRef.current = next;
      updateCommentForActivity(activity.emoji, activity.name, props);
      return next;
    });
  }, [updateCommentForActivity]);

  const flushMood = useCallback(() => {
    const r = moodRatingRef.current;
    const c = moodCommentRef.current;
    const props = [...selectedPropertiesRef.current];
    const celebrate = showInfoPopupRef.current;
    if (celebrate) {
      setShowInfoPopup(false);
      showInfoPopupRef.current = false;
    }
    if (!r && !c.trim() && props.length === 0) {
      if (celebrate) setTimeout(() => window.dispatchEvent(new Event('pra-celebrate')), 50);
      return;
    }
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
    selectedActivityPropsRef.current = new Map();
    setSelectedActivityProps(new Map());
    setExpandedActivityType(null);

    setCustomTimeSync(null);
    if (moodTextareaRef.current) {
      moodTextareaRef.current.style.height = 'auto';
    }

    if (celebrate) {
      setTimeout(() => window.dispatchEvent(new Event('pra-celebrate')), 50);
    }

    setRefreshKey((k) => k + 1);
  }, []);
  flushMoodRef.current = flushMood;

  // Flush mood on page navigation, tab hide, or page reload/close
  useEffect(() => {
    const handleBeforeNav = () => flushMood();
    window.addEventListener('pra-flush-mood', handleBeforeNav);
    const handleVisibility = () => { if (document.hidden) flushMood(); };
    document.addEventListener('visibilitychange', handleVisibility);
    const handleBeforeUnload = () => flushMood();
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('pra-flush-mood', handleBeforeNav);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('beforeunload', handleBeforeUnload);
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

  // Core properties used in current session (accent border after flush)
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
    <div className="page-container min-h-screen flex flex-col">
      <header className="mb-1.5">
        <h1 className="font-serif text-3xl text-themed-primary">{t.today.title}</h1>
      </header>
      <section className="flex-1 flex flex-col justify-center">
          {/* Edit + Sync buttons centered */}
          <div className="flex justify-center items-center gap-3 mb-1">
            <button
              onClick={() => setEditMode(!editMode)}
              className="p-1 transition-colors"
              style={{ color: editMode ? 'var(--accent-solid)' : 'var(--text-faint)' }}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            {syncConfigured && (<>
              <button
                onClick={handleUpload}
                disabled={uploadStatus === 'busy'}
                className="p-1 transition-colors disabled:opacity-40"
                style={{ color: uploadStatus === 'error' ? '#ef4444' : uploadStatus === 'success' ? 'var(--accent-solid)' : 'var(--text-faint)' }}
                title={language === 'cs' ? 'Nahrát na server' : 'Upload to server'}
              >
                <svg className={`w-5 h-5${uploadStatus === 'busy' ? ' animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {uploadStatus === 'success'
                    ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    : uploadStatus === 'error'
                      ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      : uploadStatus === 'busy'
                        ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12a8 8 0 018-8v4m0-4a8 8 0 010 16v-4m0 4" />
                        : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />}
                </svg>
              </button>
              <button
                onClick={handleDownload}
                disabled={downloadStatus === 'busy'}
                className="p-1 transition-colors disabled:opacity-40"
                style={{ color: downloadStatus === 'error' ? '#ef4444' : downloadStatus === 'success' ? 'var(--accent-solid)' : 'var(--text-faint)' }}
                title={language === 'cs' ? 'Stáhnout ze serveru' : 'Download from server'}
              >
                <svg className={`w-5 h-5${downloadStatus === 'busy' ? ' animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {downloadStatus === 'success'
                    ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    : downloadStatus === 'error'
                      ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      : downloadStatus === 'busy'
                        ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12a8 8 0 018-8v4m0-4a8 8 0 010 16v-4m0 4" />
                        : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />}
                </svg>
              </button>
            </>)}
          </div>
          {downloadStatus === 'error' && (
            <div className="text-center text-xs mb-1" style={{ color: '#ef4444' }}>
              {downloadErrorStatus === 404
                ? (language === 'cs' ? 'Server nemá žádná data — nejdříve nahrajte (⬆)' : 'No data on server — upload first (⬆)')
                : downloadErrorStatus === 401
                  ? (language === 'cs' ? 'Chybný secret' : 'Wrong secret')
                  : (language === 'cs' ? `Chyba serveru ${downloadErrorStatus ?? ''}` : `Server error ${downloadErrorStatus ?? ''}`)}
            </div>
          )}
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
                className="text-sm text-themed-faint bg-transparent border-none focus:outline-none focus:text-themed-muted cursor-pointer"
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
                className="text-sm text-themed-faint bg-transparent border-none focus:outline-none focus:text-themed-muted cursor-pointer"
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
              {allTranslated.filter(a => !a.core).filter(a => editMode || !hiddenActivities.has(a.type)).map((activity) => {
                const isInstant = activity.durationMinutes === null;
                const isExpanded = expandedActivityType === activity.type;
                return (
                  <span key={activity.type} className="relative inline-flex">
                    <button
                      onClick={() => {
                        if (longPressTriggeredRef.current) return;
                        if (editMode) { toggleHideActivity(activity.type); return; }
                        if (!isInstant) { flushMood(); setActiveActivity(activity); return; }
                        setExpandedActivityType(prev => prev === activity.type ? null : activity.type);
                      }}
                      onPointerDown={() => {
                        if (editMode) return;
                        longPressTriggeredRef.current = false;
                        longPressTimerRef.current = setTimeout(() => {
                          longPressTriggeredRef.current = true;
                          const original = activities.find(a => a.type === activity.type);
                          setEditingActivity(original || activity);
                          setExpandedActivityType(null);
                        }, 600);
                      }}
                      onPointerUp={() => { if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; } }}
                      onPointerLeave={() => { if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; } }}
                      className={`px-3 py-1.5 text-sm rounded-full border transition-colors select-none ${
                        editMode
                          ? hiddenActivities.has(activity.type) ? 'opacity-30 bg-themed-input border-themed text-themed-faint' : 'bg-themed-input border-themed text-themed-muted'
                          : isExpanded
                            ? 'bg-themed-accent border-themed-accent text-themed-accent font-medium'
                            : completedTodayCounts.has(activity.type)
                              ? 'bg-transparent border-themed-accent text-themed-accent'
                              : 'bg-themed-input border-themed text-themed-muted hover:border-themed-medium'
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
                );
              })}
              {editMode && (
                <button
                  onClick={() => setShowNewActivity(true)}
                  className="px-3 py-1.5 text-sm rounded-full border border-themed-accent text-themed-accent-solid hover:bg-themed-accent transition-colors"
                >+</button>
              )}
            </div>
            {/* Instant activity property panel */}
            {expandedActivityType && !editMode && (() => {
              const act = allTranslated.find(a => a.type === expandedActivityType);
              if (!act?.properties?.length) return null;
              const selProps = selectedActivityProps.get(expandedActivityType) || new Set<string>();
              return (
                <div className="flex flex-wrap gap-1.5 mb-2 justify-center px-1">
                  {act.properties.map(prop => (
                    <button
                      key={prop}
                      onClick={() => toggleActivityProp(act, prop)}
                      className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                        selProps.has(prop)
                          ? 'bg-themed-accent border-themed-accent text-themed-accent font-medium'
                          : 'bg-themed-input border-themed text-themed-muted hover:border-themed-medium'
                      }`}
                    >{prop}</button>
                  ))}
                </div>
              );
            })()}
            {/* Separator */}
            <hr className="border-t border-themed mx-4 mb-2" />
            {/* Info activity pill */}
            {(infoAct.emoji || infoAct.name) && (
              <div className="mb-2">
                {showInfoPopup && infoAct.comment && (
                  <div className="mb-2 text-sm text-themed-secondary leading-relaxed whitespace-pre-line text-center">
                    {infoAct.comment}
                  </div>
                )}
                <div className="flex justify-center">
                  <button
                    onClick={() => {
                      const willOpen = !showInfoPopup;
                      setShowInfoPopup(willOpen);
                      showInfoPopupRef.current = willOpen;
                      if (willOpen && infoAct.name) {
                        const current = moodCommentRef.current.trimEnd();
                        setMoodCommentSync(current ? current + '\n' + infoAct.name : infoAct.name);
                        setTimeout(resizeTextarea, 0);
                      }
                    }}
                    className="px-3 py-1.5 text-sm rounded-full border border-themed bg-themed-input text-themed-muted hover:border-themed-medium transition-colors"
                  >
                    {infoAct.emoji}{infoAct.emoji && infoAct.name ? ' ' : ''}{infoAct.name}
                  </button>
                </div>
              </div>
            )}
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
                                ? 'bg-transparent border-themed-accent text-themed-accent'
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

                  const fmtMin = (m: number) => m >= 60 ? `${Math.floor(m / 60)} h${m % 60 > 0 ? ` ${m % 60} m` : ''}` : `${m} m`;
                  rows.sort((a, b) => fmtMin(b.totalMin).length - fmtMin(a.totalMin).length || b.totalMin - a.totalMin);

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
                        <span className={`text-sm px-3 py-1 ${sessionTotal > 0 ? 'text-themed-accent-solid' : 'text-themed-faint'}`}>
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
