<p align="center">
  <img src="public/logo.png" alt="PRA" width="120" />
</p>

# PRA

A conscious space for daily practice.

**[Launch App](https://kasaj.github.io/app/)**

## About

PRA is a mindfulness app built around a simple idea: the quality of life depends on awareness — how finely we perceive reality and ourselves, and how consciously we act.

It follows the natural mechanics of change: **thought → word → action → habit → character → destiny.**

The app doesn't teach. It provides structure for daily practice and a quiet space to pause, reflect, and return to yourself. Everything runs locally on your device — no accounts, no servers, no tracking.

## Philosophy

The app is organized around three questions:

- **Why** — without rootedness in meaning, no practice lasts. Why is the root from which everything else grows.
- **How** — discipline is a form of love for what we are becoming. The bridge between intention and reality.
- **What** — method and concrete practice. Content without direction is noise, method without form is chaos.

Each user can write their own answers to these questions directly in the app (Info page).

## Activities

PRA comes with six default activities, each with selectable variants that flow into notes:

| Activity | Type | Description |
|----------|------|-------------|
| **Pause** | Timed (1 min) | Consciously stop, breathe, observe, be present |
| **Movement** | Timed (30 min) | Get energy flowing — sport, stretching, yoga, balance |
| **Contemplation** | Timed (15 min) | Meditation, journaling, mindful eating, imagination |
| **Comment** | Moment | Self-reflection, intention, anchoring a thought or feeling |
| **Embrace** | Moment | Conscious contact — sharing, family, understanding, community |
| **Challenge** | Moment | Facing what you avoid — fear, pain, new habits, small steps |

All activities are fully customizable — name, emoji, description, duration, and variants can be edited or new ones added.

## Features

- **Timed practice** — countdown timer with gong sound on completion, pause/resume, finish early, or record retroactively with "Done"
- **Moments** — quick records without timer for untimed activities
- **Variants** — clickable chips that auto-fill into notes for easy logging
- **State tracking** — rate your state before and after timed activities (1-5 stars)
- **Statistics** — weekly/monthly trend charts combining activity count and average state, elapsed time since first use, practice percentage of waking hours
- **Info page** — philosophical context (Why/How/What) with personal note fields, inspirational quotes, biological/psychological/philosophical foundations
- **Configuration** — JSON config file (`default-config.json`) drives activities, info content, quotes, default language and theme
- **Export/Import** — full configuration export (activities, info, notes, language, theme, profile) as JSON; history export as Markdown
- **Themes** — Auto (follows system light/dark), Classic (warm earth tones), Dark
- **Bilingual** — Czech and English with per-language notes
- **Offline** — works without internet as a PWA with Service Worker caching
- **Auto-deploy** — push to main triggers GitHub Actions build and deploy

## Install on Mobile

1. Open the [app](https://kasaj.github.io/app/) in your browser
2. **iOS Safari**: Share → Add to Home Screen
3. **Android Chrome**: Menu → Add to Home Screen

The app installs as a PWA and works offline. All data stays on your device.

## Configuration

The app is driven by `public/default-config.json` which defines:

```json
{
  "version": 1,
  "name": "default",
  "language": "cs",
  "theme": "modern",
  "activities": [...],
  "info": {
    "cs": { "intro": "...", "quotes": [...], "why": "...", "how": "...", "what": "...", ... },
    "en": { ... }
  }
}
```

Editing the config and pushing to main automatically deploys the changes. Activities in the browser update when the config hash changes.

## Privacy

- All data stays only on your device (localStorage)
- No analytics, no tracking, no cookies
- No server — purely client-side application
- Backup and data protection is your responsibility

## Tech Stack

- React + TypeScript
- Vite
- Tailwind CSS (with CSS custom properties for theming)
- Recharts
- PWA (Service Worker)
- GitHub Actions (CI/CD)
- GitHub Pages (hosting)

## Development

```bash
npm install        # Install dependencies
npm run dev        # Start dev server (localhost:3000)
npm run build      # Build for production
```

Push to `main` auto-deploys to GitHub Pages via GitHub Actions.

## License

MIT
