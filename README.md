# Daily To-Dos

A lightweight, browser-based planner for daily to-dos, projects, and journal entries. The app is built with plain HTML, CSS, and JavaScript and does not require an account or backend.

[Open the live app](https://jschwartz1313.github.io/Goal-Tracking/)

## Features

### Daily to-dos

- Add to-dos for today or a future date.
- Set priorities and estimated durations.
- Track incomplete, partial, complete, and skipped work.
- Keep a to-do active until it is finished, or create recurring daily to-dos.
- Sort and filter the list, and review overdue, upcoming, and past items.
- Use the calendar to revisit earlier days.

### Projects

- Create longer-term projects with descriptions, target dates, progress, and sub-goals.
- Connect daily planning with larger outcomes.

### Journal Entries

Journal Entries provides a dedicated writing area for daily reflections and longer records.

- Write and edit today's entry.
- Create or update an entry for a past date.
- Create a single entry that spans a start and end date, such as a trip or project period.
- Review, edit, and delete saved entries.
- Format writing with bold, italic, underline, headings, and block quotes.
- Use several unordered-list styles (disc, circle, and square) and ordered-list styles (numbers, letters, and Roman numerals).

## Data and privacy

All to-dos, projects, preferences, and journal entries are stored in your browser's local storage. The app does not require an account and does not send this information to an application server.

Browser-local data does not automatically sync or back up across browsers, profiles, or devices. Clearing site data can remove it, so avoid clearing storage for the app if you need to keep your records.

## Run locally

Clone the repository:

```bash
git clone https://github.com/jschwartz1313/Goal-Tracking.git
cd Goal-Tracking
```

Then serve the folder with any static web server, for example:

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000` in your browser. You can also open `index.html` directly, although some browsers restrict local storage for pages opened from the filesystem.

## Browser compatibility

Use a current version of Chrome, Edge, Firefox, or Safari. The rich-text editor relies on standard browser editing features, so minor toolbar or list-style behavior can differ between browsers. Existing plain-text journal entries remain readable and editable when rich formatting is introduced.

## Technology

- HTML5
- CSS3
- Vanilla JavaScript
- Browser `localStorage`

The application has no runtime package dependencies or build step.
