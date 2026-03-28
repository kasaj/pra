import { useMemo, useState, useCallback, useEffect } from 'react';
import { loadAllData, deleteActivitiesByIds, updateActivityById, findActivityById, createLinkedActivity } from '../utils/storage';
import { getChartColors } from '../utils/theme';
import { getActivityByType, getTranslatedActivity } from '../utils/activities';
import { useLanguage } from '../i18n';
import { Activity, ActivityComment } from '../types';
import ActivityFlow from '../components/ActivityFlow';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

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
  const isTimed = activity.durationMinutes !== null;

  const actualTime = activity.actualDurationSeconds
    ? formatDuration(activity.actualDurationSeconds)
    : activity.durationMinutes
      ? `${activity.durationMinutes}m`
      : null;

  const comments = getActivityComments(activity);
  const lastTwo = comments.slice(-2);

  return (
    <div className="py-3 flex items-start gap-3">
      <button
        onClick={onToggleSelect}
        className={`mt-1 w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
          selected
            ? 'bg-themed-accent border-themed-accent'
            : 'border-themed-medium hover:border-themed-accent'
        }`}
      >
        {selected && (
          <svg className="w-3 h-3 text-themed-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 cursor-pointer" onClick={onClickEdit}>
          <div className="text-themed-faint text-xs w-12 flex-shrink-0">
            {formatTime(activity.startedAt, lang)}
          </div>

          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-lg">{def?.emoji}</span>
            <span className="text-themed-primary font-medium truncate">{def?.name}</span>
          </div>

          {actualTime && (
            <div className="text-themed-faint text-sm">
              {actualTime}
            </div>
          )}

          <div className="text-sm w-16 text-right flex-shrink-0">
            {isTimed ? (
              (activity.ratingBefore || activity.ratingAfter) ? (
                <span className="text-themed-muted">
                  {activity.ratingBefore || '-'}→{activity.ratingAfter || '-'}
                </span>
              ) : null
            ) : (
              activity.rating && (
                <span className="text-themed-ochre">{'★'.repeat(activity.rating)}</span>
              )
            )}
          </div>
        </div>

        {/* Last two comments */}
        {lastTwo.length > 0 && (
          <div className="mt-1 ml-12 space-y-0.5">
            {lastTwo.map((c) => (
              <div key={c.id} className="flex items-baseline gap-2 text-sm">
                <span className="text-themed-faint text-xs flex-shrink-0">
                  {formatTime(c.updatedAt || c.createdAt, lang)}
                </span>
                <span className="text-themed-muted italic truncate">"{c.text}"</span>
              </div>
            ))}
          </div>
        )}

        {/* Navigation links and + button */}
        <div className="mt-1 ml-12 flex items-center gap-1.5">
          {activity.linkedFromId && (
            <button
              onClick={() => onNavigate(activity.linkedFromId!)}
              className="w-6 h-6 rounded-full bg-themed-input flex items-center justify-center text-themed-muted hover:text-themed-accent-solid transition-colors"
              title={t.time.linkedFrom}
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          {activity.linkedActivityIds && activity.linkedActivityIds.length > 0 && (
            <button
              onClick={() => onNavigate(activity.linkedActivityIds![activity.linkedActivityIds!.length - 1])}
              className="w-6 h-6 rounded-full bg-themed-input flex items-center justify-center text-themed-muted hover:text-themed-accent-solid transition-colors"
              title={t.time.linkedTo}
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
          <button
            onClick={onCreateLinked}
            className="w-6 h-6 rounded-full bg-themed-input flex items-center justify-center text-themed-faint hover:text-themed-accent-solid transition-colors"
            title={t.time.createLinked}
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PageTime() {
  const { t, language } = useLanguage();
  const [data, setData] = useState(() => loadAllData());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [trendRange, setTrendRange] = useState<'week' | 'month'>('week');
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

    const toHM = (s: number) => ({ hours: Math.floor(s / 3600), minutes: Math.floor((s % 3600) / 60) });
    const firstDate = data.length > 0 ? data[data.length - 1].date : null;

    return {
      totalActivities, totalSeconds, ...toHM(totalSeconds),
      todayActivities, today: toHM(todaySeconds),
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

  // Trend data (week/month) - non-cumulative per period
  const trendData = useMemo(() => {
    const result: Array<{ day: string; avgRating: number; count: number; minutes: number }> = [];

    const computeStats = (activities: Activity[]) => {
      const count = activities.length;
      let totalSecs = 0;
      const ratings: number[] = [];
      activities.forEach((a) => {
        totalSecs += a.actualDurationSeconds || (a.durationMinutes ? a.durationMinutes * 60 : 60);
        if (a.ratingAfter) ratings.push(a.ratingAfter);
        else if (a.rating) ratings.push(a.rating);
      });
      const avgRating = ratings.length > 0
        ? Math.round((ratings.reduce((s, r) => s + r, 0) / ratings.length) * 10) / 10
        : 0;
      return { count, avgRating, minutes: Math.round(totalSecs / 60) };
    };

    const today = new Date();
    const days = trendRange === 'week' ? 7 : 30;
    const start = new Date(today);
    start.setDate(start.getDate() - (days - 1));

    for (let i = 0; i < days; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      const dayEntry = data.find((d) => d.date === dateStr);

      const stats = dayEntry ? computeStats(dayEntry.activities) : { count: 0, avgRating: 0, minutes: 0 };

      const dayName = trendRange === 'week'
        ? date.toLocaleDateString(language === 'cs' ? 'cs-CZ' : 'en-US', { weekday: 'short' })
        : `${date.getDate()}.${date.getMonth() + 1}`;
      result.push({ day: dayName, ...stats });
    }

    return result;
  }, [data, language, trendRange]);

  const chartData = useMemo(() => {
    return data
      .slice(0, 30)
      .reverse()
      .map((day) => {
        const timedActivities = day.activities.filter(
          (a) => a.durationMinutes !== null && a.ratingBefore && a.ratingAfter
        );

        if (timedActivities.length === 0) return null;

        const avgBefore =
          timedActivities.reduce((sum, a) => sum + (a.ratingBefore || 0), 0) /
          timedActivities.length;
        const avgAfter =
          timedActivities.reduce((sum, a) => sum + (a.ratingAfter || 0), 0) /
          timedActivities.length;

        return {
          date: day.date.slice(5),
          before: Math.round(avgBefore * 10) / 10,
          after: Math.round(avgAfter * 10) / 10,
        };
      })
      .filter(Boolean);
  }, [data]);

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

      {/* Summary Section */}
      <section className="mb-6">
        <h2 className="font-serif text-base text-themed-secondary mb-3">{t.time.summaryTitle}</h2>
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
        </div>
      </section>

      {/* Trend Section - week/month only, non-cumulative */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-serif text-base text-themed-secondary">
            {trendRange === 'week' ? t.time.weeklyTrend : t.time.monthlyTrend}
          </h2>
          <div className="flex gap-1 bg-themed-input rounded-lg p-0.5">
            {(['week', 'month'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setTrendRange(r)}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  trendRange === r
                    ? 'bg-themed-card text-themed-accent shadow-sm'
                    : 'text-themed-faint hover:text-themed-secondary'
                }`}
              >
                {r === 'week' ? t.time.trendWeek : t.time.trendMonth}
              </button>
            ))}
          </div>
        </div>
        <div className="card">
          <ResponsiveContainer width="100%" height={trendRange === 'month' ? 180 : 150}>
            <AreaChart data={trendData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="gradCount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={colors.barEmpty} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={colors.barEmpty} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradRating" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={colors.barHigh} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={colors.barHigh} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradMinutes" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={colors.before} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={colors.before} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="day"
                tick={{ fontSize: trendRange === 'month' ? 9 : 11, fill: colors.tick }}
                axisLine={false}
                tickLine={false}
                interval={trendRange === 'month' ? 4 : 0}
              />
              <YAxis yAxisId="rating" domain={[0, 5]} hide />
              <YAxis yAxisId="count" hide />
              <YAxis yAxisId="minutes" hide />
              <Tooltip
                contentStyle={{
                  backgroundColor: colors.tooltipBg,
                  border: `1px solid ${colors.tooltipBorder}`,
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                formatter={(value: number, name: string) => {
                  if (name === 'avgRating') return [value || '-', t.time.rating];
                  if (name === 'minutes') {
                    const h = Math.floor(value / 60);
                    const m = value % 60;
                    return [h > 0 ? `${h}h ${m}m` : `${m} min`, language === 'cs' ? 'Čas' : 'Time'];
                  }
                  return [value, language === 'cs' ? 'Počet' : 'Count'];
                }}
              />
              <Area
                yAxisId="minutes"
                type="monotone"
                dataKey="minutes"
                stroke={colors.before}
                fill="url(#gradMinutes)"
                strokeWidth={1.5}
                dot={false}
              />
              <Area
                yAxisId="count"
                type="monotone"
                dataKey="count"
                stroke={colors.barEmpty}
                fill="url(#gradCount)"
                strokeWidth={2}
                dot={false}
              />
              <Area
                yAxisId="rating"
                type="monotone"
                dataKey="avgRating"
                stroke={colors.barHigh}
                fill="url(#gradRating)"
                strokeWidth={2}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-4 mt-2 text-xs text-themed-faint">
            <span className="flex items-center gap-1">
              <span className="w-4 h-0.5 rounded" style={{ backgroundColor: colors.barEmpty }} />
              {language === 'cs' ? 'Počet' : 'Count'}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-4 h-0.5 rounded" style={{ backgroundColor: colors.before }} />
              {language === 'cs' ? 'Čas' : 'Time'}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-4 h-0.5 rounded" style={{ backgroundColor: colors.barHigh }} />
              {t.time.rating}
            </span>
          </div>
        </div>
      </section>

      {chartData.length > 1 && (
        <section className="mb-6">
          <h2 className="font-serif text-base text-themed-secondary mb-3">{t.time.chartTitle}</h2>
          <div className="card">
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={chartData}>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: colors.tick }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[1, 5]}
                  tick={{ fontSize: 11, fill: colors.tick }}
                  axisLine={false}
                  tickLine={false}
                  width={25}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: colors.tooltipBg,
                    border: `1px solid ${colors.tooltipBorder}`,
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="before"
                  stroke={colors.before}
                  strokeWidth={2}
                  dot={false}
                  name={t.time.before}
                />
                <Line
                  type="monotone"
                  dataKey="after"
                  stroke={colors.after}
                  strokeWidth={2}
                  dot={false}
                  name={t.time.after}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* Records */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-serif text-base text-themed-secondary">{t.time.recordsTitle}</h2>
          <div className="flex items-center gap-2">
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
          {data.map((day, dayIndex) => (
            <div key={day.date}>
              <div className={`py-2 px-1 text-sm font-medium text-themed-muted capitalize ${
                dayIndex > 0 ? 'border-t-2 border-themed mt-2' : ''
              }`}>
                {formatDateFull(day.date, language)}
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
          ))}
        </div>
      </section>

      {/* Running stats - at the bottom */}
      <section className="mb-6">
        <h2 className="font-serif text-base text-themed-secondary mb-3">{t.time.runningTitle}</h2>
        <div className="grid grid-cols-2 gap-3">
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
          />
        );
      })()}
    </div>
  );
}
