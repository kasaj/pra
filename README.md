<p align="center">
  <img src="public/logo.png" alt="PRA" width="120" />
</p>

# PRA

A conscious space for daily practice.

**[Česky](README.cs.md)** | English

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

PRA comes with six default activities plus a core mood tracker:

| Activity | Type | Description |
|----------|------|-------------|
| 📊 **Mood** | Core | Quick mood rating with emoji scale and comment — always at the top of the Today page |
| 🧍‍♂️ **Pause** | Timed (1 min) | Consciously stop, breathe, observe, be present |
| 🏃‍♂️ **Movement - Activity** | Timed (30 min) | Get energy flowing — sport, stretching, yoga, balance |
| 🧎‍♂️ **Contemplation - Nourishment** | Timed (15 min) | Meditation, mindful eating, imagination, observing thoughts |
| 📜 **Comment - Note** | Moment | Self-reflection, intention, anchoring a thought or feeling |
| 👫 **Embrace - Relationships** | Moment | Conscious contact — sharing, family, understanding, community |
| 🔥 **Challenge - Courage** | Moment | Facing what you avoid — fear, pain, new habits, small steps |

All activities are fully customizable — name, emoji, description, duration, and properties. Changes auto-save. Core activities (like Mood) are hidden from the regular list and have their own dedicated UI.

## Features

- **Quick mood tracking** — emoji scale + comment directly on the Today page, auto-saves on selection
- **Session management** — "Done" button starts a new session, resetting completion markers. Repeating an activity within a session auto-links records
- **Timed practice** — countdown timer with gong, pause/resume, finish early, "Done" for retroactive recording
- **Moments** — quick records without timer
- **Unified comment system** — all activity interactions are timestamped comments with mood rating
- **Properties** — clickable chips on activities, editable inline (add/remove directly during recording). Central property registry in Settings
- **Mood scale** — customizable 7-level emoji scale for state tracking
- **Activity linking** — automatic linking within sessions, manual linking with +, navigate with arrows
- **Record views** — browse by date (last 10 records) or by session (sorted by link count)
- **Daily mood emoji** — average mood displayed next to each day's date header
- **Statistics** — day/week/month trend chart (area gradient for mood + bars for count), streak, average per day, top 2 activities, day-specific stats on calendar selection
- **Monthly calendar** — color-coded days by activity count, click to filter records and update stats
- **Info page** — philosophical context (Why/How/What) with personal notes, quotes, scientific foundations
- **Smart sync** — detects config changes, auto-merges new activities while preserving user edits
- **Configuration** — JSON config drives activities, properties, mood scale, info content, language and theme
- **Backup** — full backup with history, ratings, comments, properties, mood scale. Config export aligned with config file format. Import always merges
- **Themes** — Auto (follows system light/dark), Classic (warm earth tones), Dark
- **Auto-save** — all settings, ratings, and comments save instantly
- **Bilingual** — Czech and English with per-language properties and notes
- **Offline** — works without internet as a PWA
- **CI/CD** — push to main auto-deploys via GitHub Actions

## Install on Mobile

1. Open the [app](https://kasaj.github.io/app/) in your browser
2. **iOS Safari**: Share → Add to Home Screen
3. **Android Chrome**: Menu → Add to Home Screen

Works offline. All data stays on your device.

## Configuration

The app is driven by `public/default-config.json`:

```json
{
  "version": 1,
  "name": "default",
  "language": "cs",
  "theme": "modern",
  "activities": [
    {
      "type": "sobe",
      "emoji": "🧍‍♂️",
      "durationMinutes": 1,
      "cs": { "name": "...", "properties": [...] },
      "en": { "name": "...", "properties": [...] }
    }
  ],
  "properties": {
    "cs": ["Meditace", "Dech nosem", ...],
    "en": ["Meditation", "Nose breathing", ...]
  },
  "moodScale": [
    { "value": 1, "emoji": "😡", "labelCs": "Vztek", "labelEn": "Anger" }
  ],
  "info": {
    "cs": { "intro": "...", "quotes": [...], "why": "...", "how": "...", "what": "..." },
    "en": { ... }
  }
}
```

Edit config → push to main → auto-deploy. New activities and properties appear for users automatically. User-edited activities are never overwritten.

## Privacy

- All data stays on your device (localStorage)
- No analytics, no tracking, no cookies
- No server — purely client-side
- Backup is your responsibility

## Tech Stack

React + TypeScript, Vite, Tailwind CSS, Recharts, PWA, GitHub Actions, GitHub Pages

## Development

```bash
npm install        # Install dependencies
npm run dev        # Start dev server (localhost:3000)
npm run build      # Build for production
```

Push to `main` auto-deploys via GitHub Actions.

## License

MIT
