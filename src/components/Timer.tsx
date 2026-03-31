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
  onElapsedChange?: (elapsedSeconds: number) => void;
  note?: string;
  startedAt?: string;
}

export default function Timer({ durationMinutes, onComplete, onCancel: _onCancel, onElapsedChange, note, startedAt }: TimerProps) {
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
        if (onElapsedChange) onElapsedChange(elapsedRef.current);
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

  const togglePause = useCallback(() => {
    setIsRunning((prev) => !prev);
  }, []);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const progress = 1 - secondsLeft / (durationMinutes * 60);

  const isPaused = !isRunning || isPausedByVisibility;

  return (
    <div className="flex flex-col items-center py-8">
      {startedAt && (
        <div className="text-sm text-themed-faint mb-2">
          {new Date(startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      )}

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

      {!isCompleted && (
        <div className="flex flex-col items-center gap-2">
          <div className="flex gap-3">
            <button
              onClick={togglePause}
              className="px-6 py-2 rounded-xl bg-themed-input text-themed-secondary transition-colors"
            >
              {isRunning ? t.timer.pause : t.timer.resume}
            </button>
            <button
              onClick={() => onComplete(totalSeconds - secondsLeft)}
              className="px-6 py-2 rounded-xl border transition-colors"
              style={{ borderColor: 'var(--accent-border)', color: 'var(--accent-text)' }}
            >
              {t.timer.finishEarly}
            </button>
          </div>
          <button
            onClick={() => onComplete(totalSeconds)}
            className="px-6 py-2 rounded-xl transition-colors font-medium"
            style={{ backgroundColor: 'var(--accent-solid)', color: 'var(--accent-text-on-solid)' }}
          >
            {t.flow.done}
          </button>
        </div>
      )}
    </div>
  );
}
