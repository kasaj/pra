import { useMemo, useState, useCallback, useEffect } from 'react';
import { loadAllData, deleteActivitiesByIds, updateActivityById, findActivityById, createLinkedActivity } from '../utils/storage';
import { getChartColors } from '../utils/theme';
import { getActivityByType, getTranslatedActivity } from '../utils/activities';
import { useLanguage } from '../i18n';
import { Activity, ActivityComment, DayEntry } from '../types';
import { loadMoodScale, getMoodEmoji } from '../utils/moodScale';
import ActivityFlow from '../components/ActivityFlow';
import {
  ComposedChart,
  Area,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';


/** Compute avg rating from comments of activity + all linked activities */

function getActivityScore(a: Activity): number {
  const comments = getActivityComments(a);
  return (a.linkedActivityIds?.length || 0) + (a.linkedFromId ? 1 : 0) + comments.length;
}

function ActivityCalendar({ data, language, selectedDate, onDayClick }: {
  data: DayEntry[];
  language: string;
  selectedDate: string | null;
  onDayClick: (date: string | null) => void;
}) {
  const { t } = useLanguage();
  const [viewDate, setViewDate] = useState(() => new Date());

  const activityMap = useMemo(() => {
    const map = new Map<string, DayEntry>();
    data.forEach((d) => map.set(d.date, d));
    return map;
  }, [data]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = (firstDay.getDay() + 6) % 7; // Monday = 0

  const days: (number | null)[] = [];
  for (let i = 0; i < startPad; i++) days.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) days.push(d);

  const monthName = viewDate.toLocaleDateString(language === 'cs' ? 'cs-CZ' : 'en-US', { month: 'long', year: 'numeric' });
  const weekDays = language === 'cs'
    ? ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne']
    : ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

  const todayStr = new Date().toISOString().split('T')[0];

  const handlePrev = () => setViewDate(new Date(year, month - 1, 1));
  const handleNext = () => setViewDate(new Date(year, month + 1, 1));

  const handleDayClick = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    // Toggle: click same date again = show all
    onDayClick(selectedDate === dateStr ? null : dateStr);
  };

  return (
    <section className="mb-6">
      <h2 className="font-serif text-base text-themed-secondary mb-3">{t.time.calendarTitle}</h2>
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <button onClick={handlePrev} className="w-8 h-8 rounded-full bg-themed-input flex items-center justify-center text-themed-muted hover:text-themed-accent-solid transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="font-serif text-themed-primary capitalize">{monthName}</span>
          <button onClick={handleNext} className="w-8 h-8 rounded-full bg-themed-input flex items-center justify-center text-themed-muted hover:text-themed-accent-solid transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center">
          {weekDays.map((d) => (
            <div key={d} className="text-xs text-themed-faint py-1">{d}</div>
          ))}
          {days.map((day, i) => {
            if (day === null) return <div key={`e-${i}`} />;
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const entry = activityMap.get(dateStr);
            const count = entry?.activities.length || 0;
            const isToday = dateStr === todayStr;
            const isSelected = selectedDate === dateStr;

            // Color intensity based on activity count
            let bgStyle: React.CSSProperties = {};
            if (count > 0) {
              const opacity = Math.min(0.2 + count * 0.15, 0.9);
              bgStyle = { backgroundColor: `color-mix(in srgb, var(--accent-solid) ${Math.round(opacity * 100)}%, transparent)` };
            }

            return (
              <button
                key={day}
                onClick={() => handleDayClick(day)}
                className={`aspect-square rounded-lg text-sm flex items-center justify-center transition-colors relative ${
                  isSelected ? 'ring-2 ring-offset-1' : ''
                } ${isToday ? 'font-bold' : ''} ${
                  count > 0 ? 'text-themed-primary' : 'text-themed-faint'
                }`}
                style={{
                  ...bgStyle,
                  ...(isSelected ? { ringColor: 'var(--accent-solid)' } : {}),
                }}
              >
                {day}
                {isToday && (
                  <span className="absolute bottom-0.5 w-1 h-1 rounded-full" style={{ backgroundColor: 'var(--accent-solid)' }} />
                )}
              </button>
            );
          })}
        </div>

      </div>
    </section>
  );
}

function getDayAvgMoodEmoji(day: DayEntry): string | null {
  const ratings: number[] = [];
  day.activities.forEach((a) => {
    const comments = getActivityComments(a);
    const commentRatings = comments.filter(c => c.rating != null).map(c => c.rating!);
    if (commentRatings.length > 0) {
      ratings.push(...commentRatings);
    } else {
      const r = a.ratingAfter ?? a.rating;
      if (r != null) ratings.push(r);
    }
  });
  if (ratings.length === 0) return null;
  const avg = ratings.reduce((s, r) => s + r, 0) / ratings.length;
  return getMoodEmoji(avg);
}

function formatDateFull(dateStr: string, lang: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(lang === 'cs' ? 'cs-CZ' : 'en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function formatTime(isoStr: string, lang: string): string {
  const date = new Date(isoStr);
  return date.toLocaleTimeString(lang === 'cs' ? 'cs-CZ' : 'en-US', { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

/** Get all comments from an activity (including legacy note fields) */
function getActivityComments(activity: Activity): ActivityComment[] {
  if (activity.comments && activity.comments.length > 0) return activity.comments;
  // Migrate legacy notes
  const comments: ActivityComment[] = [];
  const isTimed = activity.durationMinutes !== null;
  if (isTimed) {
    if (activity.noteBefore) {
      comments.push({ id: 'legacy-before', text: activity.noteBefore, createdAt: activity.startedAt });
    }
    if (activity.noteAfter && activity.noteAfter !== activity.noteBefore) {
      comments.push({ id: 'legacy-after', text: activity.noteAfter, createdAt: activity.completedAt });
    }
  } else if (activity.note) {
    comments.push({ id: 'legacy-note', text: activity.note, createdAt: activity.completedAt });
  }
  return comments;
}

function generateCommentId(): string {
  return `c-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
}

interface ActivityRowProps {
  activity: Activity;
  lang: string;
  selected: boolean;
  onToggleSelect: () => void;
  onClickEdit: () => void;
  onCreateLinked: () => void;
  onNavigate: (id: string) => void;
  t: ReturnType<typeof useLanguage>['t'];
}

function ActivityRow({ activity, lang, selected, onToggleSelect, onClickEdit, onCreateLinked, onNavigate, t }: ActivityRowProps) {
  const rawDef = getActivityByType(activity.type);
  const def = rawDef ? getTranslatedActivity(rawDef, t) : rawDef;
  const actualTime = activity.actualDurationSeconds
    ? formatDuration(activity.actualDurationSeconds)
    : activity.durationMinutes
      ? `${activity.durationMinutes}m`
      : null;

  const comments = getActivityComments(activity);
  const lastTwo = comments.slice(-2);
  const linkCount = (activity.linkedActivityIds?.length || 0) + (activity.linkedFromId ? 1 : 0) + comments.length;

  return (
    <div className="py-2 flex items-start gap-2">
      <button
        onClick={onToggleSelect}
        className={`mt-1 w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
          selected
            ? 'bg-themed-accent border-themed-accent'
            : 'border-themed-medium hover:border-themed-accent'
        }`}
      >
        {selected && (
          <svg className="w-2.5 h-2.5 text-themed-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>

      <div className="flex-1 min-w-0 cursor-pointer" onClick={onClickEdit}>
        {/* Row 1: time left, right: linkCount emoji avgEmoji */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-themed-faint text-xs">{formatTime(activity.startedAt, lang)}</span>
            <span className="text-sm">{def?.emoji}</span>
            {actualTime && <span className="text-themed-faint text-xs">{actualTime}</span>}
          </div>
          <div className="flex items-center gap-2">
            {linkCount > 0 && (
              <span className="text-xs text-themed-faint">
                {linkCount}
              </span>
            )}
            {activity.linkedFromId && (
              <button
                onClick={(e) => { e.stopPropagation(); onNavigate(activity.linkedFromId!); }}
                className="w-4 h-4 rounded-full bg-themed-input flex items-center justify-center text-themed-muted hover:text-themed-accent-solid transition-colors"
              >
                <svg className="w-2 h-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            {activity.linkedActivityIds && activity.linkedActivityIds.length > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); onNavigate(activity.linkedActivityIds![activity.linkedActivityIds!.length - 1]); }}
                className="w-4 h-4 rounded-full bg-themed-input flex items-center justify-center text-themed-muted hover:text-themed-accent-solid transition-colors"
              >
                <svg className="w-2 h-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onCreateLinked(); }}
              className="w-4 h-4 rounded-full bg-themed-input flex items-center justify-center text-themed-faint hover:text-themed-accent-solid transition-colors"
            >
              <svg className="w-2 h-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        </div>

        {/* Comment rows: time left, mood scale right */}
        {lastTwo.map((c) => (
          <div key={`${c.id}-${c.rating || 0}`} className="flex items-center justify-between mt-0.5">
            <div className="flex items-center gap-1.5 text-sm min-w-0">
              <span className="text-themed-faint text-xs flex-shrink-0">{formatTime(c.updatedAt || c.createdAt, lang)}</span>
              {c.text && <span className="text-themed-muted italic truncate">{c.text}</span>}
            </div>
            {c.rating != null && (
              <div className="flex gap-px flex-shrink-0 ml-1" style={{ fontSize: '0.55rem' }}>
                {loadMoodScale().map(({ value: v, emoji: e }) => (
                  <span key={v} className={v === c.rating ? 'opacity-100' : 'grayscale opacity-30'}>{e}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PageTime() {
  const { t, language } = useLanguage();
  const [data, setData] = useState(() => loadAllData());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [trendRange, setTrendRange] = useState<'day' | 'week' | 'month'>('day');
  const [recordSort, setRecordSort] = useState<'date' | 'score'>('date');
  const [calendarDate, setCalendarDate] = useState<string | null>(null); // null = all, string = YYYY-MM-DD filter
  const [editingRecord, setEditingRecord] = useState<Activity | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // Tick every second for elapsed clock + update on tab focus
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    const onVisible = () => { if (document.visibilityState === 'visible') { setNow(Date.now()); setData(loadAllData()); } };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', onVisible); };
  }, []);

  // Summary statistics
  const summaryStats = useMemo(() => {
    let totalActivities = 0;
    let totalSeconds = 0;
    let todayActivities = 0;
    let todaySeconds = 0;
    const todayStr = new Date().toISOString().split('T')[0];

    data.forEach((day) => {
      day.activities.forEach((activity) => {
        totalActivities++;
        const secs = activity.actualDurationSeconds || (activity.durationMinutes ? activity.durationMinutes * 60 : 60);
        totalSeconds += secs;
        if (day.date === todayStr) {
          todayActivities++;
          todaySeconds += secs;
        }
      });
    });

    // Overall average mood from all comments
    const allMoodRatings: number[] = [];
    data.forEach((day) => {
      day.activities.forEach((a) => {
        const comments = getActivityComments(a);
        const commentRatings = comments.filter(c => c.rating != null).map(c => c.rating!);
        if (commentRatings.length > 0) {
          allMoodRatings.push(...commentRatings);
        } else {
          const r = a.ratingAfter ?? a.rating;
          if (r != null) allMoodRatings.push(r);
        }
      });
    });
    const overallMood = allMoodRatings.length > 0
      ? Math.round((allMoodRatings.reduce((s, r) => s + r, 0) / allMoodRatings.length) * 10) / 10
      : 4; // default 😐

    const toHM = (s: number) => ({ hours: Math.floor(s / 3600), minutes: Math.floor((s % 3600) / 60) });
    const firstDate = data.length > 0 ? data[data.length - 1].date : null;

    return {
      totalActivities, totalSeconds, ...toHM(totalSeconds),
      todayActivities, today: toHM(todaySeconds),
      overallMood,
      firstDate,
    };
  }, [data]);

  // Elapsed time since first activity (ticking)
  const elapsed = useMemo(() => {
    if (!summaryStats.firstDate) return { display: '0:00:00:00', percent: '0' };
    const firstMs = new Date(summaryStats.firstDate).getTime();
    const diffSec = Math.floor((now - firstMs) / 1000);
    const days = Math.floor(diffSec / 86400);
    const hrs = Math.floor((diffSec % 86400) / 3600);
    const mins = Math.floor((diffSec % 3600) / 60);
    const secs = diffSec % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');
    const display = `${days}:${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
    const wakingSec = (days + 1) * 16 * 3600;
    const percent = wakingSec > 0
      ? (summaryStats.totalSeconds / wakingSec * 100).toFixed(1)
      : '0';
    return { display, percent };
  }, [summaryStats.firstDate, summaryStats.totalSeconds, now]);

  // Trend data (day/week/month) - non-cumulative per period
  const trendData = useMemo(() => {
    const result: Array<{ day: string; avgRating: number | null; count: number; minutes: number }> = [];

    const computeStats = (activities: Activity[]) => {
      const count = activities.length;
      let totalSecs = 0;
      const ratings: number[] = [];
      activities.forEach((a) => {
        totalSecs += a.actualDurationSeconds || (a.durationMinutes ? a.durationMinutes * 60 : 60);
        // Comment-based ratings first
        const comments = getActivityComments(a);
        const commentRatings = comments.filter(c => c.rating != null).map(c => c.rating!);
        if (commentRatings.length > 0) {
          ratings.push(...commentRatings);
        } else {
          // Fallback to legacy
          const r = a.ratingAfter ?? a.rating;
          if (r != null) ratings.push(r);
        }
      });
      const avgRating = ratings.length > 0
        ? Math.round((ratings.reduce((s, r) => s + r, 0) / ratings.length) * 10) / 10
        : null;
      return { count, avgRating, minutes: Math.round(totalSecs / 60) };
    };

    if (trendRange === 'day') {
      // Today: group by hour
      const todayStr = new Date().toISOString().split('T')[0];
      const dayEntry = data.find((d) => d.date === todayStr);
      for (let h = 5; h <= 23; h++) {
        const hourActivities = dayEntry?.activities.filter((a) => {
          const hour = new Date(a.startedAt).getHours();
          return hour === h;
        }) || [];
        const stats = computeStats(hourActivities);
        result.push({ day: `${h}:00`, ...stats });
      }
    } else {
      const today = new Date();
      const days = trendRange === 'week' ? 7 : 30;
      const start = new Date(today);
      start.setDate(start.getDate() - (days - 1));

      for (let i = 0; i < days; i++) {
        const date = new Date(start);
        date.setDate(start.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];
        const dayEntry = data.find((d) => d.date === dateStr);

        const stats = dayEntry ? computeStats(dayEntry.activities) : { count: 0, avgRating: null, minutes: 0 };

        const dayName = trendRange === 'week'
          ? date.toLocaleDateString(language === 'cs' ? 'cs-CZ' : 'en-US', { weekday: 'short' })
          : `${date.getDate()}.${date.getMonth() + 1}`;
        result.push({ day: dayName, ...stats });
      }
    }

    return result;
  }, [data, language, trendRange]);


  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleUpdateActivity = useCallback((id: string, updates: Partial<Activity>) => {
    updateActivityById(id, updates);
    setData(loadAllData());
  }, []);

  const handleDeleteSelected = useCallback(() => {
    if (selectedIds.size === 0) return;
    deleteActivitiesByIds(Array.from(selectedIds));
    setData(loadAllData());
    setSelectedIds(new Set());
  }, [selectedIds]);

  // Flat list of all activities sorted by time (newest first)
  const allActivitiesFlat = useMemo(() => {
    const flat: Activity[] = [];
    data.forEach((day) => flat.push(...day.activities));
    flat.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
    return flat;
  }, [data]);

  const allActivityIds = useMemo(() => allActivitiesFlat.map((a) => a.id), [allActivitiesFlat]);

  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === allActivityIds.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(allActivityIds));
  }, [selectedIds.size, allActivityIds]);

  const handleCreateLinked = useCallback((originalActivity: Activity) => {
    const newActivity = createLinkedActivity(originalActivity.id, originalActivity.type);
    setData(loadAllData());
    setEditingRecord(newActivity);
  }, []);

  const handleNavigate = useCallback((targetId: string) => {
    const found = findActivityById(targetId);
    if (found) setEditingRecord(found.activity);
  }, []);

  const handleNavigatePrev = useCallback(() => {
    if (!editingRecord) return;
    const idx = allActivitiesFlat.findIndex((a) => a.id === editingRecord.id);
    if (idx > 0) setEditingRecord(allActivitiesFlat[idx - 1]);
  }, [editingRecord, allActivitiesFlat]);

  const handleNavigateNext = useCallback(() => {
    if (!editingRecord) return;
    const idx = allActivitiesFlat.findIndex((a) => a.id === editingRecord.id);
    if (idx < allActivitiesFlat.length - 1) setEditingRecord(allActivitiesFlat[idx + 1]);
  }, [editingRecord, allActivitiesFlat]);


  const handleAddComment = useCallback((activityId: string, text: string) => {
    const found = findActivityById(activityId);
    if (!found) return;
    const existing = found.activity.comments || getActivityComments(found.activity);
    const newComment: ActivityComment = {
      id: generateCommentId(),
      text,
      createdAt: new Date().toISOString(),
    };
    updateActivityById(activityId, { comments: [newComment, ...existing] });
    setData(loadAllData());
  }, []);

  const handleUpdateComment = useCallback((activityId: string, commentId: string, text: string) => {
    const found = findActivityById(activityId);
    if (!found) return;
    const existing = found.activity.comments || getActivityComments(found.activity);
    const updated = existing.map((c) =>
      c.id === commentId ? { ...c, text, updatedAt: new Date().toISOString() } : c
    );
    updateActivityById(activityId, { comments: updated });
    setData(loadAllData());
  }, []);

  if (data.length === 0) {
    return (
      <div className="page-container">
        <header className="mb-8">
          <h1 className="font-serif text-3xl text-themed-primary">{t.time.title}</h1>
          <p className="text-themed-faint mt-2">{t.time.subtitle}</p>
        </header>

        <div className="card text-center py-12">
          <p className="text-themed-faint">{t.time.noRecords}</p>
          <p className="text-themed-faint text-sm mt-2">{t.time.startHint}</p>
        </div>
      </div>
    );
  }

  const colors = getChartColors();

  return (
    <div className="page-container">
      <header className="mb-6">
        <h1 className="font-serif text-3xl text-themed-primary">{t.time.title}</h1>
        <p className="text-themed-faint mt-1">{t.time.subtitle}</p>
      </header>

      {/* Trend Section */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-serif text-base text-themed-secondary">
            {trendRange === 'day' ? t.time.dailyTrend : trendRange === 'week' ? t.time.weeklyTrend : t.time.monthlyTrend}
          </h2>
          <div className="flex gap-1 bg-themed-input rounded-lg p-0.5">
            {(['day', 'week', 'month'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setTrendRange(r)}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  trendRange === r
                    ? 'bg-themed-card text-themed-accent shadow-sm'
                    : 'text-themed-faint hover:text-themed-secondary'
                }`}
              >
                {r === 'day' ? t.time.trendDay : r === 'week' ? t.time.trendWeek : t.time.trendMonth}
              </button>
            ))}
          </div>
        </div>
        <div className="card">
          <ResponsiveContainer width="100%" height={trendRange === 'month' ? 200 : 180}>
            <ComposedChart data={trendData} margin={{ top: 15, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="moodGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colors.barHigh} stopOpacity={0.4} />
                  <stop offset="50%" stopColor={colors.barMid} stopOpacity={0.15} />
                  <stop offset="100%" stopColor={colors.barLow} stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="day"
                tick={{ fontSize: trendRange === 'month' ? 9 : trendRange === 'day' ? 9 : 11, fill: colors.tick }}
                axisLine={false}
                tickLine={false}
                interval={trendRange === 'month' ? 4 : trendRange === 'day' ? 1 : 0}
              />
              <YAxis
                yAxisId="count"
                hide
              />
              <YAxis
                yAxisId="rating"
                domain={[1, 7]}
                ticks={[1, 4, 7]}
                tick={({ x, y, payload }: { x: number; y: number; payload: { value: number } }) => {
                  const scale = loadMoodScale();
                  const item = scale.find(s => s.value === payload.value);
                  return (
                    <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={12}>
                      {item?.emoji || ''}
                    </text>
                  );
                }}
                axisLine={false}
                tickLine={false}
                width={28}
                orientation="left"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: colors.tooltipBg,
                  border: `1px solid ${colors.tooltipBorder}`,
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                formatter={(value: number, name: string) => {
                  if (name === 'avgRating') {
                    const emoji = value ? getMoodEmoji(value) : '-';
                    return [`${emoji} ${value || '-'}`, t.time.rating];
                  }
                  return [value, language === 'cs' ? 'Počet' : 'Count'];
                }}
              />
              <Bar
                yAxisId="count"
                dataKey="count"
                fill={colors.barEmpty}
                opacity={0.3}
                radius={[2, 2, 0, 0]}
                maxBarSize={trendRange === 'month' ? 6 : trendRange === 'week' ? 24 : 16}
              />
              <Area
                yAxisId="rating"
                type="monotone"
                dataKey="avgRating"
                stroke={colors.barHigh}
                strokeWidth={2.5}
                fill="url(#moodGradient)"
                connectNulls
                dot={false}
                activeDot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-4 mt-2 text-xs text-themed-faint">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm opacity-30" style={{ backgroundColor: colors.barEmpty }} />
              {language === 'cs' ? 'Počet' : 'Count'}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-4 h-2 rounded-sm" style={{ background: `linear-gradient(to top, ${colors.barLow}33, ${colors.barHigh}66)` }} />
              {t.time.rating}
            </span>
          </div>
        </div>
      </section>

      {/* Records */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-serif text-base text-themed-secondary">{t.time.recordsTitle}</h2>
          <div className="flex items-center gap-2">
            <div className="flex gap-1 bg-themed-input rounded-lg p-0.5">
              {(['date', 'score'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setRecordSort(s)}
                  className={`px-2 py-1 text-xs rounded-md transition-colors ${
                    recordSort === s
                      ? 'bg-themed-card text-themed-accent shadow-sm'
                      : 'text-themed-faint hover:text-themed-secondary'
                  }`}
                >
                  {s === 'date' ? t.time.sortDate : t.time.sortScore}
                </button>
              ))}
            </div>
            <button
              onClick={handleSelectAll}
              className="px-3 py-1.5 text-sm rounded-xl bg-themed-input text-themed-muted
                       hover:bg-themed-input transition-colors"
            >
              {selectedIds.size === allActivityIds.length ? t.time.deselectAll : t.time.selectAll}
            </button>
            {selectedIds.size > 0 && (
              <button
                onClick={handleDeleteSelected}
                className="px-3 py-1.5 text-sm rounded-xl bg-themed-warn text-themed-warn
                         hover:bg-themed-warn transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                {t.time.deleteSelected} ({selectedIds.size})
              </button>
            )}
          </div>
        </div>

        <div className="card">
          {recordSort === 'date' ? (
            // Sort by date (grouped by day), filtered by calendar
            (calendarDate ? data.filter(d => d.date === calendarDate) : data.slice(0, 10)).map((day, dayIndex) => (
              <div key={day.date}>
                <div className={`py-2 px-1 text-sm font-medium text-themed-muted capitalize flex items-center justify-between ${
                  dayIndex > 0 ? 'border-t-2 border-themed mt-2' : ''
                }`}>
                  <span>{formatDateFull(day.date, language)}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-xs text-themed-faint">{t.time.activitiesTotal}: {day.activities.length}</span>
                    {getDayAvgMoodEmoji(day) && <span>{getDayAvgMoodEmoji(day)}</span>}
                  </span>
                </div>
                {day.activities
                  .slice()
                  .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
                  .map((activity) => (
                    <ActivityRow
                      key={activity.id}
                      activity={activity}

                      lang={language}
                      selected={selectedIds.has(activity.id)}
                      onToggleSelect={() => toggleSelect(activity.id)}
                      onClickEdit={() => setEditingRecord(activity)}
                      onCreateLinked={() => handleCreateLinked(activity)}
                      onNavigate={handleNavigate}
                      t={t}
                    />
                  ))}
              </div>
            ))
          ) : (
            // Sort by score (flat list, highest first), filtered by calendar
            (calendarDate
              ? allActivitiesFlat.filter(a => a.startedAt.startsWith(calendarDate))
              : allActivitiesFlat
            )
              .slice()
              .sort((a, b) => getActivityScore(b) - getActivityScore(a))
              .map((activity) => (
                <ActivityRow
                  key={activity.id}
                  activity={activity}
                  lang={language}
                  selected={selectedIds.has(activity.id)}
                  onToggleSelect={() => toggleSelect(activity.id)}
                  onClickEdit={() => setEditingRecord(activity)}
                  onCreateLinked={() => handleCreateLinked(activity)}
                  onNavigate={handleNavigate}
                  t={t}
                />
              ))
          )}
        </div>
      </section>

      {/* Overall mood */}
      <div className="card flex justify-center py-4 mb-6">
        <div className="flex gap-1.5 text-2xl">
          {loadMoodScale().map(({ value: v, emoji: e }) => (
            <span key={v} className={v === Math.round(summaryStats.overallMood) ? 'opacity-100' : 'grayscale opacity-30'}>
              {e}
            </span>
          ))}
        </div>
      </div>

      {/* Calendar */}
      <ActivityCalendar
        data={data}
        language={language}
        selectedDate={calendarDate}
        onDayClick={setCalendarDate}
      />

      {/* Running stats */}
      <section className="mb-6">
        <h2 className="font-serif text-base text-themed-secondary mb-3">{t.time.runningTitle}</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="card text-center py-3">
            <div className="text-2xl font-serif text-themed-accent-solid">
              {summaryStats.todayActivities} / {summaryStats.totalActivities}
            </div>
            <div className="text-xs text-themed-faint mt-1">{t.time.todayActivities} / {t.time.totalActivities}</div>
          </div>
          <div className="card text-center py-3">
            <div className="text-2xl font-serif text-themed-accent-solid">
              {summaryStats.today.hours > 0 ? `${summaryStats.today.hours}${t.time.hours} ` : ''}{summaryStats.today.minutes}{t.time.minutes}
              {' / '}
              {summaryStats.hours > 0 ? `${summaryStats.hours}${t.time.hours} ` : ''}{summaryStats.minutes}{t.time.minutes}
            </div>
            <div className="text-xs text-themed-faint mt-1">{t.time.todayTime} / {t.time.totalTime}</div>
          </div>
          <div className="card text-center py-3">
            <div className="text-xl font-mono text-themed-accent-solid tracking-wider">{elapsed.display}</div>
            <div className="text-xs text-themed-faint mt-1">{t.time.activeDays}</div>
          </div>
          <div className="card text-center py-3">
            <div className="text-2xl font-serif text-themed-accent-solid">{elapsed.percent}%</div>
            <div className="text-xs text-themed-faint mt-1">{t.time.practiceRatio}</div>
          </div>
        </div>
      </section>

      {editingRecord && (() => {
        const def = getActivityByType(editingRecord.type);
        const translated = def ? getTranslatedActivity(def, t) : null;
        if (!translated) return null;
        const idx = allActivitiesFlat.findIndex((a) => a.id === editingRecord.id);
        return (
          <ActivityFlow
            key={editingRecord.id}
            activity={translated}
            existingActivity={editingRecord}
            onUpdateExisting={(id, updates) => {
              handleUpdateActivity(id, updates);
            }}
            onClose={() => {
              setEditingRecord(null);
              setData(loadAllData());
            }}
            onAddComment={(text) => handleAddComment(editingRecord.id, text)}
            onUpdateComment={(commentId, text) => handleUpdateComment(editingRecord.id, commentId, text)}
            onNavigateLinked={(targetId) => {
              const found = findActivityById(targetId);
              if (found) setEditingRecord(found.activity);
            }}
            onNavigatePrev={idx > 0 ? handleNavigatePrev : undefined}
            onNavigateNext={idx < allActivitiesFlat.length - 1 ? handleNavigateNext : undefined}
            onCreateLinked={() => handleCreateLinked(editingRecord)}
          />
        );
      })()}
    </div>
  );
}
