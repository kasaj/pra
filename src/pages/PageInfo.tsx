import { useState, useEffect, useCallback, useRef } from 'react';
import { useLanguage } from '../i18n';
import { getCachedConfig, loadConfig, ConfigInfo, ConfigQuote } from '../utils/config';
import { loadActivities } from '../utils/activities';

function whyNoteKey(lang: string): string {
  return `pra_info_notes_${lang}`;
}

function loadWhyNote(lang: string): string {
  try {
    const stored = localStorage.getItem(whyNoteKey(lang));
    if (stored) {
      const parsed = JSON.parse(stored);
      // backwards compat: previously stored as { why, how, what }
      return typeof parsed === 'string' ? parsed : (parsed.why || '');
    }
  } catch { /* default */ }
  return '';
}

function saveWhyNote(lang: string, value: string): void {
  localStorage.setItem(whyNoteKey(lang), JSON.stringify({ why: value }));
}

function NoteField({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const autoResize = () => {
    const el = ref.current;
    if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }
  };
  useEffect(autoResize, [value]);
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => { onChange(e.target.value); autoResize(); }}
      placeholder={placeholder}
      rows={2}
      className="w-full p-3 mt-3 rounded-xl bg-themed-input border border-themed
               focus:outline-none focus:border-themed-accent resize-none
               text-themed-primary placeholder:text-themed-faint text-base overflow-hidden leading-relaxed"
    />
  );
}

function Paragraphs({ text }: { text: string }) {
  const parts = text.split('\n\n');
  return <>{parts.map((p, i) => <p key={i} className={i > 0 ? 'mt-4' : ''}>{p}</p>)}</>;
}

export default function PageInfo() {
  const { language, t } = useLanguage();
  const [, setConfigVersion] = useState(0);

  useEffect(() => {
    loadConfig().then(() => setConfigVersion(v => v + 1));
  }, [language]);

  const config = getCachedConfig();
  const cfgInfo: ConfigInfo = config?.info?.[language] || {};

  const [whyNote, setWhyNote] = useState<string>(() => loadWhyNote(language));

  useEffect(() => {
    setWhyNote(loadWhyNote(language));
  }, [language]);

  const updateWhyNote = useCallback((value: string) => {
    setWhyNote(value);
    saveWhyNote(language, value);
  }, [language]);

  const coreHasInfoSymbol = loadActivities().some(
    a => a.core && a.description?.includes('ℹ️')
  );

  const title = cfgInfo.title || t.info.title;
  const subtitle = cfgInfo.subtitle || '';
  const why = cfgInfo.why || '';
  const body = cfgInfo.body || '';


  return (
    <div className="page-container">
      <header className="mb-8">
        {title && <h1 className="font-serif text-3xl text-themed-primary">{title}</h1>}
        {subtitle && <p className="text-themed-faint mt-2">{subtitle}</p>}
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

        {why && (
          <section>
            <div className="card">
              <Paragraphs text={why} />
              <NoteField
                value={whyNote}
                onChange={updateWhyNote}
                placeholder={cfgInfo.noteWhy || t.info.notePlaceholder}
              />
            </div>
          </section>
        )}

        {body && (
          <section>
            <div className="card">
              <Paragraphs text={body} />
            </div>
          </section>
        )}

        {coreHasInfoSymbol && (
          <div className="card text-sm leading-relaxed whitespace-pre-line text-themed-secondary">
            {whyNote
              ? whyNote
              : <span className="text-themed-faint italic">{cfgInfo.noteWhy || t.info.notePlaceholder}</span>
            }
          </div>
        )}

        {cfgInfo.featuredQuote && (
          <blockquote className="card border-l-4 py-3" style={{ borderLeftColor: 'var(--accent-solid)' }}>
            <p className="italic text-themed-primary">{cfgInfo.featuredQuote.text}</p>
            <footer className="mt-2 text-sm text-themed-faint">— {cfgInfo.featuredQuote.author}</footer>
          </blockquote>
        )}
      </div>
    </div>
  );
}
