import { Rating } from '../types';

interface StarRatingProps {
  value: Rating | null;
  onChange: (rating: Rating) => void;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

export default function StarRating({ value, onChange, size = 'md' }: StarRatingProps) {
  const sizeClasses = {
    xs: 'text-xs gap-0.5',
    sm: 'text-xl gap-1',
    md: 'text-2xl gap-2',
    lg: 'text-3xl gap-3',
  };

  return (
    <div className={`flex ${sizeClasses[size]}`}>
      {([1, 2, 3, 4, 5] as Rating[]).map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          className={`transition-transform hover:scale-110 ${
            value && star <= value ? 'opacity-100' : 'opacity-30'
          }`}
        >
          <span className="text-themed-ochre">&#9733;</span>
        </button>
      ))}
    </div>
  );
}
