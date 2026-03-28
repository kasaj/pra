import { Rating } from '../types';

const MOOD_SCALE: { value: Rating; emoji: string }[] = [
  { value: 0, emoji: '😡' },
  { value: 1, emoji: '😰' },
  { value: 2, emoji: '😞' },
  { value: 3, emoji: '😐' },
  { value: 4, emoji: '🙂' },
  { value: 5, emoji: '😄' },
  { value: 6, emoji: '🤩' },
];

interface StarRatingProps {
  value: Rating | null;
  onChange: (rating: Rating) => void;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

export default function StarRating({ value, onChange, size = 'md' }: StarRatingProps) {
  const sizeClasses = {
    xs: 'text-xs gap-0.5',
    sm: 'text-lg gap-1',
    md: 'text-xl gap-1.5',
    lg: 'text-2xl gap-2',
  };

  return (
    <div className={`flex ${sizeClasses[size]}`}>
      {MOOD_SCALE.map(({ value: v, emoji }) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={`transition-transform hover:scale-110 ${
            value === v ? 'opacity-100' : 'grayscale opacity-40'
          }`}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
