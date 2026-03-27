import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../i18n';
import { getCachedConfig, ConfigInfo, ConfigQuote } from '../utils/config';

interface InfoNotes {
  why: string;
  how: string;
  what: string;
}

function notesKey(lang: string): string {
  return `pra_info_notes_${lang}`;
}

function loadNotes(lang: string): InfoNotes {
  try {
    const stored = localStorage.getItem(notesKey(lang));
    if (stored) return JSON.parse(stored);
  } catch { /* default */ }
  return { why: '', how: '', what: '' };
}

function saveNotesForLang(lang: string, notes: InfoNotes): void {
  localStorage.setItem(notesKey(lang), JSON.stringify(notes));
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

function Paragraphs({ text }: { text: string }) {
  const parts = text.split('\n\n');
  return <>{parts.map((p, i) => <p key={i} className={i > 0 ? 'mt-4' : ''}>{p}</p>)}</>;
}

export default function PageInfo() {
  const { language, t } = useLanguage();

  // Config is always source of truth for content
  const config = getCachedConfig();
  const cfgInfo: ConfigInfo = config?.info?.[language] || {};

  // User notes - stored separately, config noteWhy/How/What are placeholders only
  const [notes, setNotes] = useState<InfoNotes>(() => loadNotes(language));

  const info = {
    title: cfgInfo.title || t.info.title,
    subtitle: cfgInfo.subtitle || t.info.subtitle,
    intro: cfgInfo.intro || cfgInfo.intro1,
    why: cfgInfo.why || cfgInfo.intro2,
    how: cfgInfo.how || cfgInfo.sequence,
    what: cfgInfo.what || cfgInfo.intro3?.split('\n\n')[0],
    bioTitle: cfgInfo.bioTitle || t.info.bioTitle,
    bioText: cfgInfo.bioText || t.info.bioText,
    psychTitle: cfgInfo.psychTitle || t.info.psychTitle,
    psychText: cfgInfo.psychText || t.info.psychText,
    philoTitle: cfgInfo.philoTitle || t.info.philoTitle,
    philoText: cfgInfo.philoText || t.info.philoText,
  };

  // Reload notes when language changes
  useEffect(() => {
    setNotes(loadNotes(language));
  }, [language]);

  const updateNote = useCallback((key: keyof InfoNotes, value: string) => {
    setNotes((prev) => {
      const next = { ...prev, [key]: value };
      saveNotesForLang(language, next);
      return next;
    });
  }, [language]);

  return (
    <div className="page-container">
      <header className="mb-8">
        <h1 className="font-serif text-3xl text-themed-primary">{info.title}</h1>
        <p className="text-themed-faint mt-2">{info.subtitle}</p>
      </header>

      <div className="space-y-6 text-themed-secondary leading-relaxed">
        {cfgInfo.quotes && cfgInfo.quotes.length > 0 && (
          <section className="space-y-3">
            {cfgInfo.quotes.map((q: ConfigQuote, i: number) => (
              <blockquote key={i} className="card border-l-4 py-3" style={{ borderLeftColor: 'var(--accent-solid)' }}>
                <p className="italic text-themed-primary">{q.text}</p>
                <footer className="mt-2 text-sm text-themed-faint">— {q.author}</footer>
              </blockquote>
            ))}
          </section>
        )}

        {info.why && (
          <section>
            <h2 className="font-serif text-xl text-themed-primary mb-3">{language === 'cs' ? 'Proč' : 'Why'}</h2>
            <div className="card">
              <Paragraphs text={info.why} />
              <NoteField value={notes.why} onChange={(v) => updateNote('why', v)} placeholder={cfgInfo.noteWhy || t.info.notePlaceholder} />
            </div>
          </section>
        )}

        {info.how && (
          <section>
            <h2 className="font-serif text-xl text-themed-primary mb-3">{language === 'cs' ? 'Jak' : 'How'}</h2>
            <div className="card">
              <Paragraphs text={info.how} />
              <NoteField value={notes.how} onChange={(v) => updateNote('how', v)} placeholder={cfgInfo.noteHow || t.info.notePlaceholder} />
            </div>
          </section>
        )}

        {info.what && (
          <section>
            <h2 className="font-serif text-xl text-themed-primary mb-3">{language === 'cs' ? 'Co' : 'What'}</h2>
            <div className="card">
              <Paragraphs text={info.what} />
              <NoteField value={notes.what} onChange={(v) => updateNote('what', v)} placeholder={cfgInfo.noteWhat || t.info.notePlaceholder} />
            </div>
          </section>
        )}

        {info.intro && (
          <section>
            <h2 className="font-serif text-xl text-themed-primary mb-3">{language === 'cs' ? 'Já' : 'I'}</h2>
            <div className="card">
              <Paragraphs text={info.intro} />
            </div>
          </section>
        )}

        {info.bioTitle && info.bioText && (
          <section>
            <h2 className="font-serif text-xl text-themed-primary mb-3">{info.bioTitle}</h2>
            <div className="card">
              <Paragraphs text={info.bioText} />
            </div>
          </section>
        )}

        {info.psychTitle && info.psychText && (
          <section>
            <h2 className="font-serif text-xl text-themed-primary mb-3">{info.psychTitle}</h2>
            <div className="card">
              <Paragraphs text={info.psychText} />
            </div>
          </section>
        )}

        {info.philoTitle && info.philoText && (
          <section>
            <h2 className="font-serif text-xl text-themed-primary mb-3">{info.philoTitle}</h2>
            <div className="card">
              <Paragraphs text={info.philoText} />
            </div>
          </section>
        )}

        <footer className="text-center text-sm text-themed-faint pt-4">
          Author <a href="https://kasaj.cz" target="_blank" rel="noopener noreferrer" className="text-themed-accent-solid hover:underline">kasaj.cz</a>
        </footer>
      </div>
    </div>
  );
}
