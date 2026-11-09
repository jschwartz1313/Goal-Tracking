const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const start = html.indexOf('        function saveEditHistory(date) {');
const end = html.indexOf('        // Add a new goal to a history entry', start);
assert.ok(start >= 0 && end > start, 'History save function is present');
const source = html.slice(start, end);
const date = '2026-11-09';
const nextDate = '2026-11-10';

function setup(goals, drafts = {}, extraGoals = {}) {
    const stored = new Map([
        ['dailyGoals', JSON.stringify({ [date]: goals, ...extraGoals })],
        ['habitHistory', JSON.stringify({
            [date]: { notes: 'Original reflection', lessonsLearned: 'Keep lesson', '12': 8 },
            '2026-11-08': { notes: 'Keep earlier day' }
        })]
    ]);
    const writes = [];
    const alerts = [];
    const elements = new Map();
    goals.forEach((goal, index) => {
        const draft = drafts[index] || {};
        elements.set(`history-goal-${date}-${index}`, {
            value: draft.status || goal.status,
            closest: () => ({ dataset: { deleted: draft.deleted ? 'true' : 'false' } })
        });
        elements.set(`history-goal-date-${date}-${index}`, {
            value: draft.targetDate === undefined ? date : draft.targetDate,
            focus() { this.focused = true; }
        });
        elements.set(`history-goal-text-${date}-${index}`, { value: draft.text || goal.text });
        elements.set(`history-goal-category-${date}-${index}`, { value: draft.category || 'other' });
    });
    elements.set(`history-notes-${date}`, { value: 'Edited reflection' });
    let undoShown = false;
    const context = vm.createContext({
        localStorage: {
            getItem: key => stored.get(key) ?? null,
            setItem(key, value) { writes.push(key); stored.set(key, value); }
        },
        document: { getElementById: id => elements.get(id) || null },
        alert: message => alerts.push(message),
        toLocalDateKey: value => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`,
        queueUndoSnapshot: () => () => { undoShown = true; },
        selectedCalendarDate: date,
        renderHistory() {}
    });
    vm.runInContext(source, context);
    return {
        save: () => context.saveEditHistory(date),
        read: key => JSON.parse(stored.get(key)),
        writes, alerts, elements,
        undoShown: () => undoShown
    };
}

const makeGoal = id => ({ id, text: `Goal ${id}`, status: 'incomplete', persistentGoalId: id + 100, duration: 20 });

test('deleting an earlier row and moving later rows preserves the correct goals and order', () => {
    const app = setup([1, 2, 3, 4, 5].map(makeGoal), {
        0: { deleted: true },
        1: { text: 'Updated second goal', status: 'complete', category: 'health' },
        2: { targetDate: nextDate },
        3: { targetDate: nextDate }
    }, { [nextDate]: [makeGoal(99)] });
    app.save();
    const goals = app.read('dailyGoals');
    assert.deepEqual(goals[date].map(goal => goal.id), [2, 5]);
    assert.deepEqual(goals[nextDate].map(goal => goal.id), [99, 3, 4]);
    assert.equal(goals[date][0].text, 'Updated second goal');
    assert.equal(goals[date][0].status, 'complete');
    assert.equal(goals[date][0].category, 'health');
    assert.equal(goals[nextDate][1].persistentGoalId, 103);
    assert.equal(goals[nextDate][1].duration, 20);
    assert.equal(app.undoShown(), true);
    const history = app.read('habitHistory');
    assert.equal(history[date].notes, 'Edited reflection');
    assert.equal(history[date]['12'], 8);
    assert.equal(history[date].lessonsLearned, 'Keep lesson');
    assert.equal(history['2026-11-08'].notes, 'Keep earlier day');
});

for (const targetDate of ['', 'invalid', '2026-02-30', '2026-13-02']) {
    test(`invalid target date ${JSON.stringify(targetDate)} does not write either storage key`, () => {
        const app = setup([makeGoal(1), makeGoal(2)], {
            0: { targetDate: nextDate },
            1: { targetDate }
        });
        app.save();
        assert.deepEqual(app.writes, []);
        assert.equal(app.alerts.length, 1);
        assert.equal(app.undoShown(), false);
        assert.deepEqual(app.read('dailyGoals')[date], [makeGoal(1), makeGoal(2)]);
        assert.equal(app.read('habitHistory')[date].notes, 'Original reflection');
        assert.equal(app.elements.get(`history-goal-date-${date}-1`).focused, true);
    });
}

test('deleting every source goal removes only that date and ignores dates on deleted rows', () => {
    const app = setup([makeGoal(1)], { 0: { deleted: true, targetDate: '' } }, {
        [nextDate]: [makeGoal(2)]
    });
    app.save();
    assert.equal(date in app.read('dailyGoals'), false);
    assert.deepEqual(app.read('dailyGoals')[nextDate], [makeGoal(2)]);
    assert.equal(app.alerts.length, 0);
});

test('moving all goals to multiple dates keeps destination ordering and removes the empty source', () => {
    const app = setup([1, 2, 3].map(makeGoal), {
        0: { targetDate: nextDate },
        1: { targetDate: '2026-11-12' },
        2: { targetDate: nextDate }
    });
    app.save();
    const goals = app.read('dailyGoals');
    assert.equal(date in goals, false);
    assert.deepEqual(goals[nextDate].map(goal => goal.id), [1, 3]);
    assert.deepEqual(goals['2026-11-12'].map(goal => goal.id), [2]);
});
