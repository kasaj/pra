export interface InfoActivity {
  emoji: string;
  name: string;
  comment: string;
}

const INFO_ACTIVITY_KEY = 'pra_info_activity';

export function loadInfoActivity(lang?: string): InfoActivity {
  try {
    const stored = localStorage.getItem(INFO_ACTIVITY_KEY);
    if (stored) return { emoji: '', name: '', comment: '', ...JSON.parse(stored) };
  } catch { /* */ }
  // Backwards compat: old whyNote
  if (lang) {
    try {
      const stored = localStorage.getItem(`pra_info_notes_${lang}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        const comment = typeof parsed === 'string' ? parsed : (parsed.why || '');
        if (comment) return { emoji: '', name: '', comment };
      }
    } catch { /* */ }
  }
  return { emoji: '', name: '', comment: '' };
}

export function saveInfoActivity(a: InfoActivity): void {
  localStorage.setItem(INFO_ACTIVITY_KEY, JSON.stringify(a));
}

/** Apply config default only if user has never set infoActivity themselves. */
export function applyConfigInfoActivity(infoActivity: { emoji: string; name: string; comment: string }): void {
  if (localStorage.getItem(INFO_ACTIVITY_KEY)) return; // user already has one
  saveInfoActivity(infoActivity);
}
