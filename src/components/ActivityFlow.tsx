import { useState, useRef, useCallback } from 'react';
import { Activity, ActivityDefinition, ActivityComment, Rating } from '../types';
import { useLanguage } from '../i18n';
import { generateId, addActivity, updateActivityById, getDayEntry, getTodayDate, findActivityById, deleteActivitiesByIds } from '../utils/storage';
import { loadActivities, saveActivities, markActivityModified, getConfigProperties } from '../utils/activities';
import { addToRegistry } from '../utils/variantRegistry';
import { getMoodEmoji } from '../utils/moodScale';
import StarRating from './StarRating';
import Timer from './Timer';

type TimedFlowStep = 'rating-before' | 'timer' | 'rating-after';

function getActivityComments(activity: Activity): ActivityComment[] {
  if (activity.comments && activity.comments.length > 0) return activity.comments;
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

function toLocalDate(isoStr: string): string {
  const d = new Date(isoStr);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function toLocalTime(isoStr: string): string {
  const d = new Date(isoStr);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function CommentsBlock({ comments, newComment, setNewComment, newRating, setNewRating, onUpdate, onUpdateRating, onUpdateTime: _onUpdateTime, onDelete, lang: _lang, t }: {
  comments: ActivityComment[];
  newComment: string;
  setNewComment: (v: string) => void;
  newRating: Rating | null;
  setNewRating: (r: Rating) => void;
  onUpdate?: (commentId: string, text: string) => void;
  onUpdateRating?: (commentId: string, rating: Rating) => void;
  onUpdateTime?: (commentId: string, isoTime: string) => void;
  onDelete?: (commentId: string) => void;
  lang: string;
  t: ReturnType<typeof useLanguage>['t'];
}) {
  return (
    <div className="space-y-3">
      <div className="max-w-xs mx-auto w-full card p-3 space-y-2">
        <div className="flex justify-center">
          <StarRating value={newRating} onChange={setNewRating} size="lg" />
        </div>
        <div>
          <textarea
            value={newComment}
            onChange={(e) => {
              setNewComment(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = e.target.scrollHeight + 'px';
            }}
            placeholder={t.time.commentPlaceholder}
            rows={1}
            className="w-full px-3 py-2 rounded-xl bg-themed-input border border-themed
                     focus:outline-none focus:border-themed-accent resize-none
                     text-themed-primary placeholder:text-themed-faint text-base overflow-hidden"
          />
        </div>
      </div>
      {comments.map((comment) => (
        <div key={`${comment.id}-${comment.rating || 0}`} className="max-w-xs mx-auto w-full space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs text-themed-faint">
              {new Date(comment.createdAt).toTimeString().slice(0, 5)}
            </span>
            <StarRating
              value={comment.rating || null}
              onChange={(r) => onUpdateRating && onUpdateRating(comment.id, r)}
              size="xs"
            />
            <div className="flex-1" />
            {onDelete && (
              <button
                onClick={() => onDelete(comment.id)}
                className="text-themed-faint hover:text-themed-warn transition-colors p-0.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <textarea
            defaultValue={comment.text}
            ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
            onChange={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
            onBlur={(e) => {
              if (e.target.value !== comment.text && onUpdate) {
                onUpdate(comment.id, e.target.value);
              }
            }}
            className="w-full px-3 py-2 rounded-xl bg-themed-input border border-themed
                     focus:outline-none focus:border-themed-accent resize-none
                     text-themed-primary text-base overflow-hidden"
          />
        </div>
      ))}
    </div>
  );
}

interface ActivityFlowProps {
  activity: ActivityDefinition;
  onClose: () => void;
  onEdit?: () => void;
  existingActivity?: Activity;
  onUpdateExisting?: (id: string, updates: Partial<Activity>) => void;
  onAddComment?: (text: string) => void;
  onUpdateComment?: (commentId: string, text: string) => void;
  onNavigateLinked?: (targetId: string) => void;
  onNavigatePrev?: () => void;
  onNavigateNext?: () => void;
  onCreateLinked?: () => void;
  onNavigatePage?: (page: string) => void;
  initialOverrideDuration?: number | null;
}

export default function ActivityFlow({ activity, onClose, onEdit, existingActivity, onUpdateExisting, onAddComment, onUpdateComment: _onUpdateComment, onNavigateLinked, onNavigatePrev: _onNavigatePrev, onNavigateNext: _onNavigateNext, onCreateLinked: _onCreateLinked, onNavigatePage, initialOverrideDuration }: ActivityFlowProps) {
  const { t, language } = useLanguage();
  const [overrideDuration, setOverrideDuration] = useState<number | null>(initialOverrideDuration ?? null);
  const effectiveDuration = overrideDuration ?? activity.durationMinutes;
  const isOriginallyTimed = activity.durationMinutes !== null;
  const isTimed = effectiveDuration !== null;
  const isEditing = !!existingActivity;

  const [timedStep, setTimedStep] = useState<TimedFlowStep>(isEditing ? 'rating-after' : 'rating-before');
  const [editingDurations, setEditingDurations] = useState(false);
  const [newDurationText, setNewDurationText] = useState('');
  const [durationVersion, setDurationVersion] = useState(0);
  const [selectedVariant] = useState<string | null>(existingActivity?.selectedVariant || null);
  const ratingBefore = existingActivity?.ratingBefore || null;
  const ratingAfter = existingActivity?.ratingAfter || null;
  const rating = existingActivity?.rating || null;

  const [localVariants, setLocalVariants] = useState<string[]>(() => {
    const stored = activity.properties || [];
    return stored.length > 0 ? stored : getConfigProperties(activity.type);
  });
  const [disabledVariants, setDisabledVariants] = useState<Set<string>>(new Set());
  const [deletedVariants, setDeletedVariants] = useState<Set<string>>(new Set());
  const [newVariantText, setNewVariantText] = useState('');
  const [editingVariants, setEditingVariants] = useState(false);
  const [registryVersion, setRegistryVersion] = useState(0);

  const persistVariants = useCallback((updated: string[]) => {
    const all = loadActivities();
    const idx = all.findIndex(a => a.type === activity.type);
    if (idx >= 0) {
      all[idx] = { ...all[idx], properties: updated };
      saveActivities(all);
      markActivityModified(activity.type);
    }
  }, [activity.type]);

  const bubbleToCore = useCallback((newProp: string) => {
    const all = loadActivities();
    const coreIdx = all.findIndex(a => a.core);
    if (coreIdx >= 0) {
      const coreProps = all[coreIdx].properties || [];
      if (!coreProps.includes(newProp)) {
        all[coreIdx] = { ...all[coreIdx], properties: [...coreProps, newProp] };
        saveActivities(all);
        markActivityModified(all[coreIdx].type);
        // Mark as hidden on Today view by default
        try {
          const stored = localStorage.getItem('pra_hidden_properties');
          const hidden: string[] = stored ? JSON.parse(stored) : [];
          if (!hidden.includes(newProp)) {
            localStorage.setItem('pra_hidden_properties', JSON.stringify([...hidden, newProp]));
          }
        } catch { /* */ }
      }
    }
  }, []);

  const [startedAt, setStartedAt] = useState(existingActivity?.startedAt || new Date().toISOString());
  const [completedAt, setCompletedAt] = useState(existingActivity?.completedAt || new Date().toISOString());
  const originalCompletedAt = useRef(existingActivity?.completedAt || new Date().toISOString());
  const originalDuration = useRef(existingActivity?.actualDurationSeconds || 0);
  const [nowActive, setNowActive] = useState(false);
  const actualDurationRef = useRef<number>(existingActivity?.actualDurationSeconds || 0);
  // Track the saved activity ID for new records
  const savedIdRef = useRef<string | null>(existingActivity?.id || null);

  const [newComment, setNewComment] = useState('');
  const [newCommentRating, setNewCommentRating] = useState<Rating | null>(null);
  const [localComments, setLocalComments] = useState<ActivityComment[]>(
    () => existingActivity ? getActivityComments(existingActivity) : []
  );

  // Save new activity (first time) or update existing
  const ensureSaved = useCallback((): string => {
    if (savedIdRef.current) return savedIdRef.current;

    const id = generateId();
    const now = new Date().toISOString();

    // Find previous activity of same type in current session to auto-link
    const sessionStart = localStorage.getItem('pra_session_start') || now;
    const todayEntry = getDayEntry(getTodayDate());
    const prevInSession = todayEntry?.activities
      .filter(a => a.type === activity.type && new Date(a.completedAt || a.startedAt) >= new Date(sessionStart))
      .sort((a, b) => new Date(b.completedAt || b.startedAt).getTime() - new Date(a.completedAt || a.startedAt).getTime())
      [0];

    const newActivity: Activity = {
      id,
      type: activity.type,
      startedAt,
      completedAt: now,
      durationMinutes: isOriginallyTimed ? effectiveDuration : null,
      actualDurationSeconds: isOriginallyTimed
        ? actualDurationRef.current || (effectiveDuration || 0) * 60
        : overrideDuration !== null ? overrideDuration * 60 : undefined,
      selectedVariant: selectedVariant || undefined,
      ratingBefore: isOriginallyTimed ? (ratingBefore || undefined) : undefined,
      ratingAfter: isOriginallyTimed ? (ratingAfter || undefined) : undefined,
      rating: !isOriginallyTimed ? (rating || undefined) : undefined,
      comments: [],
      linkedFromId: prevInSession?.id,
    };
    addActivity(newActivity);

    // Update previous activity's linkedActivityIds
    if (prevInSession) {
      updateActivityById(prevInSession.id, {
        linkedActivityIds: [...(prevInSession.linkedActivityIds || []), id],
      });
    }

    savedIdRef.current = id;
    return id;
  }, [activity, startedAt, isTimed, isOriginallyTimed, overrideDuration, selectedVariant, ratingBefore, ratingAfter, rating]);


  const persistComments = useCallback((updated: ActivityComment[]) => {
    if (savedIdRef.current) {
      updateActivityById(savedIdRef.current, { comments: updated });
    } else if (isEditing && existingActivity) {
      updateActivityById(existingActivity.id, { comments: updated });
    }
  }, [isEditing, existingActivity]);

  const handleUpdateCommentRating = useCallback((commentId: string, r: Rating) => {
    setLocalComments((prev) => {
      const updated = prev.map((c) =>
        c.id === commentId ? { ...c, rating: r, updatedAt: new Date().toISOString() } : c
      );
      persistComments(updated);
      return updated;
    });
  }, [persistComments]);

  const handleUpdateCommentTime = useCallback((commentId: string, isoTime: string) => {
    setLocalComments((prev) => {
      const updated = prev.map((c) =>
        c.id === commentId ? { ...c, createdAt: isoTime } : c
      );
      persistComments(updated);
      return updated;
    });
  }, [persistComments]);

  const handleDeleteComment = useCallback((commentId: string) => {
    setLocalComments((prev) => {
      const updated = prev.filter((c) => c.id !== commentId);
      persistComments(updated);
      return updated;
    });
  }, [persistComments]);

  const handleUpdateComment = useCallback((commentId: string, text: string) => {
    setLocalComments((prev) => {
      const updated = prev.map((c) =>
        c.id === commentId ? { ...c, text, updatedAt: new Date().toISOString() } : c
      );
      persistComments(updated);
      return updated;
    });
  }, [persistComments]);

  // Save rating/variant changes on close
  const handleClose = useCallback(() => {
    // Build final comments list including any pending text/rating
    const finalComments: ActivityComment[] = (newComment.trim() || newCommentRating)
      ? [{ id: `c-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`, text: newComment.trim(), createdAt: new Date().toISOString(), rating: newCommentRating || undefined } as ActivityComment, ...localComments]
      : localComments;

    // If editing a linked activity with no content, delete it
    if (isEditing && existingActivity && existingActivity.linkedFromId
        && finalComments.length === 0 && !selectedVariant
        && !(existingActivity.comments && existingActivity.comments.length > 0)) {
      // Remove empty linked activity
      deleteActivitiesByIds([existingActivity.id]);
      // Remove link from parent
      const parent = findActivityById(existingActivity.linkedFromId);
      if (parent) {
        updateActivityById(existingActivity.linkedFromId, {
          linkedActivityIds: (parent.activity.linkedActivityIds || []).filter(id => id !== existingActivity.id),
        });
      }
      onClose();
      return;
    }

    if (isEditing && existingActivity && onUpdateExisting) {
      onUpdateExisting(existingActivity.id, {
        startedAt,
        completedAt,
        selectedVariant: selectedVariant || undefined,
        comments: finalComments.length > 0 ? finalComments : undefined,
        actualDurationSeconds: Math.max(60, Math.round((new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 1000)),
      });
    } else if (savedIdRef.current) {
      // Update if there are any changes
      const timeChanged = completedAt !== (existingActivity?.completedAt || '') || startedAt !== (existingActivity?.startedAt || '');
      const hasNewData = finalComments.length > localComments.length || selectedVariant || timeChanged;
      if (hasNewData || localComments.length > 0) {
        updateActivityById(savedIdRef.current, {
          startedAt,
          completedAt,
          selectedVariant: selectedVariant || undefined,
          comments: finalComments.length > 0 ? finalComments : undefined,
          actualDurationSeconds: actualDurationRef.current || (isTimed ? (effectiveDuration || 0) * 60 : Math.max(60, Math.round((new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 1000))),
        });
      }
    } else if (finalComments.length > 0 || (isTimed && (actualDurationRef.current > 0 || overrideDuration !== null))) {
      // New record not saved yet — save now (has comments, timer was running, or duration was selected)
      const id = ensureSaved();
      updateActivityById(id, { comments: finalComments.length > 0 ? finalComments : undefined });
    }
    onClose();
  }, [isEditing, existingActivity, onUpdateExisting, isTimed, overrideDuration, selectedVariant, ratingBefore, ratingAfter, rating, activity, onClose, newComment, newCommentRating, localComments, onAddComment, ensureSaved, startedAt]);




  const handleTimedBeforeSubmit = () => {
    setTimedStep('timer');
  };


  const handleTimerComplete = (elapsedSeconds: number) => {
    actualDurationRef.current = elapsedSeconds;
    // Save current rating as comment before resetting for after-rating
    if (newCommentRating || newComment.trim()) {
      const comment: ActivityComment = {
        id: `c-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        text: newComment.trim(),
        createdAt: new Date().toISOString(),
        rating: newCommentRating || undefined,
      };
      setLocalComments((prev) => [comment, ...prev]);
      const id = ensureSaved();
      updateActivityById(id, { comments: [comment, ...localComments] });
    }
    setNewCommentRating(null);
    setNewComment('');
    setTimedStep('rating-after');
  };

  return (
    <div className="fixed inset-0 bg-themed-base z-50 flex flex-col">
      <div className="flex-1 overflow-auto flex flex-col">
        <div className="max-w-md mx-auto px-4 w-full flex-1 flex flex-col justify-center">
          {onEdit && (
            <div className="flex justify-center mb-2">
              <button onClick={() => { handleClose(); onEdit(); }} className="text-themed-faint hover:text-themed-muted p-1">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            </div>
          )}
          <h1 className="font-serif text-3xl text-themed-primary text-center mb-2">{activity.emoji} {activity.name}</h1>
          <p className={`text-themed-faint text-center max-w-xs mx-auto mb-4 ${
            isOriginallyTimed && timedStep === 'rating-after' ? 'font-serif text-xl' : ''
          }`}>
            {isOriginallyTimed && timedStep === 'rating-after'
              ? (language === 'cs' ? 'Jak se teď cítíš?' : 'How do you feel now?')
              : activity.description}
          </p>
          {/* Duration bubbles */}
          {!isEditing && (
            <div className="flex flex-wrap gap-1.5 mb-3 justify-center items-center">
              {(() => {
                void durationVersion;
                const stored = localStorage.getItem('pra_duration_bubbles');
                const defaultDurations = [...new Set(loadActivities().filter(a => !a.core && a.durationMinutes).map(a => a.durationMinutes!))].sort((a, b) => a - b);
                const durations: number[] = stored ? JSON.parse(stored) : defaultDurations;
                const hiddenDurs: number[] = (() => { try { const s = localStorage.getItem('pra_hidden_durations'); return s ? JSON.parse(s) : []; } catch { return []; } })();
                const hiddenSet = new Set(hiddenDurs);
                return (editingDurations ? durations : durations.filter(d => !hiddenSet.has(d))).map(d => (
                  <span key={`dur-${d}`} className="relative inline-flex">
                    <button
                      onClick={() => {
                        if (editingDurations) {
                          const next = hiddenSet.has(d) ? hiddenDurs.filter(x => x !== d) : [...hiddenDurs, d];
                          localStorage.setItem('pra_hidden_durations', JSON.stringify(next));
                          setDurationVersion(v => v + 1);
                        } else {
                          setOverrideDuration(overrideDuration === d ? null : d);
                        }
                      }}
                      className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                        editingDurations
                          ? hiddenSet.has(d) ? 'opacity-30 bg-themed-input border-themed text-themed-faint' : 'bg-themed-input border-themed text-themed-faint'
                          : overrideDuration === d ? 'bg-themed-accent border-themed-accent text-themed-accent' : 'bg-themed-input border-themed text-themed-faint hover:border-themed-medium'
                      }`}
                    >{d} m</button>
                    {editingDurations && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const next = durations.filter(x => x !== d);
                          localStorage.setItem('pra_duration_bubbles', JSON.stringify(next));
                          if (overrideDuration === d) setOverrideDuration(null);
                          setDurationVersion(v => v + 1);
                        }}
                        className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center text-[10px] leading-none"
                      >✕</button>
                    )}
                  </span>
                ));
              })()}
              {editingDurations && (
                <input type="number" value={newDurationText} onChange={(e) => setNewDurationText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const val = parseInt(newDurationText);
                      if (val > 0) {
                        const stored = localStorage.getItem('pra_duration_bubbles');
                        const durations: number[] = stored ? JSON.parse(stored) : [];
                        if (!durations.includes(val)) {
                          localStorage.setItem('pra_duration_bubbles', JSON.stringify([...durations, val].sort((a, b) => a - b)));
                          setDurationVersion(v => v + 1);
                        }
                        setNewDurationText('');
                      }
                    }
                  }}
                  placeholder="+ m"
                  className="w-14 px-2 py-1 text-xs rounded-full border border-dashed border-themed bg-themed-input text-themed-primary placeholder:text-themed-faint focus:outline-none focus:border-themed-accent text-center"
                />
              )}
              <button
                onClick={() => setEditingDurations(!editingDurations)}
                className={`w-7 h-7 text-xs rounded-full border flex items-center justify-center transition-colors ${
                  editingDurations ? 'border-themed-accent text-themed-accent' : 'border-themed text-themed-faint'
                }`}
              >{editingDurations ? '✓' : '✎'}</button>
            </div>
          )}

          <div className="flex flex-col items-center gap-1 mb-2">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2">
              <input
                type="date"
                value={toLocalDate(startedAt)}
                onChange={(e) => {
                  if (e.target.value) {
                    const current = new Date(startedAt);
                    const [y, m, d] = e.target.value.split('-').map(Number);
                    current.setFullYear(y, m - 1, d);
                    setStartedAt(current.toISOString());
                  }
                }}
                className="text-sm text-themed-faint bg-transparent border-none focus:outline-none focus:text-themed-muted cursor-pointer"
              />
              <input
                type="time"
                value={toLocalTime(startedAt)}
                onChange={(e) => {
                  if (e.target.value) {
                    const current = new Date(startedAt);
                    const [h, min] = e.target.value.split(':').map(Number);
                    current.setHours(h, min);
                    setStartedAt(current.toISOString());
                    // Recalculate duration
                    const diff = Math.round((new Date(completedAt).getTime() - current.getTime()) / 1000);
                    if (diff > 0) actualDurationRef.current = diff;
                  }
                }}
                className="text-sm text-themed-faint bg-transparent border-none focus:outline-none focus:text-themed-muted cursor-pointer"
              />
              <span className="text-sm text-themed-faint">—</span>
              <input
                type="time"
                value={toLocalTime(completedAt)}
                onChange={(e) => {
                  if (e.target.value) {
                    const end = new Date(completedAt);
                    const [h, min] = e.target.value.split(':').map(Number);
                    end.setHours(h, min);
                    setCompletedAt(end.toISOString());
                    // Recalculate duration
                    const diff = Math.round((end.getTime() - new Date(startedAt).getTime()) / 1000);
                    if (diff > 0) actualDurationRef.current = diff;
                  }
                }}
                className="text-sm text-themed-faint bg-transparent border-none focus:outline-none focus:text-themed-muted cursor-pointer"
              />
              </div>
              <button
                onClick={() => {
                  if (nowActive) {
                    setCompletedAt(originalCompletedAt.current);
                    actualDurationRef.current = originalDuration.current;
                    setNowActive(false);
                  } else {
                    const now = new Date();
                    setCompletedAt(now.toISOString());
                    const diff = Math.round((now.getTime() - new Date(startedAt).getTime()) / 1000);
                    if (diff > 0) actualDurationRef.current = diff;
                    setNowActive(true);
                  }
                }}
                className={`transition-colors ${nowActive ? 'text-themed-accent-solid' : 'text-themed-faint hover:text-themed-accent-solid'}`}
                title="now"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
            </div>
          </div>
          {onNavigateLinked && (() => {
              const current = existingActivity || (savedIdRef.current ? findActivityById(savedIdRef.current)?.activity : null);
              if (!current) return null;
              const hasFrom = !!current.linkedFromId;
              const hasTo = current.linkedActivityIds && current.linkedActivityIds.length > 0;
              if (!hasFrom && !hasTo) return null;
              // Calculate chain average mood
              const chainRatings: number[] = [];
              const collectChain = (id: string, visited: Set<string>) => {
                if (visited.has(id)) return;
                visited.add(id);
                const found = findActivityById(id);
                if (!found) return;
                const a = found.activity;
                const comments = a.comments || [];
                comments.forEach(c => { if (c.rating != null) chainRatings.push(c.rating); });
                if (a.linkedFromId) collectChain(a.linkedFromId, visited);
                if (a.linkedActivityIds) a.linkedActivityIds.forEach(lid => collectChain(lid, visited));
              };
              collectChain(current.id, new Set());
              const chainAvgEmoji = chainRatings.length > 0
                ? getMoodEmoji(chainRatings.reduce((s, r) => s + r, 0) / chainRatings.length)
                : null;

              return (
                <div className="flex items-center justify-center gap-2 mt-2">
                  {hasFrom && (
                    <button
                      onClick={() => { handleClose(); onNavigateLinked(current.linkedFromId!); }}
                      className="w-8 h-8 rounded-full bg-themed-input flex items-center justify-center text-themed-muted hover:text-themed-accent-solid transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                  )}
                  {chainAvgEmoji && <span className="text-lg">{chainAvgEmoji}</span>}
                  {hasTo && (
                    <button
                      onClick={() => { handleClose(); onNavigateLinked(current.linkedActivityIds![current.linkedActivityIds!.length - 1]); }}
                      className="w-8 h-8 rounded-full bg-themed-input flex items-center justify-center text-themed-muted hover:text-themed-accent-solid transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  )}
                </div>
              );
            })()}
          {/* Nečasové aktivity */}
          {!isOriginallyTimed && (
            <div className="space-y-3 py-2">


              <div className="flex flex-wrap gap-2 justify-center">
                {/* Show: activity properties (normal) or activity+config+core (edit) */}
                {(() => {
                  void registryVersion;
                  const activityProps = localVariants;
                  const configProps = getConfigProperties(activity.type);
                  const coreProps = (() => {
                    const all = loadActivities();
                    const core = all.find(a => a.core);
                    const stored = core?.properties || [];
                    return stored.length > 0 ? stored : getConfigProperties('nalada');
                  })();
                  const allProps = editingVariants
                    ? [...new Set([...configProps, ...activityProps, ...coreProps])].filter(p => !deletedVariants.has(p))
                    : activityProps;
                  return editingVariants
                    ? allProps.sort((a, b) => {
                        const aIsEmoji = /^\p{Emoji}/u.test(a);
                        const bIsEmoji = /^\p{Emoji}/u.test(b);
                        if (aIsEmoji !== bIsEmoji) return aIsEmoji ? 1 : -1;
                        return a.localeCompare(b, language);
                      })
                    : allProps;
                })().map((prop) => (
                  <span key={prop} className="relative inline-flex">
                    <button
                      onClick={() => {
                        if (editingVariants) {
                          const isActive = localVariants.includes(prop) && !disabledVariants.has(prop);
                          if (isActive) {
                            // Deactivate
                            setDisabledVariants(prev => { const n = new Set(prev); n.add(prop); return n; });
                          } else {
                            // Activate
                            if (!localVariants.includes(prop)) setLocalVariants(prev => [...prev, prop]);
                            setDisabledVariants(prev => { const n = new Set(prev); n.delete(prop); return n; });
                          }
                        } else {
                          setNewComment((prev) => prev ? `${prev}, ${prop}` : prop);
                        }
                      }}
                      className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                        editingVariants
                          ? localVariants.includes(prop) && !disabledVariants.has(prop)
                            ? 'bg-themed-accent border-themed-accent text-themed-accent'
                            : 'opacity-30 bg-themed-input border-themed text-themed-faint'
                          : 'bg-themed-input border-themed text-themed-muted hover:border-themed-accent hover:text-themed-accent-solid'
                      }`}
                    >{prop}</button>
                    {editingVariants && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          // Remove from this activity + core in one save
                          const all = loadActivities();
                          const idx = all.findIndex(a => a.type === activity.type);
                          if (idx >= 0) {
                            all[idx] = { ...all[idx], properties: (all[idx].properties || []).filter(p => p !== prop) };
                            markActivityModified(activity.type);
                          }
                          const coreIdx = all.findIndex(a => a.core);
                          if (coreIdx >= 0 && coreIdx !== idx && all[coreIdx].properties?.includes(prop)) {
                            all[coreIdx] = { ...all[coreIdx], properties: all[coreIdx].properties!.filter(p => p !== prop) };
                            markActivityModified(all[coreIdx].type);
                          }
                          saveActivities(all);
                          setLocalVariants(prev => prev.filter(v => v !== prop));
                          setDeletedVariants(prev => { const n = new Set(prev); n.add(prop); return n; });
                          setRegistryVersion(v => v + 1);
                        }}
                        className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center text-[10px] leading-none"
                      >✕</button>
                    )}
                  </span>
                ))}
                {editingVariants && (
                  <input
                    value={newVariantText}
                    onChange={(e) => setNewVariantText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const text = newVariantText.trim(); if (text) { addToRegistry(text); bubbleToCore(text); setNewVariantText(''); setRegistryVersion(v => v + 1); } } }}
                    onBlur={() => { const text = newVariantText.trim(); if (text) { addToRegistry(text); bubbleToCore(text); setNewVariantText(''); setRegistryVersion(v => v + 1); } }}
                    placeholder="+"
                    className="w-20 px-2 py-1.5 text-sm rounded-full border border-dashed border-themed bg-themed-input text-themed-primary placeholder:text-themed-faint focus:outline-none focus:border-themed-accent"
                  />
                )}
                <button
                  onClick={() => {
                    if (editingVariants) {
                      const active = localVariants.filter(v => !disabledVariants.has(v));
                      persistVariants(active);
                      setLocalVariants(active);
                      setDisabledVariants(new Set());
                    }
                    setEditingVariants(!editingVariants);
                  }}
                  className={`w-7 h-7 text-xs rounded-full border flex items-center justify-center transition-colors ${
                    editingVariants ? 'border-themed-accent text-themed-accent' : 'border-themed text-themed-faint'
                  }`}
                >{editingVariants ? '✓' : '✎'}</button>
              </div>

              <CommentsBlock
                comments={localComments}
                newComment={newComment}
                setNewComment={setNewComment}
                newRating={newCommentRating}
                setNewRating={setNewCommentRating}

                onUpdate={handleUpdateComment}
                onUpdateRating={handleUpdateCommentRating}
                onUpdateTime={handleUpdateCommentTime}
                onDelete={handleDeleteComment}
                lang={language}
                t={t}
              />
            </div>
          )}

          {/* Časové aktivity - před */}
          {isOriginallyTimed && timedStep === 'rating-before' && (
            <div className="space-y-3 py-2">

              <div className="pt-2 space-y-3">
              <div className="flex flex-wrap gap-2 justify-center">
                {/* Show: activity properties (normal) or activity+config+core (edit) */}
                {(() => {
                  void registryVersion;
                  const activityProps = localVariants;
                  const configProps = getConfigProperties(activity.type);
                  const coreProps = (() => {
                    const all = loadActivities();
                    const core = all.find(a => a.core);
                    const stored = core?.properties || [];
                    return stored.length > 0 ? stored : getConfigProperties('nalada');
                  })();
                  const allProps = editingVariants
                    ? [...new Set([...configProps, ...activityProps, ...coreProps])].filter(p => !deletedVariants.has(p))
                    : activityProps;
                  return editingVariants
                    ? allProps.sort((a, b) => {
                        const aIsEmoji = /^\p{Emoji}/u.test(a);
                        const bIsEmoji = /^\p{Emoji}/u.test(b);
                        if (aIsEmoji !== bIsEmoji) return aIsEmoji ? 1 : -1;
                        return a.localeCompare(b, language);
                      })
                    : allProps;
                })().map((prop) => (
                  <span key={prop} className="relative inline-flex">
                    <button
                      onClick={() => {
                        if (editingVariants) {
                          const isActive = localVariants.includes(prop) && !disabledVariants.has(prop);
                          if (isActive) {
                            // Deactivate
                            setDisabledVariants(prev => { const n = new Set(prev); n.add(prop); return n; });
                          } else {
                            // Activate
                            if (!localVariants.includes(prop)) setLocalVariants(prev => [...prev, prop]);
                            setDisabledVariants(prev => { const n = new Set(prev); n.delete(prop); return n; });
                          }
                        } else {
                          setNewComment((prev) => prev ? `${prev}, ${prop}` : prop);
                        }
                      }}
                      className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                        editingVariants
                          ? localVariants.includes(prop) && !disabledVariants.has(prop)
                            ? 'bg-themed-accent border-themed-accent text-themed-accent'
                            : 'opacity-30 bg-themed-input border-themed text-themed-faint'
                          : 'bg-themed-input border-themed text-themed-muted hover:border-themed-accent hover:text-themed-accent-solid'
                      }`}
                    >{prop}</button>
                    {editingVariants && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          // Remove from this activity + core in one save
                          const all = loadActivities();
                          const idx = all.findIndex(a => a.type === activity.type);
                          if (idx >= 0) {
                            all[idx] = { ...all[idx], properties: (all[idx].properties || []).filter(p => p !== prop) };
                            markActivityModified(activity.type);
                          }
                          const coreIdx = all.findIndex(a => a.core);
                          if (coreIdx >= 0 && coreIdx !== idx && all[coreIdx].properties?.includes(prop)) {
                            all[coreIdx] = { ...all[coreIdx], properties: all[coreIdx].properties!.filter(p => p !== prop) };
                            markActivityModified(all[coreIdx].type);
                          }
                          saveActivities(all);
                          setLocalVariants(prev => prev.filter(v => v !== prop));
                          setDeletedVariants(prev => { const n = new Set(prev); n.add(prop); return n; });
                          setRegistryVersion(v => v + 1);
                        }}
                        className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center text-[10px] leading-none"
                      >✕</button>
                    )}
                  </span>
                ))}
                {editingVariants && (
                  <input
                    value={newVariantText}
                    onChange={(e) => setNewVariantText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const text = newVariantText.trim(); if (text) { addToRegistry(text); bubbleToCore(text); setNewVariantText(''); setRegistryVersion(v => v + 1); } } }}
                    onBlur={() => { const text = newVariantText.trim(); if (text) { addToRegistry(text); bubbleToCore(text); setNewVariantText(''); setRegistryVersion(v => v + 1); } }}
                    placeholder="+"
                    className="w-20 px-2 py-1.5 text-sm rounded-full border border-dashed border-themed bg-themed-input text-themed-primary placeholder:text-themed-faint focus:outline-none focus:border-themed-accent"
                  />
                )}
                <button
                  onClick={() => {
                    if (editingVariants) {
                      const active = localVariants.filter(v => !disabledVariants.has(v));
                      persistVariants(active);
                      setLocalVariants(active);
                      setDisabledVariants(new Set());
                    }
                    setEditingVariants(!editingVariants);
                  }}
                  className={`w-7 h-7 text-xs rounded-full border flex items-center justify-center transition-colors ${
                    editingVariants ? 'border-themed-accent text-themed-accent' : 'border-themed text-themed-faint'
                  }`}
                >{editingVariants ? '✓' : '✎'}</button>
              </div>

                <CommentsBlock
                  comments={localComments}
                  newComment={newComment}
                  setNewComment={setNewComment}
                  newRating={newCommentRating}
                  setNewRating={setNewCommentRating}

                  onUpdate={handleUpdateComment}
                  onUpdateRating={handleUpdateCommentRating}
                  lang={language}
                  t={t}
                />

                <div className="flex gap-2 max-w-xs mx-auto">
                  <button onClick={handleTimedBeforeSubmit} className="btn-primary flex-1">
                    {t.flow.start} ({effectiveDuration} min)
                  </button>
                  <button
                    onClick={() => {
                      actualDurationRef.current = (effectiveDuration || 0) * 60;
                      handleClose();
                    }}
                    className="px-3 py-2 rounded-xl border transition-colors text-sm text-themed-faint hover:text-themed-muted"
                    style={{ borderColor: 'var(--border-light)' }}
                  >
                    {t.flow.done}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Časové aktivity - timer */}
          {isOriginallyTimed && timedStep === 'timer' && effectiveDuration && (
            <Timer
              durationMinutes={effectiveDuration}
              onComplete={handleTimerComplete}
              onCancel={handleClose}
              onElapsedChange={(s) => { actualDurationRef.current = s; }}
              note={localComments.length > 0 ? localComments[0].text : ''}
              startedAt={startedAt}
            />
          )}

          {/* Časové aktivity - po (a edit mód) */}
          {isOriginallyTimed && timedStep === 'rating-after' && (
            <div className="space-y-3 py-2">


              <div className="flex flex-wrap gap-2 justify-center">
                {/* Show: activity properties (normal) or activity+config+core (edit) */}
                {(() => {
                  void registryVersion;
                  const activityProps = localVariants;
                  const configProps = getConfigProperties(activity.type);
                  const coreProps = (() => {
                    const all = loadActivities();
                    const core = all.find(a => a.core);
                    const stored = core?.properties || [];
                    return stored.length > 0 ? stored : getConfigProperties('nalada');
                  })();
                  const allProps = editingVariants
                    ? [...new Set([...configProps, ...activityProps, ...coreProps])].filter(p => !deletedVariants.has(p))
                    : activityProps;
                  return editingVariants
                    ? allProps.sort((a, b) => {
                        const aIsEmoji = /^\p{Emoji}/u.test(a);
                        const bIsEmoji = /^\p{Emoji}/u.test(b);
                        if (aIsEmoji !== bIsEmoji) return aIsEmoji ? 1 : -1;
                        return a.localeCompare(b, language);
                      })
                    : allProps;
                })().map((prop) => (
                  <span key={prop} className="relative inline-flex">
                    <button
                      onClick={() => {
                        if (editingVariants) {
                          const isActive = localVariants.includes(prop) && !disabledVariants.has(prop);
                          if (isActive) {
                            // Deactivate
                            setDisabledVariants(prev => { const n = new Set(prev); n.add(prop); return n; });
                          } else {
                            // Activate
                            if (!localVariants.includes(prop)) setLocalVariants(prev => [...prev, prop]);
                            setDisabledVariants(prev => { const n = new Set(prev); n.delete(prop); return n; });
                          }
                        } else {
                          setNewComment((prev) => prev ? `${prev}, ${prop}` : prop);
                        }
                      }}
                      className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                        editingVariants
                          ? localVariants.includes(prop) && !disabledVariants.has(prop)
                            ? 'bg-themed-accent border-themed-accent text-themed-accent'
                            : 'opacity-30 bg-themed-input border-themed text-themed-faint'
                          : 'bg-themed-input border-themed text-themed-muted hover:border-themed-accent hover:text-themed-accent-solid'
                      }`}
                    >{prop}</button>
                    {editingVariants && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          // Remove from this activity + core in one save
                          const all = loadActivities();
                          const idx = all.findIndex(a => a.type === activity.type);
                          if (idx >= 0) {
                            all[idx] = { ...all[idx], properties: (all[idx].properties || []).filter(p => p !== prop) };
                            markActivityModified(activity.type);
                          }
                          const coreIdx = all.findIndex(a => a.core);
                          if (coreIdx >= 0 && coreIdx !== idx && all[coreIdx].properties?.includes(prop)) {
                            all[coreIdx] = { ...all[coreIdx], properties: all[coreIdx].properties!.filter(p => p !== prop) };
                            markActivityModified(all[coreIdx].type);
                          }
                          saveActivities(all);
                          setLocalVariants(prev => prev.filter(v => v !== prop));
                          setDeletedVariants(prev => { const n = new Set(prev); n.add(prop); return n; });
                          setRegistryVersion(v => v + 1);
                        }}
                        className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center text-[10px] leading-none"
                      >✕</button>
                    )}
                  </span>
                ))}
                {editingVariants && (
                  <input
                    value={newVariantText}
                    onChange={(e) => setNewVariantText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const text = newVariantText.trim(); if (text) { addToRegistry(text); bubbleToCore(text); setNewVariantText(''); setRegistryVersion(v => v + 1); } } }}
                    onBlur={() => { const text = newVariantText.trim(); if (text) { addToRegistry(text); bubbleToCore(text); setNewVariantText(''); setRegistryVersion(v => v + 1); } }}
                    placeholder="+"
                    className="w-20 px-2 py-1.5 text-sm rounded-full border border-dashed border-themed bg-themed-input text-themed-primary placeholder:text-themed-faint focus:outline-none focus:border-themed-accent"
                  />
                )}
                <button
                  onClick={() => {
                    if (editingVariants) {
                      const active = localVariants.filter(v => !disabledVariants.has(v));
                      persistVariants(active);
                      setLocalVariants(active);
                      setDisabledVariants(new Set());
                    }
                    setEditingVariants(!editingVariants);
                  }}
                  className={`w-7 h-7 text-xs rounded-full border flex items-center justify-center transition-colors ${
                    editingVariants ? 'border-themed-accent text-themed-accent' : 'border-themed text-themed-faint'
                  }`}
                >{editingVariants ? '✓' : '✎'}</button>
              </div>

              <CommentsBlock
                comments={localComments}
                newComment={newComment}
                setNewComment={setNewComment}
                newRating={newCommentRating}
                setNewRating={setNewCommentRating}

                onUpdate={handleUpdateComment}
                onUpdateRating={handleUpdateCommentRating}
                onUpdateTime={handleUpdateCommentTime}
                onDelete={handleDeleteComment}
                lang={language}
                t={t}
              />
            </div>
          )}
        </div>
      </div>

      <nav className="border-t" style={{ backgroundColor: 'var(--bg-nav)', borderColor: 'var(--border-light)' }}>
        <div className="max-w-md mx-auto flex items-center justify-around py-3">
          {(['settings', 'today', 'time', 'info'] as const).map((page) => (
            <button
              key={page}
              onClick={() => { handleClose(); if (onNavigatePage) onNavigatePage(page); }}
              className="p-4 transition-colors"
              style={{ color: 'var(--text-faint)' }}
            >
              {page === 'settings' && (
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
              {page === 'today' && (
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              )}
              {page === 'time' && (
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              )}
              {page === 'info' && (
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
