<p align="center">
  <img src="public/logo.png" alt="PRA" width="120" />
</p>

<h1 align="center">PRA</h1>

<p align="center">A conscious space for daily practice.</p>

**[Česky](README.cs.md)** | English

**[Launch App](https://kasaj.github.io/app/)**

<p align="center">
  <img src="https://raw.githubusercontent.com/kasaj/app/main/public/screenshot.png" alt="PRA – app screenshot" width="100%" />
</p>

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

PRA comes with a default set of activities, fully customizable or replaceable with your own:

| Activity | Type | Description |
|----------|------|-------------|
| 🌌 **Space** | Core | Foundation of the Today page — star rating, properties, and comment |
| 🗃️ **Records** | Moment | Quick note or intention |
| ⏸️ **Pause** | Timed (2 min) | Conscious stop, breath, presence |
| 🔥 **Change** | Moment | A deliberate step toward change — facing a habit, a small brave act |
| 🧎 **Recollection** | Moment | Brief self-reflection, stillness, returning to yourself |

All activities are fully customizable — name, emoji, description, duration, and properties. Changes auto-save. Activities can be added and deleted directly from the Today page (edit mode).

## Features

- **Today page** — central screen: activity bubbles, properties, star rating, comment, session summary and records
- **Properties** — clickable tags for context (state, theme, situation). Used in session show accent border, currently selected are filled
- **Session** — time spent in practice since last reset; resetting starts a new session. Records sorted by total duration
- **Timed activities** — countdown with planned end time, gong, pause/resume, finish early
- **Moment activities** — instant record without timer
- **State rating** — 1–5 star scale with optional comment, timestamped
- **Mood scale** — customizable emoji scale for emotional state tracking
- **Activity linking** — automatic linking within sessions, navigate with arrows
- **Time page** — chronological record history, daily/weekly/monthly mood trend, color-coded calendar, statistics
- **Info page** — philosophical context (Why/How/What) with personal notes and quotes
- **Settings** — manage activities, language (Czech/English), theme (Auto/Classic/Dark), backup and import
- **Configuration** — separate JSON files for Czech (`default-config-cs.json`) and English (`default-config-en.json`). Config export always uses the current language
- **Backup** — full data export (records + config) as JSON, import always merges
- **Smart sync** — detects config changes, adds new activities while preserving user edits
- **Bilingual** — Czech and English with per-language properties and notes
- **Offline / PWA** — works without internet, installable on phone home screen
- **CI/CD** — push to main auto-deploys via GitHub Actions

## Use Case: Tracking Bad Habits and Replacing Them

> **Intent:** Systematically record moments when a bad habit or impulse occurs, consciously name them, and observe how the pattern changes over time.

**Setup (one-time):**

1. In Settings → Activities, add activities matching the situations you want to track — e.g.:
   - `📱 Screen` — I reached for the phone without intention
   - `🍬 Impulse` — a craving or urge arrived
   - `🔁 Replacement` — I consciously replaced the habit with another action
2. Set properties for context: `Stress`, `Boredom`, `Fatigue`, `Automatism`
3. Set the core activity (Space) duration to your preference — e.g. 1–2 min

**Daily practice:**

- Morning: rate your mood with stars and write your day's intention as a comment
- During the day: whenever a situation occurs — open the app, tap the activity, select the property (what triggered it), save
- Repeated occurrences within a session are automatically linked and shown as a series
- Evening or anytime: on the Time page, review patterns — when, under what conditions, how often

**What the app will show:**

- Frequency of each situation over time (Time page, calendar)
- Correlation between mood and occurrence (star ratings)
- Evolution of the "habit vs. replacement" ratio session by session
- Total time spent in conscious practice

The app doesn't judge or remind. It's a quiet mirror — the records speak for themselves.

## Install on Mobile

1. Open the [app](https://kasaj.github.io/app/) in your browser
2. **iOS Safari**: Share → Add to Home Screen
3. **Android Chrome**: Menu → Add to Home Screen

Works offline. All data stays on your device.

## Configuration

The app is driven by separate files `public/default-config-cs.json` and `public/default-config-en.json`. Format is flat — one language per file:

```json
{
  "version": 1,
  "name": "default",
  "language": "en",
  "theme": "modern",
  "activities": [
    {
      "type": "pause",
      "emoji": "⏸️",
      "durationMinutes": 2,
      "name": "Pause",
      "description": "Conscious stop",
      "properties": ["Breath", "Silence"]
    }
  ],
  "moodScale": [
    { "value": 1, "emoji": "😡", "labelEn": "Anger" }
  ],
  "info": {
    "en": { "intro": "...", "why": "...", "how": "...", "what": "..." }
  }
}
```

Edit config → push to main → auto-deploy. New activities appear for users automatically. User-edited activities are never overwritten.

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
