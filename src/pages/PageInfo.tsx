import { useLanguage } from '../i18n';
import { getCachedConfig, ConfigInfo } from '../utils/config';

export default function PageInfo() {
  const { language, t } = useLanguage();

  // Config overrides translations - missing fields are skipped
  const config = getCachedConfig();
  const cfgInfo: ConfigInfo = config?.info?.[language] || {};

  // Use config value if present, otherwise fall back to translation
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
          <section className="card">
            <p>{info.intro2}</p>
          </section>
        )}

        {info.sequence && (
          <section className="card">
            <p>{info.sequence}</p>
          </section>
        )}

        {info.intro3 && (
          <section className="card">
            {info.intro3.split('\n\n').map((paragraph, i) => (
              <p key={i} className={i > 0 ? 'mt-4' : ''}>{paragraph}</p>
            ))}
          </section>
        )}

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
