/* Dated gratitude, browser-local drafts, and recoverable full backups. */
let gratitudeLoadedDate = null;
let gratitudeDirty = false;
let gratitudeSaveTimer = null;
const gratitudeFields = { life: 'gratitudeLife', aislynn: 'gratitudeAislynn', recent: 'gratitudeRecent' };
const gratitudeLabels = { life: 'Life in general', aislynn: 'Aislynn', recent: 'Something recent' };
const journalBackupKeys = ['habitMetrics', 'habitHistory', 'dailyGoals', 'longTermGoals', 'recurringDailyGoals', 'journalEntries', 'multiDayJournalEntries', 'gratitudeEntries', 'sectionCollapseState'];

function validEntryDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
    const date = parseDateKey(value);
    return !Number.isNaN(date.getTime()) && toLocalDateKey(date) === value;
}

function getGratitudeEntries() {
    const entries = JSON.parse(localStorage.getItem('gratitudeEntries') || '{}');
    if (!entries || typeof entries !== 'object' || Array.isArray(entries)) throw new Error('Gratitude data could not be read.');
    return entries;
}

function gratitudeStatus(message, error = false) {
    const status = document.getElementById('gratitudeSaveStatus');
    status.textContent = message;
    status.classList.toggle('save-error', error);
}

function updateGratitudeProgress() {
    const count = Object.values(gratitudeFields).filter(id => document.getElementById(id).value.trim()).length;
    document.getElementById('gratitudeProgress').textContent = `${count} of 3 reflections${count === 3 ? ' · A little good, remembered.' : ''}`;
}

function saveGratitudeEntry(silent = true) {
    clearTimeout(gratitudeSaveTimer);
    if (!gratitudeLoadedDate) return true;
    try {
        const entries = getGratitudeEntries();
        const entry = {};
        Object.entries(gratitudeFields).forEach(([key, id]) => { entry[key] = document.getElementById(id).value; });
        const hasContent = Object.values(entry).some(value => value.trim());
        if (hasContent) entries[gratitudeLoadedDate] = { ...entry, updatedAt: new Date().toISOString() };
        else delete entries[gratitudeLoadedDate];
        localStorage.setItem('gratitudeEntries', JSON.stringify(entries));
        gratitudeDirty = false;
        const time = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        gratitudeStatus(hasContent ? `Saved in this browser at ${time}` : 'Your writing saves automatically.');
        updateGratitudeProgress();
        renderGratitudeEntries();
        return true;
    } catch (error) {
        gratitudeStatus('Could not save. Keep this page open and download a backup or free up browser storage.', true);
        return false;
    }
}

function flushGratitudeDraft() {
    return !gratitudeDirty || saveGratitudeEntry();
}

function changeGratitudeDate(dateKey) {
    const picker = document.getElementById('gratitudeDate');
    if (!validEntryDate(dateKey) || dateKey > getTodayKey()) {
        picker.value = gratitudeLoadedDate || getTodayKey();
        gratitudeStatus('Choose today or an earlier date.', true);
        return false;
    }
    if (!flushGratitudeDraft()) {
        picker.value = gratitudeLoadedDate;
        return false;
    }
    try {
        const entry = getGratitudeEntries()[dateKey] || {};
        gratitudeLoadedDate = dateKey;
        picker.value = dateKey;
        picker.max = getTodayKey();
        Object.entries(gratitudeFields).forEach(([key, id]) => {
            document.getElementById(id).value = typeof entry[key] === 'string' ? entry[key] : '';
        });
        gratitudeDirty = false;
        document.getElementById('gratitudeDateHeading').textContent = dateKey === getTodayKey()
            ? `Today's gratitude · ${formatDate(dateKey)}`
            : parseDateKey(dateKey).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
        document.getElementById('gratitudeNextDay').disabled = dateKey >= getTodayKey();
        gratitudeStatus(entry.updatedAt ? 'Saved in this browser. You can keep writing.' : 'Your writing saves automatically.');
        updateGratitudeProgress();
        return true;
    } catch (error) {
        gratitudeStatus('Your saved gratitude could not be loaded. Download a backup before making changes.', true);
        return false;
    }
}

function stepGratitudeDate(amount) {
    changeGratitudeDate(shiftDateKey(gratitudeLoadedDate || getTodayKey(), amount));
}

function renderGratitude(forceReload = false) {
    if (!gratitudeLoadedDate || forceReload) changeGratitudeDate(gratitudeLoadedDate || getTodayKey());
    renderGratitudeEntries();
}

function renderGratitudeEntries() {
    const container = document.getElementById('gratitudeEntriesList');
    const query = document.getElementById('gratitudeSearch').value.trim().toLowerCase();
    container.replaceChildren();
    try {
        const entries = getGratitudeEntries();
        const dates = Object.keys(entries).filter(date => validEntryDate(date) && entries[date] &&
            Object.keys(gratitudeFields).some(key => String(entries[date][key] || '').trim()) &&
            (!query || [date, formatDate(date), ...Object.keys(gratitudeFields).map(key => entries[date][key])].join(' ').toLowerCase().includes(query)))
            .sort((a, b) => b.localeCompare(a));
        if (!dates.length) {
            const empty = document.createElement('p');
            empty.className = 'empty-state';
            empty.textContent = query ? 'No gratitude entries match your search.' : 'Your first three good things start above. Saved entries will appear here.';
            container.append(empty);
            return;
        }
        dates.forEach(dateKey => {
            const entry = entries[dateKey];
            const card = document.createElement('article');
            card.className = 'gratitude-entry-card';
            const header = document.createElement('div');
            header.className = 'gratitude-entry-header';
            const date = document.createElement('time');
            date.dateTime = dateKey;
            date.textContent = formatDate(dateKey);
            const actions = document.createElement('div');
            actions.className = 'journal-entry-actions';
            [['Edit', () => {
                if (changeGratitudeDate(dateKey)) {
                    document.querySelector('.gratitude-workspace').scrollIntoView({ behavior: 'smooth', block: 'start' });
                    document.getElementById('gratitudeLife').focus({ preventScroll: true });
                }
            }], ['Export', () => openEntryExport('gratitude', dateKey)], ['Delete', () => deleteGratitudeEntry(dateKey)]].forEach(([label, action]) => {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = label === 'Delete' ? 'delete-journal-btn' : 'view-day-btn';
                button.textContent = label;
                button.setAttribute('aria-label', `${label} gratitude for ${formatDate(dateKey)}`);
                button.onclick = action;
                actions.append(button);
            });
            header.append(date, actions);
            const answers = document.createElement('div');
            answers.className = 'gratitude-entry-grid';
            Object.keys(gratitudeFields).forEach(key => {
                const group = document.createElement('div');
                group.className = 'gratitude-entry-answer';
                const label = document.createElement('h4');
                label.textContent = gratitudeLabels[key];
                const answer = document.createElement('p');
                answer.textContent = entry[key] || 'A little space for later.';
                if (!entry[key]) answer.className = 'unanswered';
                group.append(label, answer);
                answers.append(group);
            });
            card.append(header, answers);
            container.append(card);
        });
    } catch (error) {
        const message = document.createElement('p');
        message.className = 'save-error';
        message.textContent = 'Saved gratitude could not be read. A full backup can still preserve your data.';
        container.append(message);
    }
}

function deleteGratitudeEntry(dateKey) {
    if (!flushGratitudeDraft()) return;
    try {
        const undo = queueUndoSnapshot('Gratitude entry deleted.', ['gratitudeEntries']);
        const entries = getGratitudeEntries();
        delete entries[dateKey];
        localStorage.setItem('gratitudeEntries', JSON.stringify(entries));
        if (gratitudeLoadedDate === dateKey) changeGratitudeDate(dateKey);
        renderGratitudeEntries();
        undo();
    } catch (error) {
        gratitudeStatus('This entry could not be deleted. Your writing is still here.', true);
    }
}

function downloadBrowserFile(content, filename, mime) {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
}

function flushJournalDrafts() {
    if (document.getElementById('journalTodayEntry')?.dataset.dirty === 'true' && !saveJournalEntry(undefined, true)) return false;
    return flushGratitudeDraft();
}

function downloadJournalBackup() {
    // A download must remain available even if browser storage is full.
    const saved = flushJournalDrafts();
    const data = Object.fromEntries(journalBackupKeys.map(key => [key, localStorage.getItem(key)]));
    const drafts = {};
    const editor = document.getElementById('journalTodayEntry');
    if (editor?.dataset.dirty === 'true') {
        const date = editor.dataset.date || getTodayKey();
        const entry = { content: getJournalEditorContent('journalTodayEntry'), format: JOURNAL_FORMAT, updatedAt: new Date().toISOString() };
        try {
            const entries = JSON.parse(data.journalEntries || '{}');
            if (entry.content) entries[date] = entry;
            else delete entries[date];
            data.journalEntries = JSON.stringify(entries);
        } catch (error) { drafts.journal = { date, ...entry }; }
    }
    if (gratitudeDirty && gratitudeLoadedDate) {
        const entry = Object.fromEntries(Object.entries(gratitudeFields).map(([key, id]) => [key, document.getElementById(id).value]));
        entry.updatedAt = new Date().toISOString();
        try {
            const entries = JSON.parse(data.gratitudeEntries || '{}');
            entries[gratitudeLoadedDate] = entry;
            data.gratitudeEntries = JSON.stringify(entries);
        } catch (error) { drafts.gratitude = { date: gratitudeLoadedDate, ...entry }; }
    }
    const backup = { app: 'Journal', version: 1, exportedAt: new Date().toISOString(), data, unsavedDrafts: drafts };
    downloadBrowserFile(JSON.stringify(backup, null, 2), `journal-backup-${getTodayKey()}.json`, 'application/json');
    document.getElementById('backupMessage').textContent = saved ? 'Full backup downloaded. Keep it somewhere safe.' : 'Backup downloaded, including your unsaved writing. Keep this page open until you have checked the backup.';
}

async function restoreJournalBackup(input) {
    const file = input.files[0];
    if (!file) return;
    const status = document.getElementById('backupMessage');
    try {
        if (file.size > 30 * 1024 * 1024) throw new Error('This backup is too large to restore.');
        const backup = JSON.parse(await file.text());
        if (backup.app !== 'Journal' || backup.version !== 1 || !backup.data || typeof backup.data !== 'object' || Array.isArray(backup.data)) throw new Error('Choose a full Journal backup (.json).');
        const values = {};
        const arrayKeys = ['habitMetrics', 'longTermGoals', 'recurringDailyGoals', 'multiDayJournalEntries'];
        for (const key of journalBackupKeys) {
            const raw = backup.data[key];
            if (raw === null || raw === undefined) continue;
            if (typeof raw !== 'string') throw new Error('This backup contains invalid data.');
            const value = JSON.parse(raw);
            if (!value || typeof value !== 'object' || Array.isArray(value) !== arrayKeys.includes(key)) throw new Error('This backup contains invalid data.');
            if (key === 'dailyGoals' && Object.entries(value).some(([date, goals]) => !validEntryDate(date) || !Array.isArray(goals))) throw new Error('The backup has invalid goal dates.');
            if (key === 'gratitudeEntries' && Object.entries(value).some(([date, entry]) => !validEntryDate(date) || !entry || Object.keys(gratitudeFields).some(field => entry[field] != null && typeof entry[field] !== 'string'))) throw new Error('The backup has invalid gratitude entries.');
            values[key] = raw;
        }
        if (!Object.keys(values).length) throw new Error('This backup contains no data to restore.');
        if (!confirm('Restore this backup? The saved categories in this file will replace those in this browser. You can undo the restore immediately afterward. Download a full backup first if you want to keep both versions.')) return;
        if (!flushJournalDrafts()) return;
        const snapshot = captureStorageSnapshot(journalBackupKeys);
        const undo = queueUndoSnapshot('Backup restored.', journalBackupKeys);
        try {
            Object.entries(values).forEach(([key, value]) => localStorage.setItem(key, value));
        } catch (error) {
            // Free space occupied by partially applied values before restoring originals.
            Object.keys(values).forEach(key => localStorage.removeItem(key));
            restoreStorageSnapshot(Object.fromEntries(Object.keys(values).map(key => [key, snapshot[key]])));
            throw new Error('The backup could not fit in browser storage. Your previous data was restored.');
        }
        gratitudeLoadedDate = null;
        document.getElementById('journalTodayEntry')?.removeAttribute('data-date');
        refreshAllViews();
        if (document.getElementById('journal-section').classList.contains('active')) renderJournal();
        undo();
        status.textContent = 'Backup restored. Undo is available below.';
    } catch (error) {
        status.textContent = error.message || 'The backup could not be restored.';
    } finally {
        input.value = '';
    }
}

Object.values(gratitudeFields).forEach(id => {
    const field = document.getElementById(id);
    field.addEventListener('input', () => {
        gratitudeDirty = true;
        updateGratitudeProgress();
        gratitudeStatus('Saving…');
        clearTimeout(gratitudeSaveTimer);
        gratitudeSaveTimer = setTimeout(() => saveGratitudeEntry(), 500);
    });
    field.addEventListener('blur', flushGratitudeDraft);
});

// Keep clickable section headings usable with a keyboard too.
document.querySelectorAll('.collapsible-header').forEach(header => {
    header.setAttribute('role', 'button');
    header.tabIndex = 0;
    const sync = () => {
        const arrow = header.querySelector('.collapse-arrow');
        header.setAttribute('aria-expanded', String(!arrow?.classList.contains('collapsed')));
    };
    sync();
    header.addEventListener('click', sync);
    header.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            header.click();
        }
    });
});

// Save synchronously when navigating away; keep dates attached to their open draft.
window.addEventListener('pagehide', flushJournalDrafts);
window.addEventListener('beforeunload', event => {
    if (!flushJournalDrafts()) {
        event.preventDefault();
        event.returnValue = '';
    }
});
let lastOpenDay = getTodayKey();
function refreshOpenDay() {
    updateDate();
    const today = getTodayKey();
    if (today === lastOpenDay || !flushJournalDrafts()) return;
    const previousDay = lastOpenDay;
    lastOpenDay = today;
    if (gratitudeLoadedDate === previousDay) changeGratitudeDate(today);
    if (document.getElementById('journalTodayEntry')) renderJournal();
    if (document.getElementById('today-section').classList.contains('active')) renderMetrics();
    const goalDate = document.getElementById('goalDateInput');
    if (goalDate.value === previousDay) goalDate.value = today;
}
document.addEventListener('visibilitychange', () => {
    if (document.hidden) flushJournalDrafts();
    else refreshOpenDay();
});
window.addEventListener('focus', refreshOpenDay);
const journalRoutes = { 'goals-today': 'today', 'journal-entries': 'journal', 'gratitude-entries': 'gratitude', 'past-days': 'history', projects: 'longterm' };
function syncJournalRoute() { showSection(journalRoutes[location.hash.slice(1)] || 'today', null, false); }
window.addEventListener('popstate', syncJournalRoute);
syncJournalRoute();
