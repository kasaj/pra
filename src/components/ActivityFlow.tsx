import { useState, useRef } from 'react';
import { Activity, ActivityDefinition, ActivityComment, Rating } from '../types';
import { useLanguage } from '../i18n';
import { generateId, addActivity } from '../utils/storage';
import StarRating from './StarRating';
import Timer from './Timer';

type TimedFlowStep = 'rating-before' | 'timer' | 'rating-after';

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
        <input
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder={t.time.commentPlaceholder}
          className="flex-1 p-3 rounded-xl bg-themed-input border border-themed
                   focus:outline-none focus:border-themed-accent
                   text-themed-primary placeholder:text-themed-faint text-sm"
          onKeyDown={(e) => { if (e.key === 'Enter') onAdd(); }}
        />
        <button
          onClick={onAdd}
          className="px-4 py-2 rounded-xl text-sm transition-colors"
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
}

export default function ActivityFlow({ activity, onClose, onEdit, existingActivity, onUpdateExisting, onAddComment, onUpdateComment, onNavigateLinked: _onNavigateLinked, onNavigatePrev, onNavigateNext }: ActivityFlowProps) {
  const { t, language } = useLanguage();
  const isTimed = activity.durationMinutes !== null;
  const isEditing = !!existingActivity;

  const [timedStep, setTimedStep] = useState<TimedFlowStep>(isEditing ? 'rating-after' : 'rating-before');
  const [selectedVariant, setSelectedVariant] = useState<string | null>(existingActivity?.selectedVariant || null);
  const [ratingBefore, setRatingBefore] = useState<Rating | null>(existingActivity?.ratingBefore || null);
  const [ratingAfter, setRatingAfter] = useState<Rating | null>(existingActivity?.ratingAfter || existingActivity?.ratingBefore || null);
  const [noteBefore, setNoteBefore] = useState(existingActivity?.noteBefore || '');
  const [noteAfter, setNoteAfter] = useState(existingActivity?.noteAfter || existingActivity?.noteBefore || '');

  const [rating, setRating] = useState<Rating | null>(existingActivity?.rating || null);
  const [note, setNote] = useState(existingActivity?.note || '');

  const [startedAt] = useState(existingActivity?.startedAt || new Date().toISOString());
  const actualDurationRef = useRef<number>(existingActivity?.actualDurationSeconds || 0);

  const [newComment, setNewComment] = useState('');

  const handleVariantClick = (variant: string) => {
    const timedNoteSetter = (isEditing && isTimed) ? setNoteAfter : setNoteBefore;

    if (selectedVariant === variant) {
      setSelectedVariant(null);
      if (isTimed) {
        timedNoteSetter((prev) => prev.replace(variant, '').replace(/^[,\s]+|[,\s]+$/g, '').replace(/\s*,\s*,\s*/g, ', '));
      } else {
        setNote((prev) => prev.replace(variant, '').replace(/^[,\s]+|[,\s]+$/g, '').replace(/\s*,\s*,\s*/g, ', '));
      }
    } else {
      setSelectedVariant(variant);
      if (isTimed) {
        timedNoteSetter((prev) => prev ? `${prev}, ${variant}` : variant);
      } else {
        setNote((prev) => prev ? `${prev}, ${variant}` : variant);
      }
    }
  };

  const handleTimedBeforeSubmit = () => {
    setTimedStep('timer');
  };

  const handleDone = () => {
    const newActivity: Activity = {
      id: generateId(),
      type: activity.type,
      startedAt,
      completedAt: new Date().toISOString(),
      durationMinutes: activity.durationMinutes,
      actualDurationSeconds: (activity.durationMinutes || 0) * 60,
      selectedVariant: selectedVariant || undefined,
      ratingBefore: ratingBefore || undefined,
      noteBefore: noteBefore || undefined,
    };
    addActivity(newActivity);
    onClose();
  };

  const handleTimerComplete = (elapsedSeconds: number) => {
    actualDurationRef.current = elapsedSeconds;
    if (!noteAfter && noteBefore) setNoteAfter(noteBefore);
    setTimedStep('rating-after');
  };

  const handleTimedAfterSubmit = () => {
    if (isEditing && existingActivity && onUpdateExisting) {
      onUpdateExisting(existingActivity.id, {
        selectedVariant: selectedVariant || undefined,
        ratingBefore: ratingBefore || undefined,
        ratingAfter: ratingAfter || undefined,
        noteBefore: noteBefore || undefined,
        noteAfter: noteAfter || undefined,
      });
      onClose();
      return;
    }
    const newActivity: Activity = {
      id: generateId(),
      type: activity.type,
      startedAt,
      completedAt: new Date().toISOString(),
      durationMinutes: activity.durationMinutes,
      actualDurationSeconds: actualDurationRef.current,
      selectedVariant: selectedVariant || undefined,
      ratingBefore: ratingBefore || undefined,
      ratingAfter: ratingAfter || undefined,
      noteBefore: noteBefore || undefined,
      noteAfter: noteAfter || undefined,
    };

    addActivity(newActivity);
    onClose();
  };

  const handleUntimedSubmit = () => {
    if (isEditing && existingActivity && onUpdateExisting) {
      onUpdateExisting(existingActivity.id, {
        selectedVariant: selectedVariant || undefined,
        rating: rating || undefined,
        note: note || undefined,
      });
      onClose();
      return;
    }
    const newActivity: Activity = {
      id: generateId(),
      type: activity.type,
      startedAt,
      completedAt: new Date().toISOString(),
      durationMinutes: null,
      selectedVariant: selectedVariant || undefined,
      rating: rating || undefined,
      note: note || undefined,
    };

    addActivity(newActivity);
    onClose();
  };

  const handleAddNewComment = () => {
    if (!newComment.trim() || !onAddComment) return;
    onAddComment(newComment.trim());
    setNewComment('');
  };

  // Get existing comments for display in edit mode
  const existingComments: ActivityComment[] = existingActivity?.comments || [];

  return (
    <div className="fixed inset-0 bg-themed-base z-50 flex flex-col">
      <div className="p-4 border-b border-themed">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isEditing && onNavigatePrev && (
              <button
                onClick={onNavigatePrev}
                className="w-8 h-8 rounded-full bg-themed-input flex items-center justify-center text-themed-muted hover:text-themed-accent-solid transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <span className="text-3xl">{activity.emoji}</span>
            <h2 className="font-serif text-xl text-themed-primary">{activity.name}</h2>
            {isEditing && onNavigateNext && (
              <button
                onClick={onNavigateNext}
                className="w-8 h-8 rounded-full bg-themed-input flex items-center justify-center text-themed-muted hover:text-themed-accent-solid transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}
          </div>
          <div className="flex items-center gap-1">
            {onEdit && (
              <button onClick={() => { onClose(); onEdit(); }} className="text-themed-faint hover:text-themed-muted p-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            )}
            <button onClick={onClose} className="text-themed-faint hover:text-themed-muted p-2">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="max-w-md mx-auto p-4">
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

              <div className="space-y-6 pt-4">
                <div className="flex justify-center">
                  <StarRating value={rating} onChange={setRating} size="lg" />
                </div>

                {isEditing && activity.description && onAddComment && (
                  <CommentsBlock
                    comments={existingComments}
                    newComment={newComment}
                    setNewComment={setNewComment}
                    onAdd={handleAddNewComment}
                    onUpdate={onUpdateComment}
                    lang={language}
                    t={t}
                  />
                )}

                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={t.flow.notePlaceholder}
                  className="w-full p-4 rounded-xl bg-themed-input border border-themed
                           focus:outline-none focus:border-themed-accent resize-none h-20
                           text-themed-primary placeholder:text-themed-faint"
                />

                <button onClick={handleUntimedSubmit} className="btn-primary w-full">
                  {t.flow.record}
                </button>
              </div>
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

                <textarea
                  value={noteBefore}
                  onChange={(e) => setNoteBefore(e.target.value)}
                  placeholder={t.flow.notePlaceholder}
                  className="w-full p-4 rounded-xl bg-themed-input border border-themed
                           focus:outline-none focus:border-themed-accent resize-none h-20
                           text-themed-primary placeholder:text-themed-faint"
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
              onCancel={onClose}
              note={noteBefore}
              startedAt={startedAt}
            />
          )}

          {/* Časové aktivity - po (a edit mód) */}
          {isTimed && timedStep === 'rating-after' && (
            <div className="space-y-6 py-8">
              <h3 className="font-serif text-2xl text-themed-primary text-center">
                {t.flow.whatShifted}
              </h3>

              {isEditing && activity.variants && activity.variants.length > 0 && (
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

              {isEditing && activity.description && onAddComment && (
                <CommentsBlock
                  comments={existingComments}
                  newComment={newComment}
                  setNewComment={setNewComment}
                  onAdd={handleAddNewComment}
                  onUpdate={onUpdateComment}
                  lang={language}
                  t={t}
                />
              )}

              <textarea
                value={noteAfter}
                onChange={(e) => setNoteAfter(e.target.value)}
                placeholder={t.flow.notePlaceholder}
                className="w-full p-4 rounded-xl bg-themed-input border border-themed
                         focus:outline-none focus:border-themed-accent resize-none h-20
                         text-themed-primary placeholder:text-themed-faint"
              />

              <button onClick={handleTimedAfterSubmit} className="btn-primary w-full">
                {isEditing ? t.flow.record : t.flow.finish}
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
