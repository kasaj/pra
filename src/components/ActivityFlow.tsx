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

function CommentsBlock({ comments, newComment, setNewComment, newRating, setNewRating, onUpdate, onUpdateRating, onUpdateTime, onDelete, lang: _lang, t }: {
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
      <div className="space-y-2">
        <div className="flex justify-center">
          <StarRating value={newRating} onChange={setNewRating} size="sm" />
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
            className="w-full p-3 rounded-xl bg-themed-input border border-themed
                     focus:outline-none focus:border-themed-accent resize-none min-h-[3.5rem]
                     text-themed-primary placeholder:text-themed-faint text-base overflow-hidden"
          />
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
            ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
            onChange={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
            onBlur={(e) => {
              if (e.target.value !== comment.text && onUpdate) {
                onUpdate(comment.id, e.target.value);
              }
            }}
            className="w-full p-3 rounded-xl bg-themed-input border border-themed
                     focus:outline-none focus:border-themed-accent resize-none min-h-[3.5rem]
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
}

export default function ActivityFlow({ activity, onClose, onEdit: _onEdit, existingActivity, onUpdateExisting, onAddComment, onUpdateComment: _onUpdateComment, onNavigateLinked: _onNavigateLinked, onNavigatePrev: _onNavigatePrev, onNavigateNext: _onNavigateNext, onCreateLinked: _onCreateLinked, onNavigatePage }: ActivityFlowProps) {
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
    } else if (finalComments.length > 0 || (isTimed && actualDurationRef.current > 0)) {
      // New record not saved yet — save now (has comments or timer was running)
      const id = ensureSaved();
      updateActivityById(id, { comments: finalComments.length > 0 ? finalComments : undefined });
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


  const handleTimerComplete = (elapsedSeconds: number) => {
    actualDurationRef.current = elapsedSeconds;
    setTimedStep('rating-after');
  };

  return (
    <div className="fixed inset-0 bg-themed-base z-50 flex flex-col">
      <div className="flex-1 overflow-auto">
        <div className="max-w-md mx-auto p-4">
          <div className="flex flex-col items-center gap-0.5 mb-2">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{activity.emoji}</span>
              <h2 className="font-serif text-xl text-themed-primary">{activity.name}</h2>
            </div>
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
                className="text-center text-sm text-themed-faint bg-transparent border-none focus:outline-none focus:text-themed-muted cursor-pointer"
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
                  }
                }}
                className="text-center text-sm text-themed-faint bg-transparent border-none focus:outline-none focus:text-themed-muted cursor-pointer"
              />
            </div>
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
            <div className="space-y-3 py-2">
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
                    className={`w-7 h-7 text-xs rounded-full border flex items-center justify-center transition-colors ${
                      editingVariants ? 'border-themed-accent text-themed-accent' : 'border-themed text-themed-faint'
                    }`}
                  >
                    {editingVariants ? '✓' : '+'}
                  </button>
                  {editingVariants && (
                    <button
                      onClick={() => setShowVariantRegistry(!showVariantRegistry)}
                      className={`w-7 h-7 text-xs rounded-full border flex items-center justify-center transition-colors ${
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
            <div className="space-y-3 py-2">
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
                    className={`w-7 h-7 text-xs rounded-full border flex items-center justify-center transition-colors ${
                      editingVariants ? 'border-themed-accent text-themed-accent' : 'border-themed text-themed-faint'
                    }`}
                  >
                    {editingVariants ? '✓' : '+'}
                  </button>
                  {editingVariants && (
                    <button
                      onClick={() => setShowVariantRegistry(!showVariantRegistry)}
                      className={`w-7 h-7 text-xs rounded-full border flex items-center justify-center transition-colors ${
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

              <div className="pt-2 space-y-3">
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

                <button onClick={handleTimedBeforeSubmit} className="btn-primary w-full">
                  {t.flow.start} ({activity.durationMinutes} min)
                </button>
              </div>
            </div>
          )}

          {/* Časové aktivity - timer */}
          {isTimed && timedStep === 'timer' && activity.durationMinutes && (
            <Timer
              durationMinutes={activity.durationMinutes}
              onComplete={handleTimerComplete}
              onCancel={handleClose}
              onElapsedChange={(s) => { actualDurationRef.current = s; }}
              note={localComments.length > 0 ? localComments[0].text : ''}
              startedAt={startedAt}
            />
          )}

          {/* Časové aktivity - po (a edit mód) */}
          {isTimed && timedStep === 'rating-after' && (
            <div className="space-y-3 py-2">
              <h3 className="font-serif text-lg text-themed-muted text-center">
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
                    className={`w-7 h-7 text-xs rounded-full border flex items-center justify-center transition-colors ${
                      editingVariants ? 'border-themed-accent text-themed-accent' : 'border-themed text-themed-faint'
                    }`}
                  >
                    {editingVariants ? '✓' : '+'}
                  </button>
                  {editingVariants && (
                    <button
                      onClick={() => setShowVariantRegistry(!showVariantRegistry)}
                      className={`w-7 h-7 text-xs rounded-full border flex items-center justify-center transition-colors ${
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
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              {page === 'time' && (
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
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
