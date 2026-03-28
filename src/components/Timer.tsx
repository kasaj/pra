import { useState, useEffect, useCallback, useRef } from 'react';
import { useLanguage } from '../i18n';

function getGongUrl(): string {
  const path = window.location.pathname;
  const base = path.endsWith('/') ? path : path.substring(0, path.lastIndexOf('/') + 1);
  return `${base}gong.mp3`;
}

// Global audio element - persists across component unmounts
let gongAudio: HTMLAudioElement | null = null;

function ensureGongLoaded(): HTMLAudioElement {
  if (!gongAudio) {
    gongAudio = new Audio(getGongUrl());
    gongAudio.preload = 'auto';
  }
  return gongAudio;
}

function playGong() {
  const audio = ensureGongLoaded();
  audio.currentTime = 0;
  audio.play().catch(() => { /* browser blocked autoplay */ });
}

interface TimerProps {
  durationMinutes: number;
  onComplete: (elapsedSeconds: number) => void;
  onCancel: () => void;
  note?: string;
}

export default function Timer({ durationMinutes, onComplete, onCancel, note }: TimerProps) {
  const { t } = useLanguage();
  const totalSeconds = durationMinutes * 60;
  const [secondsLeft, setSecondsLeft] = useState(totalSeconds);
  const [isRunning, setIsRunning] = useState(true);
  const [isPausedByVisibility, setIsPausedByVisibility] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const elapsedRef = useRef(0);

  // Preload gong audio on mount (user has already interacted)
  useEffect(() => {
    ensureGongLoaded();
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsPausedByVisibility(true);
      } else {
        setIsPausedByVisibility(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  useEffect(() => {
    if (!isRunning || isPausedByVisibility || isCompleted) return;

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          elapsedRef.current = totalSeconds;
          setIsCompleted(true);
          return 0;
        }
        elapsedRef.current = totalSeconds - prev + 1;
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, isPausedByVisibility, isCompleted, totalSeconds]);

  // Play gong and auto-complete when timer finishes
  useEffect(() => {
    if (isCompleted) {
      playGong();
      const timeout = setTimeout(() => onComplete(totalSeconds), 1500);
      return () => clearTimeout(timeout);
    }
  }, [isCompleted, onComplete, totalSeconds]);

  const handleFinishEarly = useCallback(() => {
    const elapsed = totalSeconds - secondsLeft;
    onComplete(elapsed);
  }, [totalSeconds, secondsLeft, onComplete]);

  const togglePause = useCallback(() => {
    setIsRunning((prev) => !prev);
  }, []);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const progress = 1 - secondsLeft / (durationMinutes * 60);

  const isPaused = !isRunning || isPausedByVisibility;

  return (
    <div className="flex flex-col items-center py-8">
      {note && (
        <p className="text-center text-themed-muted leading-relaxed mb-6 px-4 italic">
          {note}
        </p>
      )}

      <div className="relative w-48 h-48 mb-8">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            className="text-themed-faint"
          />
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={`${progress * 283} 283`}
            className="text-themed-accent-solid transition-all duration-1000"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-serif text-4xl text-themed-primary">
            {minutes}:{seconds.toString().padStart(2, '0')}
          </span>
          {isPaused && (
            <span className="text-sm text-themed-faint mt-1">
              {isPausedByVisibility ? t.timer.pageInactive : t.timer.paused}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button
          onClick={() => onComplete(totalSeconds - secondsLeft)}
          className="w-full px-4 py-3 rounded-xl transition-colors font-medium"
          style={{ backgroundColor: 'var(--accent-solid)', color: 'var(--accent-text-on-solid)' }}
        >
          {t.flow.finish}
        </button>
        {!isCompleted && (
          <>
            <button
              onClick={handleFinishEarly}
              className="w-full px-4 py-2 rounded-xl border transition-colors"
              style={{ borderColor: 'var(--accent-border)', color: 'var(--accent-text)' }}
            >
              {t.timer.finishEarly}
            </button>
            <div className="flex gap-3">
              <button
                onClick={togglePause}
                className="flex-1 px-4 py-2 rounded-xl bg-themed-input text-themed-secondary hover:bg-themed-input transition-colors"
              >
                {isRunning ? t.timer.pause : t.timer.resume}
              </button>
              <button
                onClick={onCancel}
                className="flex-1 px-4 py-2 rounded-xl text-themed-faint hover:text-themed-secondary transition-colors"
              >
                {t.timer.cancel}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
