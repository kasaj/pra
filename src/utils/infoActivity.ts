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

const INFO_ACTIVITY_USER_SET_KEY = 'pra_info_activity_user_set';

export function saveInfoActivity(a: InfoActivity): void {
  localStorage.setItem(INFO_ACTIVITY_KEY, JSON.stringify(a));
}

/** Called when user explicitly saves infoActivity from Info page. */
export function markInfoActivityUserSet(): void {
  localStorage.setItem(INFO_ACTIVITY_USER_SET_KEY, '1');
}

export function isInfoActivityUserSet(): boolean {
  return !!localStorage.getItem(INFO_ACTIVITY_USER_SET_KEY);
}

/** Apply config default only if user has not customized infoActivity themselves. */
export function applyConfigInfoActivity(infoActivity: { emoji: string; name: string; comment: string }): void {
  if (isInfoActivityUserSet()) return;
  saveInfoActivity(infoActivity);
}
