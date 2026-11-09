# Journal

A personal space for daily goals, journal entries, and gratitude, built with HTML, CSS, and JavaScript. No account or backend is required.

[Open Journal](https://jschwartz1313.github.io/Goal-Tracking/)

## Pages

1. **Goals Today** — create and edit goals, set priorities and durations, track progress, carry unfinished tasks forward, and manage recurring tasks. Past Days and Projects are secondary views within this page. Quick Reflection saves as you type.
2. **Journal Entries** — write rich-text daily or multi-day entries, including entries for past dates. Today's entry saves automatically and stays attached to its original date if the page remains open overnight.
3. **Gratitude Entries** — keep one dated entry with three independent prompts: life in general, Aislynn, and something recent. Partial entries save automatically. Revisit, search, edit, or delete entries, with Undo for deletions.

## Export and backups

- Export gratitude independently from journal entries, goals, and projects.
- Export a single saved entry or a date range; gratitude exports can include all prompts or just Life, Aislynn, or Something recent.
- Download real editable **Word (.docx)** documents or **plain text (.txt)**, ordered oldest first. Word exports preserve basic journal formatting and provide a simple serif layout suitable for further editing or gift formatting.
- A full JSON backup and restore option at the bottom of the app includes all existing storage categories. Restore can be undone immediately. When browser storage is full, downloading a backup still captures unsaved writing.
- All export files are generated in the browser; no entries are uploaded to a server.

## Existing data

The original GitHub Pages URL and existing storage keys are preserved. Older goals, projects, reflections, metrics history, and plain-text or rich-text journals remain available. Gratitude uses its own `gratitudeEntries` key.

All data remains in the current browser profile's local storage. It does not sync automatically across browsers or devices. Use Full Backup to move data between browsers and keep copies of important records.

## Run locally

Serve this folder with a static web server:

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000`. The site has no runtime dependencies or build step.

## Checks

```sh
node --test tests/*.test.cjs
node --check gratitude.js
node --check exports.js
```

Use a current Chrome, Edge, Firefox, or Safari. Rich-text formatting uses browser editing features, so minor toolbar behavior may vary between browsers.
