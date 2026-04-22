<p align="center">
  <img src="public/logo.png" alt="PRA" width="120" />
</p>

<h1 align="center">PRA</h1>

A conscious space for daily practice.

**[Česky](README.cs.md)** | English

**[Launch App](https://kasaj.github.io/app/)**

<p align="center">
  <img src="https://raw.githubusercontent.com/kasaj/app/main/public/screenshot.png" alt="PRA – app screenshot" width="100%" />
</p>

**[kasaj.github.io/app](https://kasaj.github.io/app/)**

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
| 🌌 **Space** | Core | Foundation of the Today page — star rating, properties, and comment. All other activities feed into its comment |
| 📋 **Log** | Moment | Quick log of the current activity — select a property (what you are doing), it is inserted into the Space comment |
| 🧍‍♂️ **Recollection** | Timed (5 min) | Conscious pause, body scan, breath, grounding |

All activities are fully customizable — name, emoji, description, duration, and properties. Changes auto-save. Activities can be added, reordered, hidden, and deleted directly from the Today page (edit mode).

## Features

### Today page
- **Activity bubbles** — tap to record. Timed activities open a countdown flow; moment activities show an inline property picker
- **Inline property picker** — tap a moment activity to expand its properties; selected properties are inserted into the Space comment together with the activity name (e.g. `📋 Log - 💻 Work`)
- **Long press** on any activity bubble to open the activity editor
- **Edit mode** — pencil button on each bubble to edit, × to delete; toggle hidden activities and properties
- **Special activity pill** — shows the personal *why* from the Info page. Tap to toggle it as the session anchor; highlighted when referenced in the current session
- **Star rating + comment** — rate state 1–7 and add a free-text comment for the Space record
- **Properties** — clickable tags below the comment field. Used in session show accent border; currently selected are filled
- **Session summary** — lists all activities recorded since the last session reset, including the special activity

### Time page
- Chronological record history with full-text search (including multi-line comments)
- Daily / weekly / monthly mood trend chart
- Color-coded calendar heatmap
- Per-activity statistics (count, total time, average mood)

### Info page
- Philosophical context (Why / How / What) with personal notes and quotes
- **Special activity** — set your personal *why* (emoji + name + note). It appears as a pill on the Today page and is included in every backup

### Settings
- Manage activities (add, edit, delete, reorder)
- Language (Czech / English), theme (Auto / Classic / Dark)
- **Backup** — full data export as JSON (records + activities + special activity); import merges without overwriting
- **Import records only** — add history from a backup file without changing current activities, theme, or language
- **Sync** — optional Azure-backed sync between devices (merge-based: local records are never lost on download)
- **Config sync** — pulls latest activity definitions from the default config without touching user edits

### Other
- **Bilingual** — Czech and English with per-language properties, notes, and config files
- **Offline / PWA** — works without internet, installable on the phone home screen
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
  "language": "en",
  "theme": "modern",
  "infoActivity": {
    "emoji": "🌱",
    "name": "My why",
    "comment": "Personal note shown on the Info page and as a session anchor on Today"
  },
  "activities": [
    {
      "type": "log",
      "emoji": "📋",
      "durationMinutes": null,
      "name": "Log",
      "description": "Quick activity log",
      "properties": ["💻 Work", "🍲 Food", "📝 Note"],
      "core": false
    },
    {
      "type": "space",
      "emoji": "🌌",
      "durationMinutes": null,
      "name": "Space",
      "description": "Record your current state",
      "properties": ["🎯 What am I working on?", "🧭 How am I working on it?"],
      "core": true
    }
  ],
  "moodScale": [
    { "value": 1, "emoji": "😡", "labelEn": "Anger" }
  ],
  "info": {
    "en": {
      "title": "Info",
      "quotes": [{ "text": "...", "author": "..." }],
      "why": "...",
      "noteWhy": "Default note shown in the special activity editor",
      "body": "...",
      "featuredQuote": { "text": "...", "author": "..." }
    }
  }
}
```

Edit config → push to main → auto-deploy. New activities appear for users automatically. User-edited activities and the special activity are never overwritten by config updates.

## Privacy

- All data stays on your device (localStorage)
- No analytics, no tracking, no cookies
- No server — purely client-side
- Sync is optional and self-hosted; backup is your responsibility

## Tech Stack

React + TypeScript, Vite, Tailwind CSS, Recharts, PWA, GitHub Actions, GitHub Pages

## Development

```bash
npm install        # Install dependencies
npm run dev        # Start dev server (localhost:3000)
npm run build      # Build for production
```

Push to `main` auto-deploys via GitHub Actions.

## Sync (optional)

PRA can sync data between devices using an Azure Function as a backend. Download is **merge-based** — local records created since the last upload are never lost when pulling from the server.

### Deploy your own sync backend

**Prerequisites:** [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli), [Azure Functions Core Tools](https://learn.microsoft.com/en-us/azure/azure-functions/functions-run-local), Node.js

```powershell
cd azure-function/infra

.\deploy.ps1 `
  -ResourceGroup "MyResourceGroup" `
  -StorageAccountName "myuniquestorage" `
  -SyncSecret "choose-a-strong-secret"
```

The script provisions all Azure resources (Storage Account, Function App, Application Insights) via Bicep and deploys the function code. On completion it prints the **Sync URL** and **Secret** to enter in PRA Settings → Sync.

**Cost:** Azure consumption plan — effectively free for personal use (1M free requests/month).

### Check what's on the server

```bash
az storage blob list \
  --account-name <storage-account> \
  --container-name pra-sync \
  --auth-mode login \
  --query "[].{name:name, size:properties.contentLength, modified:properties.lastModified}" \
  -o table
```

## License

MIT
