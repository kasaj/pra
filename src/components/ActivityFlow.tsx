import { useState, useRef, useCallback } from 'react';
import { Activity, ActivityDefinition, ActivityComment, Rating } from '../types';
import { useLanguage } from '../i18n';
import { generateId, addActivity, updateActivityById, getDayEntry, getTodayDate } from '../utils/storage';
import { loadActivities, saveActivities, markActivityModified } from '../utils/activities';
import { addToRegistry, loadVariantRegistry } from '../utils/variantRegistry';
import { loadMoodScale } from '../utils/moodScale';
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

function toLocalDatetime(isoStr: string): string {
  const d = new Date(isoStr);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function CommentsBlock({ comments, newComment, setNewComment, newRating, setNewRating, onAdd, onUpdate, onUpdateRating, onUpdateTime, onDelete, lang: _lang, t }: {
  comments: ActivityComment[];
  newComment: string;
  setNewComment: (v: string) => void;
  newRating: Rating | null;
  setNewRating: (r: Rating) => void;
  onAdd: () => void;
  onUpdate?: (commentId: string, text: string) => void;
  onUpdateRating?: (commentId: string, rating: Rating) => void;
  onUpdateTime?: (commentId: string, isoTime: string) => void;
  onDelete?: (commentId: string) => void;
  lang: string;
  t: ReturnType<typeof useLanguage>['t'];
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <div className="flex justify-center">
          <StarRating value={newRating} onChange={setNewRating} size="sm" />
        </div>
        <div className="flex gap-2">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder={t.time.commentPlaceholder}
            className="flex-1 p-3 rounded-xl bg-themed-input border border-themed
                     focus:outline-none focus:border-themed-accent resize-none h-14
                     text-themed-primary placeholder:text-themed-faint text-base"
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onAdd(); } }}
          />
          <button
            onClick={onAdd}
            className="px-4 rounded-xl text-sm transition-colors self-stretch"
            style={{ backgroundColor: 'var(--accent-solid)', color: 'var(--accent-text-on-solid)' }}
          >
            +
          </button>
        </div>
      </div>
      {comments.map((comment) => (
        <div key={`${comment.id}-${comment.rating || 0}`} className="space-y-1">
          <div className="flex items-center gap-2">
            <input
              type="time"
              defaultValue={new Date(comment.createdAt).toTimeString().slice(0, 5)}
              onChange={(e) => {
                if (e.target.value && onUpdateTime) {
                  const d = new Date(comment.createdAt);
                  const [h, m] = e.target.value.split(':').map(Number);
                  d.setHours(h, m);
                  onUpdateTime(comment.id, d.toISOString());
                }
              }}
              className="text-xs text-themed-faint bg-transparent border-none focus:outline-none focus:text-themed-muted w-14 cursor-pointer"
            />
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
            onBlur={(e) => {
              if (e.target.value !== comment.text && onUpdate) {
                onUpdate(comment.id, e.target.value);
              }
            }}
            className="w-full p-3 rounded-xl bg-themed-input border border-themed
                     focus:outline-none focus:border-themed-accent resize-none h-16
                     text-themed-primary text-base"
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
}

export default function ActivityFlow({ activity, onClose, onEdit, existingActivity, onUpdateExisting, onAddComment, onUpdateComment: _onUpdateComment, onNavigateLinked, onNavigatePrev: _onNavigatePrev, onNavigateNext: _onNavigateNext, onCreateLinked }: ActivityFlowProps) {
  const { t, language } = useLanguage();
  const isTimed = activity.durationMinutes !== null;
  const isEditing = !!existingActivity;

  const [timedStep, setTimedStep] = useState<TimedFlowStep>(isEditing ? 'rating-after' : 'rating-before');
  const [selectedVariant, setSelectedVariant] = useState<string | null>(existingActivity?.selectedVariant || null);
  const ratingBefore = existingActivity?.ratingBefore || null;
  const ratingAfter = existingActivity?.ratingAfter || null;
  const rating = existingActivity?.rating || null;

  const [localVariants, setLocalVariants] = useState<string[]>(activity.properties || []);
  const [newVariantText, setNewVariantText] = useState('');
  const [editingVariants, setEditingVariants] = useState(false);
  const [showVariantRegistry, setShowVariantRegistry] = useState(false);

  const [startedAt, setStartedAt] = useState(existingActivity?.startedAt || new Date().toISOString());
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
      durationMinutes: isTimed ? activity.durationMinutes : null,
      actualDurationSeconds: isTimed ? actualDurationRef.current || (activity.durationMinutes || 0) * 60 : undefined,
      selectedVariant: selectedVariant || undefined,
      ratingBefore: isTimed ? (ratingBefore || undefined) : undefined,
      ratingAfter: isTimed ? (ratingAfter || undefined) : undefined,
      rating: !isTimed ? (rating || undefined) : undefined,
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
  }, [activity, startedAt, isTimed, selectedVariant, ratingBefore, ratingAfter, rating]);

  const handleAddNewComment = useCallback(() => {
    if (!newComment.trim() && !newCommentRating) return;

    const comment: ActivityComment = {
      id: `c-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      text: newComment.trim(),
      createdAt: new Date().toISOString(),
      rating: newCommentRating || undefined,
    };

    setLocalComments((prev) => [comment, ...prev]);
    setNewCommentRating(null);

    if (isEditing && onAddComment) {
      onAddComment(newComment.trim());
    } else {
      // New record - ensure saved, then update comments
      const id = ensureSaved();
      const allComments = [comment, ...localComments];
      updateActivityById(id, { comments: allComments });
    }

    setNewComment('');
  }, [newComment, newCommentRating, isEditing, onAddComment, ensureSaved, localComments]);

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

    if (isEditing && existingActivity && onUpdateExisting) {
      onUpdateExisting(existingActivity.id, {
        startedAt,
        selectedVariant: selectedVariant || undefined,
        comments: finalComments.length > 0 ? finalComments : undefined,
      });
    } else if (savedIdRef.current) {
      updateActivityById(savedIdRef.current, {
        startedAt,
        selectedVariant: selectedVariant || undefined,
        comments: finalComments.length > 0 ? finalComments : undefined,
        actualDurationSeconds: isTimed ? (actualDurationRef.current || (activity.durationMinutes || 0) * 60) : undefined,
      });
    } else if (finalComments.length > 0) {
      // New record not saved yet but has pending comment — save now
      const id = ensureSaved();
      updateActivityById(id, { comments: finalComments });
    }
    onClose();
  }, [isEditing, existingActivity, onUpdateExisting, isTimed, selectedVariant, ratingBefore, ratingAfter, rating, activity, onClose, newComment, newCommentRating, localComments, onAddComment, ensureSaved, startedAt]);

  const persistVariants = useCallback((updated: string[]) => {
    const all = loadActivities();
    const idx = all.findIndex(a => a.type === activity.type);
    if (idx >= 0) {
      all[idx] = { ...all[idx], properties: updated };
      saveActivities(all);
      markActivityModified(activity.type);
    }
  }, [activity.type]);

  const handleAddVariant = useCallback(() => {
    const text = newVariantText.trim();
    if (!text || localVariants.includes(text)) return;
    const updated = [...localVariants, text];
    setLocalVariants(updated);
    setNewVariantText('');
    persistVariants(updated);
    addToRegistry(text);
  }, [newVariantText, localVariants, persistVariants]);

  const handleRemoveVariant = useCallback((variant: string) => {
    const updated = localVariants.filter(v => v !== variant);
    setLocalVariants(updated);
    if (selectedVariant === variant) setSelectedVariant(null);
    persistVariants(updated);
  }, [localVariants, selectedVariant, persistVariants]);

  const handleVariantClick = (variant: string) => {
    if (selectedVariant === variant) {
      setSelectedVariant(null);
      setNewComment((prev) => prev.replace(variant, '').replace(/^[,\s]+|[,\s]+$/g, '').replace(/\s*,\s*,\s*/g, ', '));
    } else {
      setSelectedVariant(variant);
      setNewComment((prev) => prev ? `${prev}, ${variant}` : variant);
    }
  };

  const handleTimedBeforeSubmit = () => {
    setTimedStep('timer');
  };

  const handleDone = () => {
    // Record immediately with full planned duration, skip timer
    actualDurationRef.current = (activity.durationMinutes || 0) * 60;
    ensureSaved();
    onClose();
  };

  const handleTimerComplete = (elapsedSeconds: number) => {
    actualDurationRef.current = elapsedSeconds;
    setTimedStep('rating-after');
  };

  return (
    <div className="fixed inset-0 bg-themed-base z-50 flex flex-col">
      <div className="p-4 border-b border-themed">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isEditing && existingActivity?.linkedFromId && onNavigateLinked && (
              <button
                onClick={() => onNavigateLinked(existingActivity.linkedFromId!)}
                className="w-8 h-8 rounded-full bg-themed-input flex items-center justify-center text-themed-muted hover:text-themed-accent-solid transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <span className="text-3xl">{activity.emoji}</span>
            <h2 className="font-serif text-xl text-themed-primary">{activity.name}</h2>
            {isEditing && existingActivity?.linkedActivityIds && existingActivity.linkedActivityIds.length > 0 && onNavigateLinked && (
              <button
                onClick={() => onNavigateLinked(existingActivity.linkedActivityIds![existingActivity.linkedActivityIds!.length - 1])}
                className="w-8 h-8 rounded-full bg-themed-input flex items-center justify-center text-themed-muted hover:text-themed-accent-solid transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}
          </div>
          <div className="flex items-center gap-1">
            {isEditing && onCreateLinked && (
              <button onClick={() => { handleClose(); onCreateLinked(); }} className="text-themed-faint hover:text-themed-accent-solid p-2" title={t.time.createLinked}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            )}
            {onEdit && (
              <button onClick={() => { handleClose(); onEdit(); }} className="text-themed-faint hover:text-themed-muted p-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            )}
            <button onClick={handleClose} className="text-themed-faint hover:text-themed-muted p-2">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="max-w-md mx-auto p-4">
          <div className="flex flex-col items-center gap-1 mb-2">
            <input
              type="datetime-local"
              value={toLocalDatetime(startedAt)}
              onChange={(e) => {
                if (e.target.value) setStartedAt(new Date(e.target.value).toISOString());
              }}
              className="text-center text-xs text-themed-faint bg-transparent border-none focus:outline-none focus:text-themed-muted cursor-pointer"
            />
            {(() => {
              const rated: number[] = localComments.filter(c => c.rating != null).map(c => c.rating as number);
              if (rated.length === 0) return null;
              const avg = Math.round((rated.reduce((s, r) => s + r, 0) / rated.length) * 10) / 10;
              const rounded = Math.round(Math.min(7, Math.max(1, avg)));
              return (
                <div className="flex gap-0.5 text-sm">
                  {loadMoodScale().map(({ value: v, emoji: e }) => (
                    <span key={v} className={v === rounded ? 'opacity-100' : 'grayscale opacity-30'}>{e}</span>
                  ))}
                </div>
              );
            })()}
          </div>
          {/* Nečasové aktivity */}
          {!isTimed && (
            <div className="space-y-6 py-6">
              <p className="text-center text-themed-muted leading-relaxed">
                {activity.description}
              </p>

              {(<>
                <div className="flex flex-wrap gap-2 justify-center">
                  {localVariants.map((variant) => (
                    <div key={variant} className="relative">
                      <button
                        onClick={() => handleVariantClick(variant)}
                        className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                          selectedVariant === variant
                            ? 'bg-themed-accent border-themed-accent text-themed-accent'
                            : 'bg-themed-input border-themed text-themed-muted hover:border-themed-medium'
                        }`}
                      >
                        {variant}
                      </button>
                      {editingVariants && (
                        <button
                          onClick={() => handleRemoveVariant(variant)}
                          className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-themed-warn text-white flex items-center justify-center text-xs"
                        >×</button>
                      )}
                    </div>
                  ))}
                  {editingVariants && (
                    <div className="flex gap-1">
                      <input
                        value={newVariantText}
                        onChange={(e) => setNewVariantText(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddVariant(); } }}
                        onBlur={() => handleAddVariant()}
                        placeholder="+"
                        className="w-20 px-2 py-1.5 text-sm rounded-full border border-themed bg-themed-input text-themed-primary placeholder:text-themed-faint focus:outline-none focus:border-themed-accent"
                      />
                    </div>
                  )}
                  <button
                    onClick={() => setEditingVariants(!editingVariants)}
                    className={`px-2 py-1.5 text-xs rounded-full border transition-colors ${
                      editingVariants ? 'border-themed-accent text-themed-accent' : 'border-themed text-themed-faint'
                    }`}
                  >
                    {editingVariants ? '✓' : '✎'}
                  </button>
                  {editingVariants && (
                    <button
                      onClick={() => setShowVariantRegistry(!showVariantRegistry)}
                      className={`px-2 py-1.5 text-xs rounded-full border transition-colors ${
                        showVariantRegistry ? 'border-themed-accent text-themed-accent' : 'border-themed text-themed-faint'
                      }`}
                    >
                      {showVariantRegistry ? '▲' : '▼'}
                    </button>
                  )}
                </div>
                {editingVariants && showVariantRegistry && (() => {
                  const registry = loadVariantRegistry().filter(v => !localVariants.includes(v));
                  return registry.length > 0 ? (
                    <div className="flex flex-wrap gap-2 justify-center mt-2">
                      {registry.map((v) => (
                        <button
                          key={v}
                          onClick={() => {
                            const updated = [...localVariants, v];
                            setLocalVariants(updated);
                            persistVariants(updated);
                          }}
                          className="px-3 py-1.5 text-xs rounded-full border border-dashed border-themed text-themed-faint hover:border-themed-accent hover:text-themed-accent-solid transition-colors"
                        >
                          + {v}
                        </button>
                      ))}
                    </div>
                  ) : null;
                })()}
              </>)}

              <CommentsBlock
                comments={localComments}
                newComment={newComment}
                setNewComment={setNewComment}
                newRating={newCommentRating}
                setNewRating={setNewCommentRating}
                onAdd={handleAddNewComment}
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
          {isTimed && timedStep === 'rating-before' && (
            <div className="space-y-6 py-6">
              <p className="text-center text-themed-muted leading-relaxed">
                {activity.description}
              </p>

              {(<>
                <div className="flex flex-wrap gap-2 justify-center">
                  {localVariants.map((variant) => (
                    <div key={variant} className="relative">
                      <button
                        onClick={() => handleVariantClick(variant)}
                        className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                          selectedVariant === variant
                            ? 'bg-themed-accent border-themed-accent text-themed-accent'
                            : 'bg-themed-input border-themed text-themed-muted hover:border-themed-medium'
                        }`}
                      >
                        {variant}
                      </button>
                      {editingVariants && (
                        <button
                          onClick={() => handleRemoveVariant(variant)}
                          className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-themed-warn text-white flex items-center justify-center text-xs"
                        >×</button>
                      )}
                    </div>
                  ))}
                  {editingVariants && (
                    <div className="flex gap-1">
                      <input
                        value={newVariantText}
                        onChange={(e) => setNewVariantText(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddVariant(); } }}
                        onBlur={() => handleAddVariant()}
                        placeholder="+"
                        className="w-20 px-2 py-1.5 text-sm rounded-full border border-themed bg-themed-input text-themed-primary placeholder:text-themed-faint focus:outline-none focus:border-themed-accent"
                      />
                    </div>
                  )}
                  <button
                    onClick={() => setEditingVariants(!editingVariants)}
                    className={`px-2 py-1.5 text-xs rounded-full border transition-colors ${
                      editingVariants ? 'border-themed-accent text-themed-accent' : 'border-themed text-themed-faint'
                    }`}
                  >
                    {editingVariants ? '✓' : '✎'}
                  </button>
                  {editingVariants && (
                    <button
                      onClick={() => setShowVariantRegistry(!showVariantRegistry)}
                      className={`px-2 py-1.5 text-xs rounded-full border transition-colors ${
                        showVariantRegistry ? 'border-themed-accent text-themed-accent' : 'border-themed text-themed-faint'
                      }`}
                    >
                      {showVariantRegistry ? '▲' : '▼'}
                    </button>
                  )}
                </div>
                {editingVariants && showVariantRegistry && (() => {
                  const registry = loadVariantRegistry().filter(v => !localVariants.includes(v));
                  return registry.length > 0 ? (
                    <div className="flex flex-wrap gap-2 justify-center mt-2">
                      {registry.map((v) => (
                        <button
                          key={v}
                          onClick={() => {
                            const updated = [...localVariants, v];
                            setLocalVariants(updated);
                            persistVariants(updated);
                          }}
                          className="px-3 py-1.5 text-xs rounded-full border border-dashed border-themed text-themed-faint hover:border-themed-accent hover:text-themed-accent-solid transition-colors"
                        >
                          + {v}
                        </button>
                      ))}
                    </div>
                  ) : null;
                })()}
              </>)}

              <div className="pt-4 space-y-4">
                <h3 className="font-serif text-lg text-themed-secondary text-center">
                  {t.flow.howFeelNow}
                </h3>

                <CommentsBlock
                  comments={localComments}
                  newComment={newComment}
                  setNewComment={setNewComment}
                  newRating={newCommentRating}
                  setNewRating={setNewCommentRating}
                  onAdd={handleAddNewComment}
                  onUpdate={handleUpdateComment}
                  onUpdateRating={handleUpdateCommentRating}
                  lang={language}
                  t={t}
                />

                <div className="flex gap-3">
                  <button onClick={handleTimedBeforeSubmit} className="btn-primary flex-1">
                    {t.flow.start} ({activity.durationMinutes} min)
                  </button>
                  <button
                    onClick={handleDone}
                    className="flex-1 py-3 rounded-xl border transition-colors"
                    style={{ borderColor: 'var(--accent-border)', color: 'var(--accent-text)' }}
                  >
                    {t.flow.done}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Časové aktivity - timer */}
          {isTimed && timedStep === 'timer' && activity.durationMinutes && (
            <Timer
              durationMinutes={activity.durationMinutes}
              onComplete={handleTimerComplete}
              onCancel={handleClose}
              note={localComments.length > 0 ? localComments[0].text : ''}
              startedAt={startedAt}
            />
          )}

          {/* Časové aktivity - po (a edit mód) */}
          {isTimed && timedStep === 'rating-after' && (
            <div className="space-y-6 py-8">
              <h3 className="font-serif text-2xl text-themed-primary text-center">
                {t.flow.whatShifted}
              </h3>

              {(<>
                <div className="flex flex-wrap gap-2 justify-center">
                  {localVariants.map((variant) => (
                    <div key={variant} className="relative">
                      <button
                        onClick={() => handleVariantClick(variant)}
                        className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                          selectedVariant === variant
                            ? 'bg-themed-accent border-themed-accent text-themed-accent'
                            : 'bg-themed-input border-themed text-themed-muted hover:border-themed-medium'
                        }`}
                      >
                        {variant}
                      </button>
                      {editingVariants && (
                        <button
                          onClick={() => handleRemoveVariant(variant)}
                          className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-themed-warn text-white flex items-center justify-center text-xs"
                        >×</button>
                      )}
                    </div>
                  ))}
                  {editingVariants && (
                    <div className="flex gap-1">
                      <input
                        value={newVariantText}
                        onChange={(e) => setNewVariantText(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddVariant(); } }}
                        onBlur={() => handleAddVariant()}
                        placeholder="+"
                        className="w-20 px-2 py-1.5 text-sm rounded-full border border-themed bg-themed-input text-themed-primary placeholder:text-themed-faint focus:outline-none focus:border-themed-accent"
                      />
                    </div>
                  )}
                  <button
                    onClick={() => setEditingVariants(!editingVariants)}
                    className={`px-2 py-1.5 text-xs rounded-full border transition-colors ${
                      editingVariants ? 'border-themed-accent text-themed-accent' : 'border-themed text-themed-faint'
                    }`}
                  >
                    {editingVariants ? '✓' : '✎'}
                  </button>
                  {editingVariants && (
                    <button
                      onClick={() => setShowVariantRegistry(!showVariantRegistry)}
                      className={`px-2 py-1.5 text-xs rounded-full border transition-colors ${
                        showVariantRegistry ? 'border-themed-accent text-themed-accent' : 'border-themed text-themed-faint'
                      }`}
                    >
                      {showVariantRegistry ? '▲' : '▼'}
                    </button>
                  )}
                </div>
                {editingVariants && showVariantRegistry && (() => {
                  const registry = loadVariantRegistry().filter(v => !localVariants.includes(v));
                  return registry.length > 0 ? (
                    <div className="flex flex-wrap gap-2 justify-center mt-2">
                      {registry.map((v) => (
                        <button
                          key={v}
                          onClick={() => {
                            const updated = [...localVariants, v];
                            setLocalVariants(updated);
                            persistVariants(updated);
                          }}
                          className="px-3 py-1.5 text-xs rounded-full border border-dashed border-themed text-themed-faint hover:border-themed-accent hover:text-themed-accent-solid transition-colors"
                        >
                          + {v}
                        </button>
                      ))}
                    </div>
                  ) : null;
                })()}
              </>)}

              <CommentsBlock
                comments={localComments}
                newComment={newComment}
                setNewComment={setNewComment}
                newRating={newCommentRating}
                setNewRating={setNewCommentRating}
                onAdd={handleAddNewComment}
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
    </div>
  );
}
