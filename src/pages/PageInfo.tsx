import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../i18n';
import { getCachedConfig, ConfigInfo } from '../utils/config';

const NOTES_KEY = 'pra_info_notes';

interface InfoNotes {
  why: string;
  how: string;
  what: string;
  i: string;
}

function loadNotes(): InfoNotes {
  try {
    const stored = localStorage.getItem(NOTES_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* default */ }
  return { why: '', how: '', what: '', i: '' };
}

function saveNotes(notes: InfoNotes): void {
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
}

function NoteField({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder: string;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full p-3 mt-3 rounded-xl bg-themed-input border border-themed
               focus:outline-none focus:border-themed-accent resize-none h-16
               text-themed-primary placeholder:text-themed-faint text-sm"
    />
  );
}

export default function PageInfo() {
  const { language, t } = useLanguage();
  const [notes, setNotes] = useState<InfoNotes>(loadNotes);

  // Config overrides translations - missing fields are skipped
  const config = getCachedConfig();
  const cfgInfo: ConfigInfo = config?.info?.[language] || {};

  const info = {
    title: cfgInfo.title || t.info.title,
    subtitle: cfgInfo.subtitle || t.info.subtitle,
    intro1: cfgInfo.intro1,
    intro2: cfgInfo.intro2 || t.info.intro2,
    sequence: cfgInfo.sequence || t.info.sequence,
    intro3: cfgInfo.intro3 || t.info.intro3,
    bioTitle: cfgInfo.bioTitle || t.info.bioTitle,
    bioText: cfgInfo.bioText || t.info.bioText,
    psychTitle: cfgInfo.psychTitle || t.info.psychTitle,
    psychText: cfgInfo.psychText || t.info.psychText,
    philoTitle: cfgInfo.philoTitle || t.info.philoTitle,
    philoText: cfgInfo.philoText || t.info.philoText,
  };

  const placeholder = t.info.notePlaceholder;

  const updateNote = useCallback((key: keyof InfoNotes, value: string) => {
    setNotes((prev) => {
      const next = { ...prev, [key]: value };
      saveNotes(next);
      return next;
    });
  }, []);

  // Load notes from config on first run (if present)
  useEffect(() => {
    const stored = localStorage.getItem(NOTES_KEY);
    if (!stored && cfgInfo) {
      const initial: InfoNotes = {
        why: cfgInfo.noteWhy || '',
        how: cfgInfo.noteHow || '',
        what: cfgInfo.noteWhat || '',
        i: cfgInfo.noteI || '',
      };
      if (initial.why || initial.how || initial.what || initial.i) {
        setNotes(initial);
        saveNotes(initial);
      }
    }
  }, [cfgInfo]);

  return (
    <div className="page-container">
      <header className="mb-8">
        <h1 className="font-serif text-3xl text-themed-primary">{info.title}</h1>
        <p className="text-themed-faint mt-2">{info.subtitle}</p>
      </header>

      <div className="space-y-6 text-themed-secondary leading-relaxed">
        {info.intro1 && (
          <section className="card">
            <p>{info.intro1}</p>
          </section>
        )}

        {info.intro2 && (
          <section>
            <h2 className="font-serif text-xl text-themed-primary mb-3">{language === 'cs' ? 'Proč' : 'Why'}</h2>
            <div className="card">
              <p>{info.intro2}</p>
              <NoteField value={notes.why} onChange={(v) => updateNote('why', v)} placeholder={placeholder} />
            </div>
          </section>
        )}

        {info.sequence && (
          <section>
            <h2 className="font-serif text-xl text-themed-primary mb-3">{language === 'cs' ? 'Jak' : 'How'}</h2>
            <div className="card">
              <p>{info.sequence}</p>
              <NoteField value={notes.how} onChange={(v) => updateNote('how', v)} placeholder={placeholder} />
            </div>
          </section>
        )}

        {info.intro3 && (() => {
          const parts = info.intro3.split('\n\n');
          const whatText = parts[0];
          const iText = parts.length > 1 ? parts.slice(1).join('\n\n') : null;
          return (
            <>
              <section>
                <h2 className="font-serif text-xl text-themed-primary mb-3">{language === 'cs' ? 'Co' : 'What'}</h2>
                <div className="card">
                  <p>{whatText}</p>
                  <NoteField value={notes.what} onChange={(v) => updateNote('what', v)} placeholder={placeholder} />
                </div>
              </section>
              {iText && (
                <section>
                  <h2 className="font-serif text-xl text-themed-primary mb-3">{language === 'cs' ? 'Já' : 'I'}</h2>
                  <div className="card">
                    <p>{iText}</p>
                    <NoteField value={notes.i} onChange={(v) => updateNote('i', v)} placeholder={placeholder} />
                  </div>
                </section>
              )}
            </>
          );
        })()}

        {info.bioTitle && info.bioText && (
          <section>
            <h2 className="font-serif text-xl text-themed-primary mb-3">{info.bioTitle}</h2>
            <div className="card">
              <p>{info.bioText}</p>
            </div>
          </section>
        )}

        {info.psychTitle && info.psychText && (
          <section>
            <h2 className="font-serif text-xl text-themed-primary mb-3">{info.psychTitle}</h2>
            <div className="card">
              <p>{info.psychText}</p>
            </div>
          </section>
        )}

        {info.philoTitle && info.philoText && (
          <section>
            <h2 className="font-serif text-xl text-themed-primary mb-3">{info.philoTitle}</h2>
            <div className="card">
              <p>{info.philoText}</p>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
