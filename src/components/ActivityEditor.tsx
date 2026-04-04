import { useState, useEffect, useRef } from 'react';
import { ActivityDefinition } from '../types';
import { useLanguage } from '../i18n';
import { generateActivityType } from '../utils/activities';

interface ActivityEditorProps {
  activity?: ActivityDefinition;
  onSave: (activity: ActivityDefinition) => void;
  onDelete?: () => void;
  onClose: () => void;
}

export default function ActivityEditor({ activity, onSave, onDelete, onClose }: ActivityEditorProps) {
  const { t } = useLanguage();
  const isNew = !activity;

  const [name, setName] = useState(activity?.name || '');
  const [emoji, setEmoji] = useState(activity?.emoji || '');
  const [description, setDescription] = useState(activity?.description || '');
  const [isTimed, setIsTimed] = useState(activity?.durationMinutes !== null);
  const [duration, setDuration] = useState(activity?.durationMinutes?.toString() || '15');
  const [variants] = useState<string[]>(activity?.properties || []);

  const initialRender = useRef(true);

  // Auto-save on change for existing activities
  useEffect(() => {
    if (initialRender.current) {
      initialRender.current = false;
      return;
    }
    if (isNew || !name.trim()) return;

    const updated: ActivityDefinition = {
      type: activity?.type || generateActivityType(),
      name: name.trim(),
      emoji: emoji || '✨',
      description: description.trim(),
      durationMinutes: isTimed ? parseInt(duration, 10) || 15 : null,
      properties: variants.length > 0 ? variants : undefined,
    };
    onSave(updated);
  }, [name, emoji, description, isTimed, duration, variants]);


  const handleSubmit = () => {
    if (!name.trim()) return;

    const newActivity: ActivityDefinition = {
      type: activity?.type || generateActivityType(),
      name: name.trim(),
      emoji: emoji || '✨',
      description: description.trim(),
      durationMinutes: isTimed ? parseInt(duration, 10) || 15 : null,
      properties: variants.length > 0 ? variants : undefined,
    };

    onSave(newActivity);
  };

  return (
    <div className="fixed inset-0 bg-themed-base z-50 flex flex-col">
      <div className="flex-1 overflow-auto max-w-md mx-auto w-full">
        <div className="p-4 border-b border-themed flex items-center justify-between">
          <h2 className="font-serif text-xl text-themed-primary">
            {isNew ? t.editor.newActivity : t.editor.editActivity}
          </h2>
          <button onClick={onClose} className="text-themed-faint hover:text-themed-muted p-2">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-5">
          <div className="flex gap-4">
            <div className="w-20">
              <label className="block text-sm text-themed-muted mb-2">{t.editor.icon}</label>
              <input
                type="text"
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                placeholder="✨"
                className="w-full p-3 rounded-xl bg-themed-input border border-themed
                         focus:outline-none focus:border-themed-accent
                         text-themed-primary text-center text-2xl h-14"
              />
            </div>

            <div className="flex-1">
              <label className="block text-sm text-themed-muted mb-2">{t.editor.name}</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t.editor.namePlaceholder}
                className="w-full p-3 rounded-xl bg-themed-input border border-themed
                         focus:outline-none focus:border-themed-accent
                         text-themed-primary placeholder:text-themed-faint h-14"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-themed-muted mb-2">{t.editor.description}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t.editor.descPlaceholder}
              className="w-full p-3 rounded-xl bg-themed-input border border-themed
                       focus:outline-none focus:border-themed-accent resize-none h-16
                       text-themed-primary placeholder:text-themed-faint"
            />
          </div>

          <div>
            <label className="block text-sm text-themed-muted mb-2">{t.editor.activityType}</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setIsTimed(true)}
                className={`flex-1 py-2.5 px-4 rounded-xl border transition-colors text-sm ${
                  isTimed
                    ? 'bg-themed-accent border-themed-accent text-themed-accent'
                    : 'bg-themed-input border-themed text-themed-muted'
                }`}
              >
                {t.editor.withTime}
              </button>
              <button
                type="button"
                onClick={() => setIsTimed(false)}
                className={`flex-1 py-2.5 px-4 rounded-xl border transition-colors text-sm ${
                  !isTimed
                    ? 'bg-themed-accent border-themed-accent text-themed-accent'
                    : 'bg-themed-input border-themed text-themed-muted'
                }`}
              >
                {t.editor.moment}
              </button>
            </div>
          </div>

          {isTimed && (
            <div>
              <label className="block text-sm text-themed-muted mb-2">{t.editor.duration}</label>
              <input
                type="number"
                min="1"
                max="120"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="w-full p-3 rounded-xl bg-themed-input border border-themed
                         focus:outline-none focus:border-themed-accent
                         text-themed-primary"
              />
            </div>
          )}

        </div>

        <div className="p-4 border-t border-themed space-y-3">
          {isNew && (
            <button
              onClick={handleSubmit}
              disabled={!name.trim()}
              className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t.editor.addActivity}
            </button>
          )}

          {!isNew && onDelete && (
            <div className="flex justify-center py-2">
              <button
                onClick={onDelete}
                className="p-2 transition-colors"
                style={{ color: '#ef4444' }}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
