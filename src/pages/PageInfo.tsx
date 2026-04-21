import { useState, useEffect, useCallback, useRef } from 'react';
import { useLanguage } from '../i18n';
import { getCachedConfig, loadConfig, ConfigInfo, ConfigQuote } from '../utils/config';
import { InfoActivity, loadInfoActivity, saveInfoActivity } from '../utils/infoActivity';

function InfoActivityEditor({ value, onChange, notePlaceholder, namePlaceholder }: {
  value: InfoActivity;
  onChange: (v: InfoActivity) => void;
  notePlaceholder: string;
  namePlaceholder: string;
}) {
  const commentRef = useRef<HTMLTextAreaElement>(null);
  const autoResize = () => {
    const el = commentRef.current;
    if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }
  };
  useEffect(autoResize, [value.comment]);

  return (
    <div className="mt-3 space-y-2">
      <div className="flex gap-2">
        <input
          type="text"
          value={value.emoji}
          onChange={(e) => onChange({ ...value, emoji: e.target.value })}
          placeholder="💡"
          className="w-14 p-2 rounded-xl bg-themed-input border border-themed
                     focus:outline-none focus:border-themed-accent
                     text-themed-primary text-center text-xl"
        />
        <input
          type="text"
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
          placeholder={namePlaceholder}
          className="flex-1 p-2 rounded-xl bg-themed-input border border-themed
                     focus:outline-none focus:border-themed-accent
                     text-themed-primary placeholder:text-themed-faint"
        />
      </div>
      <textarea
        ref={commentRef}
        value={value.comment}
        onChange={(e) => { onChange({ ...value, comment: e.target.value }); autoResize(); }}
        placeholder={notePlaceholder}
        rows={2}
        className="w-full p-3 rounded-xl bg-themed-input border border-themed
                   focus:outline-none focus:border-themed-accent resize-none
                   text-themed-primary placeholder:text-themed-faint text-base overflow-hidden leading-relaxed"
      />
    </div>
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

  const [infoActivity, setInfoActivity] = useState<InfoActivity>(() => loadInfoActivity(language));

  useEffect(() => {
    setInfoActivity(loadInfoActivity(language));
  }, [language]);

  const updateInfoActivity = useCallback((value: InfoActivity) => {
    setInfoActivity(value);
    saveInfoActivity(value);
  }, []);

  const title = cfgInfo.title || t.info.title;
  const subtitle = cfgInfo.subtitle || '';
  const why = cfgInfo.why || '';
  const body = cfgInfo.body || '';

  const namePlaceholder = language === 'cs' ? 'Název...' : 'Name...';

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

        <section>
          <div className="card">
            {why && <Paragraphs text={why} />}
            <InfoActivityEditor
              value={infoActivity}
              onChange={updateInfoActivity}
              notePlaceholder={cfgInfo.noteWhy || t.info.notePlaceholder}
              namePlaceholder={namePlaceholder}
            />
          </div>
        </section>

        {body && (
          <section>
            <div className="card">
              <Paragraphs text={body} />
            </div>
          </section>
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
