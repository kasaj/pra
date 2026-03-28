import { useState, useRef, useCallback } from 'react';
import { Activity, ActivityDefinition, ActivityComment, Rating } from '../types';
import { useLanguage } from '../i18n';
import { generateId, addActivity, updateActivityById } from '../utils/storage';
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

function formatCommentTime(isoStr: string, lang: string): string {
  return new Date(isoStr).toLocaleTimeString(lang === 'cs' ? 'cs-CZ' : 'en-US', { hour: '2-digit', minute: '2-digit' });
}

function CommentsBlock({ comments, newComment, setNewComment, onAdd, onUpdate, lang, t }: {
  comments: ActivityComment[];
  newComment: string;
  setNewComment: (v: string) => void;
  onAdd: () => void;
  onUpdate?: (commentId: string, text: string) => void;
  lang: string;
  t: ReturnType<typeof useLanguage>['t'];
}) {
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder={t.time.commentPlaceholder}
          className="flex-1 p-3 rounded-xl bg-themed-input border border-themed
                   focus:outline-none focus:border-themed-accent resize-none h-14
                   text-themed-primary placeholder:text-themed-faint text-sm"
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
      {comments.map((comment) => (
        <div key={comment.id} className="space-y-1">
          <div className="text-xs text-themed-faint">
            {formatCommentTime(comment.createdAt, lang)}
            {comment.updatedAt && ` (${formatCommentTime(comment.updatedAt, lang)})`}
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
                     text-themed-primary text-sm"
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

export default function ActivityFlow({ activity, onClose, onEdit, existingActivity, onUpdateExisting, onAddComment, onUpdateComment, onNavigateLinked, onNavigatePrev: _onNavigatePrev, onNavigateNext: _onNavigateNext, onCreateLinked }: ActivityFlowProps) {
  const { t, language } = useLanguage();
  const isTimed = activity.durationMinutes !== null;
  const isEditing = !!existingActivity;

  const [timedStep, setTimedStep] = useState<TimedFlowStep>(isEditing ? 'rating-after' : 'rating-before');
  const [selectedVariant, setSelectedVariant] = useState<string | null>(existingActivity?.selectedVariant || null);
  const [ratingBefore, setRatingBefore] = useState<Rating | null>(existingActivity?.ratingBefore || null);
  const [ratingAfter, setRatingAfter] = useState<Rating | null>(existingActivity?.ratingAfter || existingActivity?.ratingBefore || null);

  const [rating, setRating] = useState<Rating | null>(existingActivity?.rating || null);

  const [startedAt] = useState(existingActivity?.startedAt || new Date().toISOString());
  const actualDurationRef = useRef<number>(existingActivity?.actualDurationSeconds || 0);
  // Track the saved activity ID for new records
  const savedIdRef = useRef<string | null>(existingActivity?.id || null);

  const [newComment, setNewComment] = useState('');
  const [localComments, setLocalComments] = useState<ActivityComment[]>(
    () => existingActivity ? getActivityComments(existingActivity) : []
  );

  // Save new activity (first time) or update existing
  const ensureSaved = useCallback((): string => {
    if (savedIdRef.current) return savedIdRef.current;

    const id = generateId();
    const now = new Date().toISOString();
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
    };
    addActivity(newActivity);
    savedIdRef.current = id;
    return id;
  }, [activity, startedAt, isTimed, selectedVariant, ratingBefore, ratingAfter, rating]);

  const handleAddNewComment = useCallback(() => {
    if (!newComment.trim()) return;

    const comment: ActivityComment = {
      id: `c-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      text: newComment.trim(),
      createdAt: new Date().toISOString(),
    };

    setLocalComments((prev) => [comment, ...prev]);

    if (isEditing && onAddComment) {
      // Editing existing record - use parent callback
      onAddComment(newComment.trim());
    } else {
      // New record - ensure saved, then update comments
      const id = ensureSaved();
      const allComments = [comment, ...localComments];
      updateActivityById(id, { comments: allComments });
    }

    setNewComment('');
  }, [newComment, isEditing, onAddComment, ensureSaved, localComments]);

  const handleUpdateComment = useCallback((commentId: string, text: string) => {
    setLocalComments((prev) => prev.map((c) =>
      c.id === commentId ? { ...c, text, updatedAt: new Date().toISOString() } : c
    ));
    if (isEditing && onUpdateComment) {
      onUpdateComment(commentId, text);
    } else if (savedIdRef.current) {
      const updated = localComments.map((c) =>
        c.id === commentId ? { ...c, text, updatedAt: new Date().toISOString() } : c
      );
      updateActivityById(savedIdRef.current, { comments: updated });
    }
  }, [isEditing, onUpdateComment, localComments]);

  // Save rating/variant changes on close
  const handleClose = useCallback(() => {
    // Auto-save pending comment text
    if (newComment.trim()) {
      const comment: ActivityComment = {
        id: `c-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        text: newComment.trim(),
        createdAt: new Date().toISOString(),
      };
      const updatedComments = [comment, ...localComments];
      if (isEditing && onAddComment) {
        onAddComment(newComment.trim());
      } else if (savedIdRef.current) {
        updateActivityById(savedIdRef.current, { comments: updatedComments });
      } else {
        // New record not yet saved — ensure saved first, then add comment
        const id = ensureSaved();
        updateActivityById(id, { comments: updatedComments });
      }
    }

    if (isEditing && existingActivity && onUpdateExisting) {
      if (isTimed) {
        onUpdateExisting(existingActivity.id, {
          selectedVariant: selectedVariant || undefined,
          ratingBefore: ratingBefore || undefined,
          ratingAfter: ratingAfter || undefined,
        });
      } else {
        onUpdateExisting(existingActivity.id, {
          selectedVariant: selectedVariant || undefined,
          rating: rating || undefined,
        });
      }
    } else if (savedIdRef.current) {
      // Update existing new record with latest rating/variant
      if (isTimed) {
        updateActivityById(savedIdRef.current, {
          selectedVariant: selectedVariant || undefined,
          ratingBefore: ratingBefore || undefined,
          ratingAfter: ratingAfter || undefined,
          actualDurationSeconds: actualDurationRef.current || (activity.durationMinutes || 0) * 60,
        });
      } else {
        updateActivityById(savedIdRef.current, {
          selectedVariant: selectedVariant || undefined,
          rating: rating || undefined,
        });
      }
    }
    onClose();
  }, [isEditing, existingActivity, onUpdateExisting, isTimed, selectedVariant, ratingBefore, ratingAfter, rating, activity, onClose, newComment, localComments, onAddComment, ensureSaved]);

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
          {isEditing && existingActivity && (
            <div className="text-center text-xs text-themed-faint mb-2">
              {new Date(existingActivity.startedAt).toLocaleDateString(language === 'cs' ? 'cs-CZ' : 'en-US', { weekday: 'short', day: 'numeric', month: 'short' })}
              {' '}
              {new Date(existingActivity.startedAt).toLocaleTimeString(language === 'cs' ? 'cs-CZ' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
          {/* Nečasové aktivity */}
          {!isTimed && (
            <div className="space-y-6 py-6">
              <p className="text-center text-themed-muted leading-relaxed">
                {activity.description}
              </p>

              {activity.variants && activity.variants.length > 0 && (
                <div className="flex flex-wrap gap-2 justify-center">
                  {activity.variants.map((variant) => (
                    <button
                      key={variant}
                      onClick={() => handleVariantClick(variant)}
                      className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                        selectedVariant === variant
                          ? 'bg-themed-accent border-themed-accent text-themed-accent'
                          : 'bg-themed-input border-themed text-themed-muted hover:border-themed-medium'
                      }`}
                    >
                      {variant}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex justify-center">
                <StarRating value={rating} onChange={setRating} size="lg" />
              </div>

              <CommentsBlock
                comments={localComments}
                newComment={newComment}
                setNewComment={setNewComment}
                onAdd={handleAddNewComment}
                onUpdate={handleUpdateComment}
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

              {activity.variants && activity.variants.length > 0 && (
                <div className="flex flex-wrap gap-2 justify-center">
                  {activity.variants.map((variant) => (
                    <button
                      key={variant}
                      onClick={() => handleVariantClick(variant)}
                      className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                        selectedVariant === variant
                          ? 'bg-themed-accent border-themed-accent text-themed-accent'
                          : 'bg-themed-input border-themed text-themed-muted hover:border-themed-medium'
                      }`}
                    >
                      {variant}
                    </button>
                  ))}
                </div>
              )}

              <div className="pt-4 space-y-4">
                <h3 className="font-serif text-lg text-themed-secondary text-center">
                  {t.flow.howFeelNow}
                </h3>

                <div className="flex justify-center py-2">
                  <StarRating value={ratingBefore} onChange={setRatingBefore} size="lg" />
                </div>

                <CommentsBlock
                  comments={localComments}
                  newComment={newComment}
                  setNewComment={setNewComment}
                  onAdd={handleAddNewComment}
                  onUpdate={handleUpdateComment}
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

              {activity.variants && activity.variants.length > 0 && (
                <div className="flex flex-wrap gap-2 justify-center">
                  {activity.variants.map((variant) => (
                    <button
                      key={variant}
                      onClick={() => handleVariantClick(variant)}
                      className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                        selectedVariant === variant
                          ? 'bg-themed-accent border-themed-accent text-themed-accent'
                          : 'bg-themed-input border-themed text-themed-muted hover:border-themed-medium'
                      }`}
                    >
                      {variant}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex justify-center py-4">
                <StarRating value={ratingAfter} onChange={setRatingAfter} size="lg" />
              </div>

              <CommentsBlock
                comments={localComments}
                newComment={newComment}
                setNewComment={setNewComment}
                onAdd={handleAddNewComment}
                onUpdate={handleUpdateComment}
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
