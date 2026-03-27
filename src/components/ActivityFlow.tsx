import { useState, useRef } from 'react';
import { Activity, ActivityDefinition, Rating } from '../types';
import { useLanguage } from '../i18n';
import { generateId, addActivity } from '../utils/storage';
import StarRating from './StarRating';
import Timer from './Timer';

type TimedFlowStep = 'rating-before' | 'timer' | 'rating-after';

interface ActivityFlowProps {
  activity: ActivityDefinition;
  onClose: () => void;
}

export default function ActivityFlow({ activity, onClose }: ActivityFlowProps) {
  const { t } = useLanguage();
  const isTimed = activity.durationMinutes !== null;

  const [timedStep, setTimedStep] = useState<TimedFlowStep>('rating-before');
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [ratingBefore, setRatingBefore] = useState<Rating | null>(null);
  const [ratingAfter, setRatingAfter] = useState<Rating | null>(null);
  const [noteBefore, setNoteBefore] = useState('');
  const [noteAfter, setNoteAfter] = useState('');

  const [rating, setRating] = useState<Rating | null>(null);
  const [note, setNote] = useState('');

  const [startedAt] = useState(new Date().toISOString());
  const actualDurationRef = useRef<number>(0);

  const handleVariantClick = (variant: string) => {
    if (selectedVariant === variant) {
      setSelectedVariant(null);
      // Remove variant from note
      if (isTimed) {
        setNoteBefore((prev) => prev.replace(variant, '').replace(/^[,\s]+|[,\s]+$/g, '').replace(/\s*,\s*,\s*/g, ', '));
      } else {
        setNote((prev) => prev.replace(variant, '').replace(/^[,\s]+|[,\s]+$/g, '').replace(/\s*,\s*,\s*/g, ', '));
      }
    } else {
      setSelectedVariant(variant);
      // Append variant to note
      if (isTimed) {
        setNoteBefore((prev) => prev ? `${prev}, ${variant}` : variant);
      } else {
        setNote((prev) => prev ? `${prev}, ${variant}` : variant);
      }
    }
  };

  const handleTimedBeforeSubmit = () => {
    setTimedStep('timer');
  };

  const handleTimerComplete = (elapsedSeconds: number) => {
    actualDurationRef.current = elapsedSeconds;
    setTimedStep('rating-after');
  };

  const handleTimedAfterSubmit = () => {
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

  return (
    <div className="fixed inset-0 bg-themed-base z-50 flex flex-col">
      <div className="p-4 border-b border-themed">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{activity.emoji}</span>
            <h2 className="font-serif text-xl text-themed-primary">{activity.name}</h2>
          </div>
          <button onClick={onClose} className="text-themed-faint hover:text-themed-muted p-2">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="max-w-md mx-auto p-4">
          {/* Nečasové aktivity - vše na jedné obrazovce */}
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

          {/* Časové aktivity - před (s popisem a variantami) */}
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
              onCancel={onClose}
            />
          )}

          {/* Časové aktivity - po */}
          {isTimed && timedStep === 'rating-after' && (
            <div className="space-y-6 py-8">
              <h3 className="font-serif text-2xl text-themed-primary text-center">
                {t.flow.whatShifted}
              </h3>
              <div className="flex justify-center py-4">
                <StarRating value={ratingAfter} onChange={setRatingAfter} size="lg" />
              </div>

              <textarea
                value={noteAfter}
                onChange={(e) => setNoteAfter(e.target.value)}
                placeholder={t.flow.notePlaceholder}
                className="w-full p-4 rounded-xl bg-themed-input border border-themed
                         focus:outline-none focus:border-themed-accent resize-none h-20
                         text-themed-primary placeholder:text-themed-faint"
              />

              <button onClick={handleTimedAfterSubmit} className="btn-primary w-full">
                {t.flow.finish}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
