const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'gratitude.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const restoreStart = html.indexOf('        function restoreStorageSnapshot(snapshot) {');
const restoreEnd = html.indexOf('        function dismissUndoToast()', restoreStart);
assert.ok(restoreStart >= 0 && restoreEnd > restoreStart);
const restoreSource = html.slice(restoreStart, restoreEnd);

class Element {
    constructor(tag = 'div') {
        this.tagName = tag.toUpperCase();
        this.value = '';
        this.dataset = {};
        this.children = [];
        this.events = {};
        this.attributes = {};
        const classes = new Set();
        this.classList = {
            contains: value => classes.has(value),
            toggle(value, enabled) {
                const next = enabled === undefined ? !classes.has(value) : enabled;
                if (next) classes.add(value);
                else classes.delete(value);
            }
        };
    }
    append(...elements) { this.children.push(...elements); }
    replaceChildren(...elements) { this.children = elements; }
    setAttribute(key, value) { this.attributes[key] = value; }
    removeAttribute(key) { delete this.attributes[key]; if (key.startsWith('data-')) delete this.dataset[key.slice(5)]; }
    addEventListener(name, action) { this.events[name] = action; }
    focus() { this.focused = true; }
    scrollIntoView() {}
}

function setup(initialEntries = {}, extraStorage = {}) {
    const stored = new Map(Object.entries({
        dailyGoals: '{"2026-11-08":[{"id":7,"text":"Keep my goal"}]}',
        journalEntries: '{"2026-11-08":{"content":"Keep my journal"}}',
        longTermGoals: '[{"id":9,"title":"Keep my project"}]',
        gratitudeEntries: JSON.stringify(initialEntries),
        ...extraStorage
    }));
    const originalStorage = new Map(stored);
    const elements = new Map();
    ['gratitudeLife', 'gratitudeAislynn', 'gratitudeRecent', 'gratitudeSaveStatus', 'gratitudeProgress',
        'gratitudeDate', 'gratitudeDateHeading', 'gratitudeNextDay', 'gratitudeSearch', 'gratitudeEntriesList',
        'backupMessage', 'journal-section', 'today-section', 'goalDateInput'].forEach(id => elements.set(id, new Element()));
    const documentEvents = {};
    const windowEvents = {};
    const timers = new Map();
    let timerId = 0;
    let today = '2026-11-09';
    let rejectWrites = false;
    let storageLimit = Infinity;
    let pendingUndo = null;
    const writes = [];
    const parseDateKey = value => { const [y, m, d] = value.split('-').map(Number); return new Date(y, m - 1, d); };
    const toLocalDateKey = value => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
    const context = vm.createContext({
        console,
        Blob,
        URL,
        capturedDownload: null,
        localStorage: {
            getItem: key => stored.get(key) ?? null,
            setItem(key, value) {
                if (rejectWrites) throw new Error('Quota exceeded');
                const bytes = [...stored.entries()].reduce((sum, [storedKey, raw]) => sum + storedKey.length + raw.length, 0);
                const nextBytes = bytes - (stored.has(key) ? key.length + stored.get(key).length : 0) + key.length + value.length;
                if (nextBytes > storageLimit) throw new Error('Quota exceeded');
                writes.push(key);
                stored.set(key, value);
            },
            removeItem: key => stored.delete(key)
        },
        document: {
            body: new Element('body'),
            hidden: false,
            getElementById: id => elements.get(id) || null,
            querySelectorAll: () => [],
            querySelector: () => new Element(),
            createElement: tag => new Element(tag),
            addEventListener: (name, action) => { documentEvents[name] = action; }
        },
        window: { addEventListener: (name, action) => { windowEvents[name] = action; } },
        getTodayKey: () => today,
        parseDateKey,
        toLocalDateKey,
        shiftDateKey(value, amount) { const date = parseDateKey(value); date.setDate(date.getDate() + amount); return toLocalDateKey(date); },
        formatDate: value => value,
        setTimeout(action) { const id = ++timerId; timers.set(id, action); return id; },
        clearTimeout: id => timers.delete(id),
        openEntryExport() {},
        showSection() {},
        updateDate() {},
        renderJournal() {},
        renderMetrics() {},
        confirm: () => true,
        location: { hash: '' },
        saveJournalEntry: () => true,
        captureStorageSnapshot: keys => Object.fromEntries(keys.map(key => [key, stored.get(key) ?? null])),
        queueUndoSnapshot(message, keys) {
            const snapshot = Object.fromEntries(keys.map(key => [key, stored.get(key) ?? null]));
            return () => { pendingUndo = () => { context.restoreStorageSnapshot(snapshot); context.refreshAllViews(); }; };
        },
        refreshAllViews() { context.renderGratitude(true); }
    });
    vm.runInContext(restoreSource, context);
    vm.runInContext(source, context);
    vm.runInContext('downloadBrowserFile = function(content, filename, mime) { capturedDownload = { content, filename, mime }; };', context);
    return {
        context, elements, stored, originalStorage, writes, windowEvents, documentEvents,
        evaluate: expression => vm.runInContext(expression, context),
        load: (date = today) => context.changeGratitudeDate(date),
        input(id, value) { elements.get(id).value = value; elements.get(id).events.input(); },
        runTimers() { const callbacks = [...timers.values()]; timers.clear(); callbacks.forEach(callback => callback()); },
        read: key => JSON.parse(stored.get(key)),
        setToday: value => { today = value; },
        rejectWrites: value => { rejectWrites = value; },
        setQuota: value => { storageLimit = value; },
        undo: () => pendingUndo?.(),
        draftDirty: () => vm.runInContext('gratitudeDirty', context),
        loadedDate: () => vm.runInContext('gratitudeLoadedDate', context)
    };
}

test('debounced autosave keeps separate responses and preserves all legacy storage', () => {
    const app = setup();
    app.load();
    app.input('gratitudeLife', 'A calm home');
    app.input('gratitudeAislynn', 'Your kindness');
    app.input('gratitudeRecent', 'Our walk yesterday');
    assert.equal(app.writes.length, 0);
    assert.equal(app.draftDirty(), true);
    app.runTimers();
    const entry = app.read('gratitudeEntries')['2026-11-09'];
    assert.equal(entry.life, 'A calm home');
    assert.equal(entry.aislynn, 'Your kindness');
    assert.equal(entry.recent, 'Our walk yesterday');
    assert.ok(entry.updatedAt);
    assert.deepEqual(app.writes, ['gratitudeEntries']);
    for (const [key, raw] of app.originalStorage) if (key !== 'gratitudeEntries') assert.equal(app.stored.get(key), raw);
    assert.match(app.elements.get('gratitudeProgress').textContent, /^3 of 3/);
    assert.equal(app.draftDirty(), false);
});

test('switching dates saves the old draft before loading a different entry', () => {
    const app = setup({ '2026-11-08': { life: 'Yesterday', aislynn: 'Sunday coffee', recent: '' } });
    app.load();
    app.input('gratitudeLife', 'Today before switching');
    assert.equal(app.load('2026-11-08'), true);
    assert.equal(app.read('gratitudeEntries')['2026-11-09'].life, 'Today before switching');
    assert.equal(app.elements.get('gratitudeLife').value, 'Yesterday');
    app.input('gratitudeAislynn', 'Edited Sunday coffee');
    app.elements.get('gratitudeAislynn').events.blur();
    assert.equal(app.read('gratitudeEntries')['2026-11-08'].aislynn, 'Edited Sunday coffee');
    assert.equal(app.read('gratitudeEntries')['2026-11-09'].life, 'Today before switching');
    app.runTimers();
    assert.equal(app.read('gratitudeEntries')['2026-11-09'].life, 'Today before switching');
});

test('quota failures retain the unsaved draft and block date changes', () => {
    const app = setup({ '2026-11-08': { life: 'Keep earlier entry' } });
    app.load();
    app.input('gratitudeLife', 'An unsaved thought');
    app.rejectWrites(true);
    app.runTimers();
    assert.equal(app.draftDirty(), true);
    assert.equal(app.load('2026-11-08'), false);
    assert.equal(app.loadedDate(), '2026-11-09');
    assert.equal(app.elements.get('gratitudeDate').value, '2026-11-09');
    assert.equal(app.elements.get('gratitudeLife').value, 'An unsaved thought');
    assert.equal(app.stored.get('gratitudeEntries'), app.originalStorage.get('gratitudeEntries'));
    assert.match(app.elements.get('gratitudeSaveStatus').textContent, /Could not save/);
    app.rejectWrites(false);
    assert.equal(app.context.flushGratitudeDraft(), true);
    assert.equal(app.read('gratitudeEntries')['2026-11-09'].life, 'An unsaved thought');
});

test('empty writing does not create a record and clearing the fields removes only that date', () => {
    const app = setup({ '2026-11-08': { life: 'Keep me' } });
    app.load();
    app.input('gratitudeLife', '   \n ');
    app.runTimers();
    assert.deepEqual(app.read('gratitudeEntries'), { '2026-11-08': { life: 'Keep me' } });
    app.input('gratitudeRecent', 'A brief thought');
    app.runTimers();
    assert.equal(app.read('gratitudeEntries')['2026-11-09'].recent, 'A brief thought');
    app.input('gratitudeRecent', '');
    app.runTimers();
    assert.deepEqual(app.read('gratitudeEntries'), { '2026-11-08': { life: 'Keep me' } });
});

for (const date of ['', '2026-02-30', '2026-13-01', '2026-11-10', 'not-a-date']) {
    test(`invalid or future date ${JSON.stringify(date)} cannot discard the current draft`, () => {
        const app = setup();
        app.load();
        app.input('gratitudeLife', 'Keep the draft');
        assert.equal(app.load(date), false);
        assert.equal(app.loadedDate(), '2026-11-09');
        assert.equal(app.elements.get('gratitudeLife').value, 'Keep the draft');
        assert.equal(app.draftDirty(), true);
        assert.equal(app.writes.length, 0);
    });
}

test('delete and undo restore both saved gratitude and the open editor', () => {
    const app = setup({
        '2026-11-09': { life: 'A good life', aislynn: 'A good person', recent: 'A good moment' },
        '2026-11-08': { life: 'Keep yesterday' }
    });
    app.load();
    app.context.deleteGratitudeEntry('2026-11-09');
    assert.equal(app.read('gratitudeEntries')['2026-11-09'], undefined);
    assert.equal(app.elements.get('gratitudeLife').value, '');
    assert.equal(app.read('gratitudeEntries')['2026-11-08'].life, 'Keep yesterday');
    app.undo();
    assert.equal(app.read('gratitudeEntries')['2026-11-09'].life, 'A good life');
    assert.equal(app.elements.get('gratitudeLife').value, 'A good life');
    assert.equal(app.elements.get('gratitudeAislynn').value, 'A good person');
});

test('bad stored JSON is preserved and never replaced by a fresh empty store', () => {
    const app = setup({}, { gratitudeEntries: '{broken-json' });
    assert.equal(app.load(), false);
    assert.equal(app.stored.get('gratitudeEntries'), '{broken-json');
    assert.deepEqual(app.writes, []);
    assert.match(app.elements.get('gratitudeSaveStatus').textContent, /could not be loaded/);
});

test('a draft stays attached to its selected date when midnight passes', () => {
    const app = setup();
    app.load();
    app.input('gratitudeLife', 'Monday evening');
    app.setToday('2026-11-10');
    app.runTimers();
    assert.equal(app.read('gratitudeEntries')['2026-11-09'].life, 'Monday evening');
    assert.equal(app.read('gratitudeEntries')['2026-11-10'], undefined);
});

test('full backup saves pending gratitude and includes raw legacy records without changes', () => {
    const app = setup();
    app.load();
    app.input('gratitudeAislynn', 'A thought worth backing up');
    app.context.downloadJournalBackup();
    const download = app.context.capturedDownload;
    const backup = JSON.parse(download.content);
    assert.equal(backup.app, 'Journal');
    assert.equal(backup.version, 1);
    assert.match(download.filename, /^journal-backup-2026-11-09\.json$/);
    assert.equal(JSON.parse(backup.data.gratitudeEntries)['2026-11-09'].aislynn, 'A thought worth backing up');
    assert.equal(backup.data.dailyGoals, app.originalStorage.get('dailyGoals'));
    assert.equal(backup.data.journalEntries, app.originalStorage.get('journalEntries'));
    assert.equal(backup.data.longTermGoals, app.originalStorage.get('longTermGoals'));
});

test('a full backup still downloads quota-failed gratitude drafts without changing saved records', () => {
    const app = setup({ '2026-11-08': { life: 'A saved earlier thought' } });
    app.load();
    app.input('gratitudeLife', 'Keep my unsaved draft');
    app.input('gratitudeAislynn', 'A memory not saved yet');
    app.rejectWrites(true);
    app.context.downloadJournalBackup();
    const backup = JSON.parse(app.context.capturedDownload.content);
    const entries = JSON.parse(backup.data.gratitudeEntries);
    assert.equal(entries['2026-11-09'].life, 'Keep my unsaved draft');
    assert.equal(entries['2026-11-09'].aislynn, 'A memory not saved yet');
    assert.equal(entries['2026-11-08'].life, 'A saved earlier thought');
    assert.equal(app.stored.get('gratitudeEntries'), app.originalStorage.get('gratitudeEntries'));
    assert.equal(app.draftDirty(), true);
    assert.match(app.elements.get('backupMessage').textContent, /including your unsaved writing/);
});

test('backup preserves malformed raw data alongside an otherwise unsavable draft', () => {
    const app = setup();
    app.load();
    app.input('gratitudeRecent', 'A draft I still need');
    app.stored.set('gratitudeEntries', '{broken-json');
    app.context.downloadJournalBackup();
    const backup = JSON.parse(app.context.capturedDownload.content);
    assert.equal(backup.data.gratitudeEntries, '{broken-json');
    assert.equal(backup.unsavedDrafts.gratitude.date, '2026-11-09');
    assert.equal(backup.unsavedDrafts.gratitude.recent, 'A draft I still need');
    assert.equal(app.elements.get('gratitudeRecent').value, 'A draft I still need');
});

test('returning after midnight saves yesterday before opening a fresh today', () => {
    const app = setup();
    app.load();
    app.elements.get('goalDateInput').value = '2026-11-09';
    app.input('gratitudeLife', 'Monday before midnight');
    app.setToday('2026-11-10');
    app.windowEvents.focus();
    assert.equal(app.read('gratitudeEntries')['2026-11-09'].life, 'Monday before midnight');
    assert.equal(app.loadedDate(), '2026-11-10');
    assert.equal(app.elements.get('gratitudeLife').value, '');
    assert.equal(app.elements.get('goalDateInput').value, '2026-11-10');
    assert.match(app.elements.get('gratitudeDateHeading').textContent, /2026-11-10/);
});

test('midnight rollover keeps a deliberately selected older date', () => {
    const app = setup();
    app.load('2026-11-07');
    app.input('gratitudeLife', 'Saturday memory');
    app.setToday('2026-11-10');
    app.windowEvents.focus();
    assert.equal(app.loadedDate(), '2026-11-07');
    assert.equal(app.read('gratitudeEntries')['2026-11-07'].life, 'Saturday memory');
    assert.equal(app.elements.get('gratitudeLife').value, 'Saturday memory');
});

test('quota failure blocks midnight rollover and keeps the original draft recoverable', () => {
    const app = setup();
    app.load();
    app.input('gratitudeLife', 'An important late-night thought');
    app.rejectWrites(true);
    app.setToday('2026-11-10');
    app.windowEvents.focus();
    assert.equal(app.loadedDate(), '2026-11-09');
    assert.equal(app.elements.get('gratitudeLife').value, 'An important late-night thought');
    assert.equal(app.draftDirty(), true);
    assert.equal(app.writes.length, 0);
});

test('restoring a malformed backup never changes existing data', async () => {
    const app = setup();
    const input = { value: 'file.json', files: [{ size: 100, text: async () => JSON.stringify({
        app: 'Journal', version: 1,
        data: { gratitudeEntries: JSON.stringify({ '2026-11-09': { life: 72 } }) }
    }) }] };
    await app.context.restoreJournalBackup(input);
    assert.deepEqual(app.writes, []);
    for (const [key, raw] of app.originalStorage) assert.equal(app.stored.get(key), raw);
    assert.match(app.elements.get('backupMessage').textContent, /invalid gratitude/);
    assert.equal(input.value, '');
});

test('restore applies only supported keys, and undo restores the previous gratitude', async () => {
    const app = setup({ '2026-11-09': { life: 'Before restore' } }, { anotherApp: 'unrelated' });
    app.load();
    const input = { value: 'backup.json', files: [{ size: 100, text: async () => JSON.stringify({
        app: 'Journal', version: 1, data: {
            gratitudeEntries: JSON.stringify({ '2026-11-09': { life: 'From backup', aislynn: 'A memory' } }),
            anotherApp: 'malicious overwrite'
        }
    }) }] };
    await app.context.restoreJournalBackup(input);
    assert.equal(app.read('gratitudeEntries')['2026-11-09'].life, 'From backup');
    assert.equal(app.elements.get('gratitudeLife').value, 'From backup');
    assert.equal(app.stored.get('anotherApp'), 'unrelated');
    assert.equal(app.stored.get('dailyGoals'), app.originalStorage.get('dailyGoals'));
    app.undo();
    assert.equal(app.read('gratitudeEntries')['2026-11-09'].life, 'Before restore');
    assert.equal(app.elements.get('gratitudeLife').value, 'Before restore');
});

test('a quota failure midway through a restore rolls back smaller and larger replacement records', async () => {
    const app = setup({}, {
        dailyGoals: JSON.stringify({ '2026-11-09': [{ id: 12, text: 'x'.repeat(1000), status: 'incomplete' }] }),
        journalEntries: '{}',
        longTermGoals: '[]'
    });
    const originalSize = [...app.stored.entries()].reduce((sum, [key, raw]) => sum + key.length + raw.length, 0);
    app.setQuota(originalSize + 100);
    const input = { value: 'backup.json', files: [{ size: 3000, text: async () => JSON.stringify({
        app: 'Journal', version: 1, data: {
            dailyGoals: '{}',
            journalEntries: JSON.stringify({ '2026-11-08': { content: 'j'.repeat(900) } }),
            multiDayJournalEntries: JSON.stringify([{ id: 10, content: 'm'.repeat(900) }])
        }
    }) }] };
    await app.context.restoreJournalBackup(input);
    for (const [key, raw] of app.originalStorage) assert.equal(app.stored.get(key), raw, `${key} returns to its pre-restore value`);
    assert.equal(app.stored.has('multiDayJournalEntries'), false);
    assert.match(app.elements.get('backupMessage').textContent, /previous data was restored/);
});

test('undoing a successful restore recovers a large original after other categories grew', async () => {
    const app = setup({}, {
        dailyGoals: JSON.stringify({ '2026-11-09': [{ id: 12, text: 'x'.repeat(1000), status: 'incomplete' }] }),
        journalEntries: '{}',
        longTermGoals: '[]'
    });
    const originalSize = [...app.stored.entries()].reduce((sum, [key, raw]) => sum + key.length + raw.length, 0);
    app.setQuota(originalSize + 100);
    const input = { value: 'backup.json', files: [{ size: 1200, text: async () => JSON.stringify({
        app: 'Journal', version: 1, data: {
            dailyGoals: '{}',
            journalEntries: JSON.stringify({ '2026-11-08': { content: 'j'.repeat(900) } })
        }
    }) }] };
    await app.context.restoreJournalBackup(input);
    assert.equal(app.read('dailyGoals')['2026-11-09'], undefined);
    assert.equal(app.read('journalEntries')['2026-11-08'].content.length, 900);
    app.undo();
    for (const [key, raw] of app.originalStorage) assert.equal(app.stored.get(key), raw, `${key} returns to its pre-restore value`);
});
