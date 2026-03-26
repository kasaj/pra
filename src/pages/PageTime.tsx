import { useMemo, useState, useCallback } from 'react';
import { loadAllData, deleteActivitiesByIds } from '../utils/storage';
import { getActivityByType, getTranslatedActivity } from '../utils/activities';
import { useLanguage } from '../i18n';
import { Activity } from '../types';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  Cell,
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

interface ActivityRowProps {
  activity: Activity;
  lang: string;
  selected: boolean;
  onToggleSelect: () => void;
  t: ReturnType<typeof useLanguage>['t'];
}

function ActivityRow({ activity, lang, selected, onToggleSelect, t }: ActivityRowProps) {
  const rawDef = getActivityByType(activity.type);
  const def = rawDef ? getTranslatedActivity(rawDef, t) : rawDef;
  const isTimed = activity.durationMinutes !== null;

  const actualTime = activity.actualDurationSeconds
    ? formatDuration(activity.actualDurationSeconds)
    : activity.durationMinutes
      ? `${activity.durationMinutes}m`
      : null;

  const noteDisplay = isTimed
    ? activity.noteAfter || activity.noteBefore || ''
    : activity.note || '';

  return (
    <div className="py-3 flex items-start gap-3">
      <button
        onClick={onToggleSelect}
        className={`mt-1 w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
          selected
            ? 'bg-forest-600 border-forest-600'
            : 'border-clay-300 hover:border-forest-400'
        }`}
      >
        {selected && (
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3">
          <div className="text-clay-400 text-xs w-12 flex-shrink-0">
            {formatTime(activity.startedAt, lang)}
          </div>

          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-lg">{def?.emoji}</span>
            <span className="text-clay-800 font-medium truncate">{def?.name}</span>
          </div>

          {actualTime && (
            <div className="text-clay-500 text-sm">
              {actualTime}
            </div>
          )}

          <div className="text-sm w-16 text-right flex-shrink-0">
            {isTimed ? (
              (activity.ratingBefore || activity.ratingAfter) ? (
                <span className="text-clay-600">
                  {activity.ratingBefore || '-'}→{activity.ratingAfter || '-'}
                </span>
              ) : null
            ) : (
              activity.rating && (
                <span className="text-ochre-500">{'★'.repeat(activity.rating)}</span>
              )
            )}
          </div>
        </div>

        {noteDisplay && (
          <div className="mt-1 ml-12 text-sm text-clay-500 italic">
            "{noteDisplay}"
          </div>
        )}
      </div>
    </div>
  );
}

export default function PageTime() {
  const { t, language } = useLanguage();
  const [data, setData] = useState(() => loadAllData());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [trendRange, setTrendRange] = useState<'week' | 'month'>('week');

  // Summary statistics
  const summaryStats = useMemo(() => {
    let totalActivities = 0;
    let totalSeconds = 0;

    const todayStr = new Date().toISOString().split('T')[0];
    let todayActivities = 0;
    let todaySeconds = 0;

    const weekAgoDate = new Date();
    weekAgoDate.setDate(weekAgoDate.getDate() - 6);
    const weekAgoStr = weekAgoDate.toISOString().split('T')[0];
    let weekActivities = 0;
    let weekSeconds = 0;

    data.forEach((day) => {
      day.activities.forEach((activity) => {
        totalActivities++;
        const secs = activity.actualDurationSeconds || (activity.durationMinutes ? activity.durationMinutes * 60 : 0);
        totalSeconds += secs;

        if (day.date === todayStr) {
          todayActivities++;
          todaySeconds += secs;
        }
        if (day.date >= weekAgoStr) {
          weekActivities++;
          weekSeconds += secs;
        }
      });
    });

    const toHM = (s: number) => ({ hours: Math.floor(s / 3600), minutes: Math.floor((s % 3600) / 60) });

    return {
      totalActivities, ...toHM(totalSeconds),
      todayActivities, today: toHM(todaySeconds),
      weekActivities, week: toHM(weekSeconds),
    };
  }, [data]);

  // Trend data (week or month)
  const trendData = useMemo(() => {
    const today = new Date();
    const days = trendRange === 'week' ? 7 : 30;
    const start = new Date(today);
    start.setDate(start.getDate() - (days - 1));

    const result: Array<{ day: string; avgRating: number | null }> = [];

    for (let i = 0; i < days; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      const dayEntry = data.find((d) => d.date === dateStr);

      let avgRating: number | null = null;
      if (dayEntry) {
        const ratings: number[] = [];
        dayEntry.activities.forEach((a) => {
          if (a.ratingAfter) ratings.push(a.ratingAfter);
          else if (a.rating) ratings.push(a.rating);
        });
        if (ratings.length > 0) {
          avgRating = Math.round((ratings.reduce((sum, r) => sum + r, 0) / ratings.length) * 10) / 10;
        }
      }

      const dayName = trendRange === 'week'
        ? date.toLocaleDateString(language === 'cs' ? 'cs-CZ' : 'en-US', { weekday: 'short' })
        : `${date.getDate()}.${date.getMonth() + 1}`;
      result.push({ day: dayName, avgRating });
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
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleDeleteSelected = useCallback(() => {
    if (selectedIds.size === 0) return;

    deleteActivitiesByIds(Array.from(selectedIds));
    setData(loadAllData());
    setSelectedIds(new Set());
  }, [selectedIds]);

  const allActivityIds = useMemo(() => {
    const ids: string[] = [];
    data.forEach((day) => {
      day.activities.forEach((a) => ids.push(a.id));
    });
    return ids;
  }, [data]);

  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === allActivityIds.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allActivityIds));
    }
  }, [selectedIds.size, allActivityIds]);

  if (data.length === 0) {
    return (
      <div className="page-container">
        <header className="mb-8">
          <h1 className="font-serif text-3xl text-clay-800">{t.time.title}</h1>
          <p className="text-clay-500 mt-2">{t.time.subtitle}</p>
        </header>

        <div className="card text-center py-12">
          <p className="text-clay-500">{t.time.noRecords}</p>
          <p className="text-clay-400 text-sm mt-2">{t.time.startHint}</p>
        </div>
      </div>
    );
  }

  // Color for rating bars
  const getRatingColor = (rating: number | null): string => {
    if (rating === null) return '#e4d5c7'; // clay-200
    if (rating <= 2) return '#bf9a7c'; // ochre
    if (rating <= 3) return '#6f4b3e'; // clay-600
    return '#3f6450'; // forest-600
  };

  return (
    <div className="page-container">
      <header className="mb-6">
        <h1 className="font-serif text-3xl text-clay-800">{t.time.title}</h1>
        <p className="text-clay-500 mt-1">{t.time.subtitle}</p>
      </header>

      {/* Summary Section */}
      <section className="mb-6">
        <h2 className="font-serif text-base text-clay-700 mb-3">{t.time.summaryTitle}</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="card text-center py-3">
            <div className="text-2xl font-serif text-forest-600">{summaryStats.weekActivities}</div>
            <div className="text-xs text-clay-500 mt-1">{t.time.weekActivities}</div>
          </div>
          <div className="card text-center py-3">
            <div className="text-2xl font-serif text-forest-600">
              {summaryStats.week.hours > 0 && `${summaryStats.week.hours}${t.time.hours} `}
              {summaryStats.week.minutes} {t.time.minutes}
            </div>
            <div className="text-xs text-clay-500 mt-1">{t.time.weekTime}</div>
          </div>
          <div className="card text-center py-3">
            <div className="text-2xl font-serif text-forest-600">{summaryStats.totalActivities}</div>
            <div className="text-xs text-clay-500 mt-1">{t.time.totalActivities}</div>
          </div>
          <div className="card text-center py-3">
            <div className="text-2xl font-serif text-forest-600">
              {summaryStats.hours > 0 && `${summaryStats.hours}${t.time.hours} `}
              {summaryStats.minutes} {t.time.minutes}
            </div>
            <div className="text-xs text-clay-500 mt-1">{t.time.totalTime}</div>
          </div>
        </div>
      </section>

      {/* Trend Section */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-serif text-base text-clay-700">
            {trendRange === 'week' ? t.time.weeklyTrend : t.time.monthlyTrend}
          </h2>
          <div className="flex gap-1 bg-clay-100 rounded-lg p-0.5">
            <button
              onClick={() => setTrendRange('week')}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                trendRange === 'week'
                  ? 'bg-white text-forest-700 shadow-sm'
                  : 'text-clay-500 hover:text-clay-700'
              }`}
            >
              {t.time.trendWeek}
            </button>
            <button
              onClick={() => setTrendRange('month')}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                trendRange === 'month'
                  ? 'bg-white text-forest-700 shadow-sm'
                  : 'text-clay-500 hover:text-clay-700'
              }`}
            >
              {t.time.trendMonth}
            </button>
          </div>
        </div>
        <div className="card">
          <ResponsiveContainer width="100%" height={trendRange === 'month' ? 150 : 120}>
            <BarChart data={trendData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <XAxis
                dataKey="day"
                tick={{ fontSize: trendRange === 'month' ? 9 : 11, fill: '#6f4b3e' }}
                axisLine={false}
                tickLine={false}
                interval={trendRange === 'month' ? 4 : 0}
              />
              <YAxis
                domain={[0, 5]}
                hide
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fdf9f3',
                  border: '1px solid #e4d5c7',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                formatter={(value) => value !== null ? [value, t.time.rating] : ['-', t.time.rating]}
              />
              <Bar dataKey="avgRating" radius={[4, 4, 0, 0]}>
                {trendData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getRatingColor(entry.avgRating)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {chartData.length > 1 && (
        <section className="mb-6">
          <h2 className="font-serif text-base text-clay-700 mb-3">{t.time.chartTitle}</h2>
          <div className="card">
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={chartData}>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: '#6f4b3e' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[1, 5]}
                  tick={{ fontSize: 11, fill: '#6f4b3e' }}
                  axisLine={false}
                  tickLine={false}
                  width={25}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fdf9f3',
                    border: '1px solid #e4d5c7',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="before"
                  stroke="#bf9a7c"
                  strokeWidth={2}
                  dot={false}
                  name={t.time.before}
                />
                <Line
                  type="monotone"
                  dataKey="after"
                  stroke="#3f6450"
                  strokeWidth={2}
                  dot={false}
                  name={t.time.after}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-serif text-base text-clay-700">{t.time.recordsTitle}</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSelectAll}
              className="px-3 py-1.5 text-sm rounded-xl bg-clay-100 text-clay-600
                       hover:bg-clay-200 transition-colors"
            >
              {selectedIds.size === allActivityIds.length ? t.time.deselectAll : t.time.selectAll}
            </button>
            {selectedIds.size > 0 && (
              <button
                onClick={handleDeleteSelected}
                className="px-3 py-1.5 text-sm rounded-xl bg-ochre-100 text-ochre-700
                         hover:bg-ochre-200 transition-colors flex items-center gap-2"
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
              {/* Datum jako oddělovač */}
              <div className={`py-2 px-1 text-sm font-medium text-clay-600 capitalize ${
                dayIndex > 0 ? 'border-t-2 border-clay-200 mt-2' : ''
              }`}>
                {formatDateFull(day.date, language)}
              </div>

              {/* Aktivity daného dne */}
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
                    t={t}
                  />
                ))}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
