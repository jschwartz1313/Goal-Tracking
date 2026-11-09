const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const gratitude = {
    '2026-11-09': { life: 'A safe home & good friends.', aislynn: 'Your kindness <every day>.', recent: '' },
    '2026-11-07': { life: '   ', aislynn: 'A walk together.', recent: 'A good conversation.' },
    '2026-11-08': { life: '', aislynn: '', recent: '' }
};
const context = vm.createContext({ window: {}, TextEncoder, Uint8Array, DataView,
    getGratitudeEntries: () => gratitude });
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'exports.js'), 'utf8'), context);
const api = context.window.JournalExports;

function independentCrc32(bytes) {
    let crc = 0xFFFFFFFF;
    for (const byte of bytes) {
        crc ^= byte;
        for (let i = 0; i < 8; i++) crc = crc & 1 ? (crc >>> 1) ^ 0xEDB88320 : crc >>> 1;
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

function readZip(bytes) {
    const buffer = Buffer.from(bytes);
    const files = {};
    let offset = 0;
    while (buffer.readUInt32LE(offset) === 0x04034B50) {
        assert.equal(buffer.readUInt16LE(offset + 8), 0, 'ZIP uses store compression');
        const size = buffer.readUInt32LE(offset + 18);
        assert.equal(buffer.readUInt32LE(offset + 22), size);
        const nameLength = buffer.readUInt16LE(offset + 26);
        const extraLength = buffer.readUInt16LE(offset + 28);
        const name = buffer.subarray(offset + 30, offset + 30 + nameLength).toString();
        const dataStart = offset + 30 + nameLength + extraLength;
        const data = buffer.subarray(dataStart, dataStart + size);
        assert.equal(independentCrc32(data), buffer.readUInt32LE(offset + 14), `${name} checksum`);
        files[name] = data.toString();
        offset = dataStart + size;
    }
    const centralStart = offset;
    let index = 0;
    while (buffer.readUInt32LE(offset) === 0x02014B50) {
        const nameLength = buffer.readUInt16LE(offset + 28);
        const extraLength = buffer.readUInt16LE(offset + 30);
        const commentLength = buffer.readUInt16LE(offset + 32);
        const localOffset = buffer.readUInt32LE(offset + 42);
        assert.equal(buffer.readUInt32LE(localOffset), 0x04034B50, 'Central directory points to a file header');
        const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString();
        assert.equal(name, Object.keys(files)[index++]);
        offset += 46 + nameLength + extraLength + commentLength;
    }
    assert.equal(buffer.readUInt32LE(offset), 0x06054B50, 'ZIP end record');
    assert.equal(buffer.readUInt16LE(offset + 10), Object.keys(files).length);
    assert.equal(buffer.readUInt32LE(offset + 12), offset - centralStart);
    assert.equal(buffer.readUInt32LE(offset + 16), centralStart);
    assert.equal(offset + 22, buffer.length, 'No trailing data');
    return files;
}

test('gratitude category filtering excludes other prompts, empty entries, and preserves oldest-first order', () => {
    const records = api.collectRecords('gratitude', null, 'aislynn');
    assert.deepEqual(Array.from(records, record => record.date), ['2026-11-07', '2026-11-09']);
    const text = api.createPlainText('Gratitude for Aislynn', records);
    assert.ok(text.indexOf('A walk together.') < text.indexOf('Your kindness <every day>.'));
    assert.equal(text.includes('safe home'), false);
    assert.equal(text.includes('good conversation'), false);
});

test('single-date gratitude export includes only that day', () => {
    const records = api.collectRecords('gratitude', '2026-11-07');
    assert.equal(records.length, 1);
    assert.equal(records[0].date, '2026-11-07');
});

test('real calendar dates, including leap years, are validated', () => {
    assert.equal(api.validDate('2024-02-29'), true);
    for (const value of ['', '2026-02-29', '2026-02-30', '2026-00-10', '2026-13-10', '2026-1-01', 'x']) {
        assert.equal(api.validDate(value), false, value);
    }
});

test('export ranges reject missing, invalid, and reversed dates', () => {
    assert.equal(api.dateRangeError('2026-11-01', '2026-11-09', true), '');
    assert.equal(api.dateRangeError('', '', false), '');
    for (const [start, end] of [['', ''], ['', '2026-11-09'], ['2026-11-09', ''], ['2026-02-30', '2026-11-09'], ['2026-11-10', '2026-11-09']]) {
        assert.ok(api.dateRangeError(start, end, true));
    }
});

test('date ranges include overlapping multi-day entries and handle undated records explicitly', () => {
    const records = [
        { date: '2026-11-01', endDate: '2026-11-10' },
        { date: '2026-11-11', endDate: '2026-11-11' },
        { date: null, endDate: null }
    ];
    assert.equal(api.filterRecords(records, '2026-11-08', '2026-11-09', false).length, 1);
    assert.equal(api.filterRecords(records, '2026-11-08', '2026-11-09', true).length, 2);
});

test('Word export is a genuine ZIP package with correct checksums, relationships, and escaped Unicode XML', () => {
    const records = [{
        title: 'Aislynn & Jake <together>', subtitle: 'November 9, 2026',
        blocks: [{ style: 'Normal', runs: [
            { text: 'Café — “thank you” & <love>\nSecond line', bold: true, italic: true, underline: true },
            { text: '\u0000Invalid XML character removed' }
        ] }]
    }];
    const files = readZip(api.createDocx('Gratitude', records));
    assert.deepEqual(Object.keys(files), ['[Content_Types].xml', '_rels/.rels', 'word/document.xml', 'word/styles.xml', 'word/_rels/document.xml.rels']);
    assert.match(files['[Content_Types].xml'], /wordprocessingml\.document\.main\+xml/);
    assert.match(files['_rels/.rels'], /Target="word\/document.xml"/);
    assert.match(files['word/_rels/document.xml.rels'], /Target="styles.xml"/);
    const xml = files['word/document.xml'];
    assert.match(xml, /Aislynn &amp; Jake &lt;together&gt;/);
    assert.match(xml, /Café — “thank you” &amp; &lt;love&gt;/);
    assert.match(xml, /<w:b\/><w:i\/><w:u w:val="single"\/>/);
    assert.match(xml, /<w:br\/>/);
    assert.equal(xml.includes('\u0000'), false);
    assert.match(files['word/styles.xml'], /w:ascii="Georgia"/);
});

test('plain text preserves paragraph boundaries and explicit line breaks without XML escaping', () => {
    const records = [{ title: 'A & B', blocks: api.textBlocks('One\nTwo') }];
    assert.equal(api.createPlainText('Journal Entries', records), 'Journal Entries\n\nA & B\n\nOne\n\nTwo\n');
});

function apiWith(globals) {
    const environment = vm.createContext({ window: {}, TextEncoder, Uint8Array, DataView, ...globals });
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'exports.js'), 'utf8'), environment);
    return { environment, api: environment.window.JournalExports };
}

test('daily goal exports are separate, filter by date, and include readable status and planning details', () => {
    const { api: goalsApi } = apiWith({
        getAllGoals: () => ({
            '2026-11-09': [{ text: 'Read a chapter', status: 'complete', priority: 2, duration: 30, category: 'learning' }, { text: 'Deleted goal', status: 'deleted' }],
            '2026-11-07': [{ text: 'Take a walk', status: 'partial', priority: 1, duration: 15, category: 'well-being', isRecurring: true }],
            '2026-11-08': []
        }),
        getGratitudeEntries: () => { throw new Error('Gratitude must not be read for goal exports'); },
        getJournalEntries: () => { throw new Error('Journal must not be read for goal exports'); },
        getLongTermGoals: () => { throw new Error('Projects must not be read for goal exports'); }
    });
    const records = goalsApi.collectRecords('goals');
    assert.deepEqual(Array.from(records, record => record.date), ['2026-11-07', '2026-11-09']);
    const text = goalsApi.createPlainText(goalsApi.exportTitle('goals'), goalsApi.collectRecords('goals', '2026-11-09'));
    assert.match(text, /^Daily Goals/);
    assert.match(text, /Read a chapter/);
    assert.match(text, /Status: Complete · Priority: P2 · Duration: 30 min · Category: Learning/);
    assert.equal(text.includes('Take a walk'), false);
    assert.equal(text.includes('Deleted goal'), false);
    assert.equal(goalsApi.filterRecords(records, '2026-11-07', '2026-11-07').length, 1);
});

test('projects export descriptions, progress, target dates, and sub-goals independently', () => {
    const { api: projectsApi } = apiWith({
        getLongTermGoals: () => [
            { id: 3, title: 'Undated idea', description: 'Explore options', targetDate: null, progress: 0, status: 'not_started', subGoals: [] },
            { id: 7, title: 'Trip planning', description: 'Plan a visit & book lodging.', targetDate: '2026-12-10', progress: 50, status: 'in_progress', subGoals: [{ text: 'Choose dates', completed: true }, { text: 'Book lodging', completed: false }] }
        ],
        getGratitudeEntries: () => { throw new Error('Gratitude must not be read for project exports'); },
        getJournalEntries: () => { throw new Error('Journal must not be read for project exports'); },
        getAllGoals: () => { throw new Error('Daily goals must not be read for project exports'); }
    });
    const all = projectsApi.collectRecords('projects');
    assert.deepEqual(Array.from(all, record => record.title), ['Trip planning', 'Undated idea']);
    assert.equal(all[1].date, null);
    const selected = projectsApi.collectRecords('projects', { projectId: 7 });
    assert.equal(selected.length, 1);
    const text = projectsApi.createPlainText(projectsApi.exportTitle('projects'), selected);
    assert.match(text, /^Projects/);
    assert.match(text, /Plan a visit & book lodging\./);
    assert.match(text, /Progress: 50%/);
    assert.match(text, /Status: In Progress/);
    assert.match(text, /Target date: December 10, 2026/);
    assert.match(text, /\[Complete\] Choose dates/);
    assert.match(text, /\[Open\] Book lodging/);
    assert.equal(text.includes('Undated idea'), false);
});

test('unreadable gratitude data opens an error dialog and disables exporting without a crash', () => {
    const fields = new Map();
    for (const id of ['exportStartDate', 'exportEndDate', 'exportCategory', 'exportFormat', 'exportDialogTitle', 'exportDescription', 'exportCategoryLabel', 'exportPreview', 'exportError', 'exportDownload']) {
        fields.set(id, { value: '', hidden: false, disabled: false, textContent: '' });
    }
    const dialog = { open: false, showModal() { this.open = true; } };
    fields.set('exportDialog', dialog);
    let flushed = 0;
    const { environment } = apiWith({
        document: { getElementById: id => fields.get(id) || null },
        flushJournalDrafts: () => { flushed++; return true; },
        getGratitudeEntries: () => { throw new Error('Invalid saved JSON'); }
    });
    assert.doesNotThrow(() => environment.window.openEntryExport('gratitude'));
    assert.equal(flushed, 1, 'Existing draft flush integration remains active');
    assert.equal(dialog.open, true);
    assert.equal(fields.get('exportError').hidden, false);
    assert.match(fields.get('exportError').textContent, /saved gratitude entries could not be read/);
    assert.equal(fields.get('exportDownload').disabled, true);
});
