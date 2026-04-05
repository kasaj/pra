import { useMemo, useState, useCallback, useEffect } from 'react';
import { loadAllData, deleteActivitiesByIds, updateActivityById, findActivityById, createLinkedActivity } from '../utils/storage';
import { getChartColors } from '../utils/theme';
import { getActivityByType, getTranslatedActivity } from '../utils/activities';
import { useLanguage } from '../i18n';
import { Activity, ActivityComment, ActivityDefinition, DayEntry } from '../types';
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



function ActivityCalendar({ data, language, selectedDate, onDayClick }: {
  data: DayEntry[];
  language: string;
  selectedDate: string | null;
  onDayClick: (date: string | null) => void;
}) {
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
    <section className="mb-4">
      <div className="card px-2 py-1.5">
        <div className="flex items-center justify-between mb-0.5">
          <button onClick={handlePrev} className="w-5 h-5 flex items-center justify-center text-themed-muted hover:text-themed-accent-solid">
            <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-xs font-medium text-themed-primary capitalize">{monthName}</span>
          <button onClick={handleNext} className="w-5 h-5 flex items-center justify-center text-themed-muted hover:text-themed-accent-solid">
            <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-7 gap-0 text-center">
          {weekDays.map((d) => (
            <div key={d} className="text-xs text-themed-faint leading-tight">{d}</div>
          ))}
          {days.map((day, i) => {
            if (day === null) return <div key={`e-${i}`} />;
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const entry = activityMap.get(dateStr);
            const count = entry?.activities.length || 0;
            const isToday = dateStr === todayStr;
            const isSelected = selectedDate === dateStr;

            let bgStyle: React.CSSProperties = {};
            if (count > 0) {
              const opacity = Math.min(0.2 + count * 0.15, 0.9);
              bgStyle = { backgroundColor: `color-mix(in srgb, var(--accent-solid) ${Math.round(opacity * 100)}%, transparent)` };
            }

            return (
              <button
                key={day}
                onClick={() => handleDayClick(day)}
                className={`h-7 rounded-sm text-xs flex items-center justify-center transition-colors relative ${
                  isSelected ? 'ring-1 ring-offset-0' : ''
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
                  <span className="absolute bottom-0 w-0.5 h-0.5 rounded-full" style={{ backgroundColor: 'var(--accent-solid)' }} />
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
  const comments = getActivityComments(activity);
  const baseDurationSec = activity.actualDurationSeconds || (activity.durationMinutes ? activity.durationMinutes * 60 : 60);
  const extraComments = Math.max(0, comments.length - 1);
  const durationMin = Math.max(1, Math.round((baseDurationSec + extraComments * 60) / 60));
  const actualTime = durationMin >= 1440
    ? `${Math.floor(durationMin / 1440)} d${durationMin % 1440 >= 60 ? ` ${Math.floor((durationMin % 1440) / 60)} h` : ''}`
    : durationMin >= 60
      ? `${Math.floor(durationMin / 60)} h${durationMin % 60 > 0 ? ` ${durationMin % 60} m` : ''}`
      : `${durationMin} m`;

  const allComments = comments;
  // Count position in chain: how many activities before this one + 1
  const chainPosition = (() => {
    let count = 1;
    let currentId = activity.linkedFromId;
    const visited = new Set<string>([activity.id]);
    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      count++;
      const found = findActivityById(currentId);
      currentId = found?.activity.linkedFromId;
    }
    return count;
  })();
  const linkCount = chainPosition;

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
            {def?.emoji && <span className="text-sm">{def.emoji}</span>}
            {def?.name && <span className="text-xs text-themed-muted truncate">{def.name}</span>}
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
            <span className="text-themed-faint text-xs">{actualTime}</span>
          </div>
        </div>

        {/* Comment rows: time left, mood scale right */}
        {allComments.map((c) => (
          <div key={`${c.id}-${c.rating || 0}`} className="flex items-center justify-between mt-0.5">
            <div className="flex items-center gap-1.5 text-sm min-w-0">
              <span className="text-themed-faint text-xs flex-shrink-0">{formatTime(c.updatedAt || c.createdAt, lang)}</span>
              {c.text && <span className="text-themed-muted text-xs truncate">{c.text}</span>}
            </div>
            <div className="flex gap-px flex-shrink-0 ml-1" style={{ fontSize: '0.55rem' }}>
              {loadMoodScale().map(({ value: v, emoji: e }) => (
                <span key={v} className={c.rating != null && v === c.rating ? 'opacity-100' : 'grayscale opacity-20'}>{e}</span>
              ))}
            </div>
          </div>
        ))}
        {/* Mood scale if no comments */}
        {allComments.length === 0 && (
          <div className="flex justify-end gap-px mt-0.5" style={{ fontSize: '0.55rem' }}>
            {loadMoodScale().map(({ value: v, emoji: e }) => (
              <span key={v} className="grayscale opacity-20">{e}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function PageTime({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const { t, language } = useLanguage();
  const [data, setData] = useState(() => loadAllData());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [trendRange, setTrendRange] = useState<'day' | '3days' | 'week' | 'month' | 'year'>('day');
  const [showView, setShowView] = useState<'chart' | 'calendar'>('chart');
  const [recordSort, setRecordSort] = useState<'date' | 'score'>('date');
  const [searchQuery, setSearchQuery] = useState('');
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

  // Search filter
  const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const matchesSearch = useCallback((activity: Activity): boolean => {
    if (!searchQuery.trim()) return true;
    const q = normalize(searchQuery);
    const def = getActivityByType(activity.type);
    if (normalize(activity.type).includes(q)) return true;
    if (def?.name && normalize(def.name).includes(q)) return true;
    if (def?.emoji?.includes(searchQuery)) return true;
    if (activity.selectedVariant && normalize(activity.selectedVariant).includes(q)) return true;
    // Search in all comments (text + rating emoji)
    const allComments = activity.comments || [];
    for (const c of allComments) {
      if (c.text && normalize(c.text).includes(q)) return true;
      if (c.rating) {
        const emoji = getMoodEmoji(c.rating);
        if (emoji === searchQuery.trim() || emoji.includes(searchQuery.trim())) return true;
      }
    }
    // Legacy ratings
    if (activity.rating) { const e = getMoodEmoji(activity.rating); if (e === searchQuery.trim() || e.includes(searchQuery.trim())) return true; }
    if (activity.ratingBefore) { const e = getMoodEmoji(activity.ratingBefore); if (e === searchQuery.trim() || e.includes(searchQuery.trim())) return true; }
    if (activity.ratingAfter) { const e = getMoodEmoji(activity.ratingAfter); if (e === searchQuery.trim() || e.includes(searchQuery.trim())) return true; }
    // Legacy notes
    if (activity.note && normalize(activity.note).includes(q)) return true;
    if (activity.noteBefore && normalize(activity.noteBefore).includes(q)) return true;
    if (activity.noteAfter && normalize(activity.noteAfter).includes(q)) return true;
    return false;
  }, [searchQuery]);

  // Summary statistics (always from ALL data, not filtered by range)
  const summaryStats = useMemo(() => {
    const filteredData = data.filter(d => d.activities.length > 0);

    let totalActivities = 0;
    let totalSeconds = 0;
    let todayActivities = 0;
    let todaySeconds = 0;
    const todayStr = new Date().toISOString().split('T')[0];

    filteredData.forEach((day) => {
      day.activities.forEach((activity) => {
        const comments = getActivityComments(activity);
        const eventCount = 1 + Math.max(0, comments.length - 1);
        totalActivities += eventCount;
        const extraComments = Math.max(0, comments.length - 1);
        const secs = (activity.actualDurationSeconds || (activity.durationMinutes ? activity.durationMinutes * 60 : 60)) + (extraComments * 60);
        totalSeconds += secs;
        if (day.date === todayStr) {
          todayActivities += eventCount;
          todaySeconds += secs;
        }
      });
    });

    // Overall average mood from all comments
    const allMoodRatings: number[] = [];
    filteredData.forEach((day) => {
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
    const firstDate = filteredData.length > 0 ? filteredData[filteredData.length - 1].date : null;
    const activeDays = filteredData.filter(d => d.activities.length > 0).length;
    const avgPerDay = activeDays > 0 ? Math.round(totalActivities / activeDays * 10) / 10 : 0;

    // Streak: consecutive days with activities (always from full data)
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().split('T')[0];
      if (data.find(e => e.date === ds && e.activities.length > 0)) streak++;
      else break;
    }

    return {
      totalActivities, totalSeconds, ...toHM(totalSeconds),
      todayActivities, today: toHM(todaySeconds),
      overallMood,
      firstDate,
      activeDays,
      avgPerDay,
      streak,
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

  // Stats for the selected range (uses same filter as summaryStats)
  const selectedDayStats = useMemo(() => {
    const rangeDays = trendRange === 'day' ? 1 : trendRange === '3days' ? 3 : trendRange === 'week' ? 7 : trendRange === 'month' ? 30 : 365;
    const rangeStart = new Date();
    rangeStart.setDate(rangeStart.getDate() - (rangeDays - 1));
    const rangeStartStr = rangeStart.toISOString().split('T')[0];

    const filteredData = (calendarDate ? data.filter(d => d.date === calendarDate) : data.filter(d => d.date >= rangeStartStr))
      .map(d => ({ ...d, activities: d.activities.filter(matchesSearch) }))
      .filter(d => d.activities.length > 0);

    let totalCount = 0;
    let secs = 0;
    const ratings: number[] = [];

    filteredData.forEach(day => {
      day.activities.forEach(a => {
        const comments = getActivityComments(a);
        totalCount += 1 + Math.max(0, comments.length - 1);
        secs += (a.actualDurationSeconds || (a.durationMinutes ? a.durationMinutes * 60 : 60)) + (Math.max(0, comments.length - 1) * 60);
        const cr = comments.filter(c => c.rating != null).map(c => c.rating!);
        if (cr.length > 0) ratings.push(...cr);
        else { const r = a.ratingAfter ?? a.rating; if (r != null) ratings.push(r); }
      });
    });

    const avgMood = ratings.length > 0
      ? Math.round((ratings.reduce((s, r) => s + r, 0) / ratings.length) * 10) / 10
      : null;
    const mins = Math.round(secs / 60);

    return { count: totalCount, minutes: mins, avgMood };
  }, [data, calendarDate, searchQuery, matchesSearch, trendRange]);

  // Trend data (day/week/month) - non-cumulative per period
  const trendData = useMemo(() => {
    const result: Array<{ day: string; avgRating: number | null; count: number; minutes: number }> = [];


    // Collect all comment ratings by date for cross-day accuracy
    const ratingsByDate = new Map<string, number[]>();
    const ratingsByHour = new Map<number, number[]>();
    data.forEach(day => {
      day.activities.filter(matchesSearch).forEach(a => {
        const comments = getActivityComments(a);
        comments.forEach(c => {
          if (c.rating != null) {
            const cDate = c.createdAt ? new Date(c.createdAt).toISOString().split('T')[0] : day.date;
            if (!ratingsByDate.has(cDate)) ratingsByDate.set(cDate, []);
            ratingsByDate.get(cDate)!.push(c.rating);
            if (c.createdAt) {
              const cHour = new Date(c.createdAt).getHours();
              if (!ratingsByHour.has(cHour)) ratingsByHour.set(cHour, []);
              ratingsByHour.get(cHour)!.push(c.rating);
            }
          }
        });
        // Legacy fallback
        if (!comments.some(c => c.rating != null)) {
          const r = a.ratingAfter ?? a.rating;
          if (r != null) {
            if (!ratingsByDate.has(day.date)) ratingsByDate.set(day.date, []);
            ratingsByDate.get(day.date)!.push(r);
          }
        }
      });
    });

    if (trendRange === 'day') {
      const todayStr = new Date().toISOString().split('T')[0];
      const dayEntry = data.find((d) => d.date === todayStr);
      // Collect all events (activities + comments) by hour for today
      const hourEvents = new Map<number, { count: number; ratings: number[]; secs: number }>();
      for (let h = 0; h < 24; h++) hourEvents.set(h, { count: 0, ratings: [], secs: 0 });

      (dayEntry?.activities || []).filter(matchesSearch).forEach(a => {
        const h = new Date(a.startedAt).getHours();
        const slot = hourEvents.get(h)!;
        slot.count++;
        slot.secs += a.actualDurationSeconds || (a.durationMinutes ? a.durationMinutes * 60 : 60);
        const comments = getActivityComments(a);
        comments.forEach(c => {
          if (c.createdAt) {
            const cDate = new Date(c.createdAt).toISOString().split('T')[0];
            if (cDate === todayStr) {
              const cH = new Date(c.createdAt).getHours();
              const cSlot = hourEvents.get(cH)!;
              if (cH !== h) cSlot.count++; // count comment as separate event if different hour
              if (c.rating != null) cSlot.ratings.push(c.rating);
            }
          } else if (c.rating != null) {
            slot.ratings.push(c.rating);
          }
        });
        if (!comments.some(c => c.rating != null)) {
          const r = a.ratingAfter ?? a.rating;
          if (r != null) slot.ratings.push(r);
        }
      });

      for (let h = 5; h <= 23; h++) {
        const slot = hourEvents.get(h)!;
        const avgRating = slot.ratings.length > 0 ? Math.round((slot.ratings.reduce((s, r) => s + r, 0) / slot.ratings.length) * 10) / 10 : null;
        result.push({ day: `${h}:00`, count: slot.count, avgRating, minutes: Math.round(slot.secs / 60) });
      }
    } else {
      const today = new Date();
      const days = trendRange === '3days' ? 3 : trendRange === 'week' ? 7 : trendRange === 'month' ? 30 : 365;
      const start = new Date(today);
      start.setDate(start.getDate() - (days - 1));

      for (let i = 0; i < days; i++) {
        const date = new Date(start);
        date.setDate(start.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];
        const dayEntry = data.find((d) => d.date === dateStr);

        const filtered = dayEntry ? dayEntry.activities.filter(matchesSearch) : [];
        let count = 0;
        let totalSecs = 0;
        filtered.forEach(a => {
          const c = getActivityComments(a);
          count += 1 + Math.max(0, c.length - 1);
          totalSecs += (a.actualDurationSeconds || (a.durationMinutes ? a.durationMinutes * 60 : 60)) + Math.max(0, c.length - 1) * 60;
        });
        const dayRatings = ratingsByDate.get(dateStr) || [];
        const avgRating = dayRatings.length > 0 ? Math.round((dayRatings.reduce((s, r) => s + r, 0) / dayRatings.length) * 10) / 10 : null;
        const stats = { count, avgRating, minutes: Math.round(totalSecs / 60) };

        const dayName = trendRange === '3days'
          ? date.toLocaleDateString(language === 'cs' ? 'cs-CZ' : 'en-US', { weekday: 'short', day: 'numeric' })
          : trendRange === 'week'
            ? date.toLocaleDateString(language === 'cs' ? 'cs-CZ' : 'en-US', { weekday: 'short' })
            : trendRange === 'year'
              ? `${date.getDate()}.${date.getMonth() + 1}`
              : `${date.getDate()}.${date.getMonth() + 1}`;
        result.push({ day: dayName, ...stats });
      }
    }

    return result;
  }, [data, language, trendRange, matchesSearch]);


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

  const [newRecordActivity, _setNewRecordActivity] = useState<ActivityDefinition | null>(null);

  const handleDeleteSelected = useCallback(() => {
    if (selectedIds.size === 0) return;
    deleteActivitiesByIds(Array.from(selectedIds));
    setData(loadAllData());
    setSelectedIds(new Set());
  }, [selectedIds]);

  // Search filter

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
      </header>

      {/* Chart / Calendar toggle */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex gap-1 bg-themed-input rounded-lg p-0.5">
            {(['chart', 'calendar'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setShowView(v)}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  showView === v
                    ? 'bg-themed-card text-themed-accent shadow-sm'
                    : 'text-themed-faint hover:text-themed-secondary'
                }`}
              >
                {v === 'chart' ? (language === 'cs' ? 'Graf' : 'Chart') : (language === 'cs' ? 'Kalendář' : 'Calendar')}
              </button>
            ))}
          </div>
          {showView === 'chart' && (
            <div className="flex gap-1 bg-themed-input rounded-lg p-0.5">
              {(['day', '3days', 'week', 'month', 'year'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setTrendRange(r)}
                  className={`px-2 py-1 text-xs rounded-md transition-colors ${
                    trendRange === r
                      ? 'bg-themed-card text-themed-accent shadow-sm'
                      : 'text-themed-faint hover:text-themed-secondary'
                  }`}
                >
                  {r === 'day' ? '1D' : r === '3days' ? '3D' : r === 'week' ? '1W' : r === 'month' ? '1M' : '1Y'}
                </button>
              ))}
            </div>
          )}
        </div>

        {showView === 'calendar' && (
          <ActivityCalendar
            data={searchQuery.trim() ? data.map(d => ({ ...d, activities: d.activities.filter(matchesSearch) })).filter(d => d.activities.length > 0) : data}
            language={language}
            selectedDate={calendarDate}
            onDayClick={setCalendarDate}
          />
        )}

        {showView === 'chart' && (
        <div className="card">
          <ResponsiveContainer width="100%" height={trendRange === 'year' ? 220 : trendRange === 'month' ? 200 : 180}>
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
                tick={{ fontSize: trendRange === 'year' ? 8 : trendRange === 'month' ? 9 : trendRange === 'day' ? 9 : 11, fill: colors.tick }}
                axisLine={false}
                tickLine={false}
                interval={trendRange === 'year' ? 29 : trendRange === 'month' ? 4 : trendRange === 'day' ? 1 : 0}
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
        )}
      </section>

      {/* Search */}
      <div className="relative mb-4">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-themed-faint" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={language === 'cs' ? 'Hledat...' : 'Search...'}
          className="w-full pl-9 pr-3 py-2 rounded-xl bg-themed-input border border-themed
                   focus:outline-none focus:border-themed-accent
                   text-themed-primary placeholder:text-themed-faint text-sm"
        />
      </div>

      {/* Records */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
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
          {recordSort === 'date' ? (
            // Sort by date (grouped by day), filtered by calendar and search
            (calendarDate ? data.filter(d => d.date === calendarDate).map(d => searchQuery.trim() ? ({ ...d, activities: d.activities.filter(matchesSearch) }) : d).filter(d => d.activities.length > 0) : (() => {
              const rangeDays = trendRange === 'day' ? 1 : trendRange === '3days' ? 3 : trendRange === 'week' ? 7 : trendRange === 'month' ? 30 : 365;
              const rangeStart = new Date();
              rangeStart.setDate(rangeStart.getDate() - (rangeDays - 1));
              const rangeStartStr = rangeStart.toISOString().split('T')[0];
              const rangeFiltered = data.filter(d => d.date >= rangeStartStr);
              const filtered = searchQuery.trim()
                ? rangeFiltered.map(d => ({ ...d, activities: d.activities.filter(matchesSearch) })).filter(d => d.activities.length > 0)
                : rangeFiltered;
              let remaining = 999;
              const result: DayEntry[] = [];
              for (const day of filtered) {
                if (remaining <= 0) break;
                result.push(day);
                remaining -= day.activities.length;
              }
              return result;
            })()).map((day, dayIndex) => (
              <div key={day.date}>
                <div className={`py-2 px-1 text-sm font-medium text-themed-muted flex items-center justify-between ${
                  dayIndex > 0 ? 'border-t-2 border-themed mt-2' : ''
                }`}>
                  <span>{formatDateFull(day.date, language)}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-xs text-themed-faint">{(() => { const m = Math.round(day.activities.reduce((s, a) => { const c = getActivityComments(a); return s + (a.actualDurationSeconds || (a.durationMinutes ? a.durationMinutes * 60 : 60)) + Math.max(0, c.length - 1) * 60; }, 0) / 60); return m >= 60 ? `${Math.floor(m / 60)} h${m % 60 > 0 ? ` ${m % 60} m` : ''}` : `${m} m`; })()}</span>
                    {getDayAvgMoodEmoji(day) && <span>{getDayAvgMoodEmoji(day)}</span>}
                  </span>
                </div>
                {day.activities
                  .filter(matchesSearch)
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
            // Sort by chain position (highest first, then newest)
            (calendarDate
              ? allActivitiesFlat.filter(a => a.startedAt.startsWith(calendarDate))
              : (() => {
                  const rd = trendRange === 'day' ? 1 : trendRange === '3days' ? 3 : trendRange === 'week' ? 7 : trendRange === 'month' ? 30 : 365;
                  const rs = new Date(); rs.setDate(rs.getDate() - (rd - 1));
                  const rss = rs.toISOString().split('T')[0];
                  return allActivitiesFlat.filter(a => a.startedAt >= rss);
                })()
            )
              .filter(matchesSearch)
              .slice()
              .sort((a, b) => {
                const chainPos = (act: Activity) => {
                  let count = 1;
                  let currentId = act.linkedFromId;
                  const visited = new Set<string>([act.id]);
                  while (currentId && !visited.has(currentId)) {
                    visited.add(currentId);
                    count++;
                    const found = findActivityById(currentId);
                    currentId = found?.activity.linkedFromId;
                  }
                  return count;
                };
                const countA = chainPos(a);
                const countB = chainPos(b);
                if (countB !== countA) return countB - countA;
                return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime();
              })
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

      {/* Running stats */}
      <section className="mb-6">

        {/* Day-specific stats (selected day or today) */}
        {(() => {
          const rangeLabel = calendarDate ? '1D' : trendRange === 'day' ? '1D' : trendRange === '3days' ? '3D' : trendRange === 'week' ? '1W' : trendRange === 'month' ? '1M' : '1Y';
          return (
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div className="card text-center py-3">
            <div className="text-2xl font-serif text-themed-accent-solid">{selectedDayStats.count}</div>
            <div className="text-xs text-themed-faint mt-1">{language === 'cs' ? 'Aktivit' : 'Activities'} {rangeLabel}</div>
          </div>
          <div className="card text-center py-3">
            <div className="text-2xl font-serif text-themed-accent-solid">{selectedDayStats.minutes >= 60 ? `${Math.floor(selectedDayStats.minutes / 60)} h${selectedDayStats.minutes % 60 > 0 ? ` ${selectedDayStats.minutes % 60} m` : ''}` : `${selectedDayStats.minutes} m`}</div>
            <div className="text-xs text-themed-faint mt-1">{language === 'cs' ? 'Čas' : 'Time'} {rangeLabel}</div>
          </div>
          <div className="card text-center py-3">
            <div className="text-2xl">{selectedDayStats.avgMood ? getMoodEmoji(selectedDayStats.avgMood) : '😐'}</div>
            <div className="text-xs text-themed-faint mt-1">{language === 'cs' ? 'Nálada' : 'Mood'} {rangeLabel}</div>
          </div>
        </div>
          );
        })()}

        <div className="card flex flex-col items-center py-3 mb-3">
          <div className="flex gap-1.5 text-2xl">
            {loadMoodScale().map(({ value: v, emoji: e }) => (
              <span key={v} className={v === Math.round(summaryStats.overallMood) ? 'opacity-100' : 'grayscale opacity-30'}>
                {e}
              </span>
            ))}
          </div>
          <div className="text-xs text-themed-faint mt-1">{language === 'cs' ? 'Celkově' : 'Overall'}</div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="card text-center py-3">
            <div className="text-2xl font-serif text-themed-accent-solid">
              {summaryStats.totalActivities}
            </div>
            <div className="text-xs text-themed-faint mt-1">{t.time.totalActivities}</div>
          </div>
          <div className="card text-center py-3">
            <div className="text-2xl font-serif text-themed-accent-solid">
              {summaryStats.hours > 0 ? `${summaryStats.hours} h ` : ''}{summaryStats.minutes} m
            </div>
            <div className="text-xs text-themed-faint mt-1">{t.time.totalTime}</div>
          </div>
          <div className="card text-center py-3">
            <div className="text-2xl font-serif text-themed-accent-solid">{summaryStats.streak}</div>
            <div className="text-xs text-themed-faint mt-1">{language === 'cs' ? 'Dní v řadě' : 'Day streak'}</div>
          </div>
          <div className="card text-center py-3">
            <div className="text-2xl font-serif text-themed-accent-solid">{summaryStats.avgPerDay}</div>
            <div className="text-xs text-themed-faint mt-1">{language === 'cs' ? 'Ø za den' : 'Ø per day'}</div>
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


      {newRecordActivity && (
        <ActivityFlow
          activity={newRecordActivity}
          onClose={() => {
            _setNewRecordActivity(null);
            setData(loadAllData());
          }}
          onNavigatePage={(page) => {
            _setNewRecordActivity(null);
            setData(loadAllData());
            if (onNavigate) onNavigate(page);
          }}
        />
      )}

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
            onNavigatePage={(page) => {
              setEditingRecord(null);
              setData(loadAllData());
              if (onNavigate) onNavigate(page);
            }}
          />
        );
      })()}
    </div>
  );
}
