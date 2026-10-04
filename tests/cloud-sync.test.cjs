// Run: node --test --test-isolation=none tests/cloud-sync.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);

const storage = new Map();
global.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
global.window = { localStorage: global.localStorage, addEventListener() {}, removeEventListener() {}, location: { reload() {} } };
Object.defineProperty(global, 'navigator', { value: { onLine: true }, configurable: true });
let authCallback;
let beforeWrite;
let failWrite = false;
let missingTable = false;
let writes = 0;
const requests = [];
const rows = new Map();
const clone = value => JSON.parse(JSON.stringify(value));
const empty = () => ({ version: 1, cards: [], session: null, read: [], progress: { streak: 0, lastStudyDate: null, totalReviews: 0, xp: 0, level: 1, dailyGoal: 20, lastDailyGen: null } });
const toRow = card => ({ client_id: card.id, front: card.front, back: card.back, back_en: card.backEn, back_vi: card.backVi,
  example: card.example, example_vi: card.exampleVi, phonetic: card.phonetic, level: card.level, tags: card.tags,
  leitner_stage: card.leitnerStage, created_at: card.createdAt, due: card.due, last_review: card.last_review,
  state: card.state, stability: card.stability, difficulty: card.difficulty, elapsed_days: card.elapsed_days,
  scheduled_days: card.scheduled_days, learning_steps: card.learning_steps, reps: card.reps, lapses: card.lapses });
const toProgress = progress => ({ streak: progress.streak, last_study_date: progress.lastStudyDate,
  total_reviews: progress.totalReviews, xp: progress.xp, level: progress.level, daily_goal: progress.dailyGoal, last_daily_gen: progress.lastDailyGen });
const client = {
  auth: { onAuthStateChange(callback) { authCallback = callback; return { data: { subscription: { unsubscribe() {} } } }; } },
  async rpc(name, parameters) {
    requests.push({ name, parameters: clone(parameters) });
    const id = useCloudSync.getState().user.id;
    if (!rows.has(id)) rows.set(id, { payload: empty(), revision: 0, updated_at: new Date().toISOString(), deleted: [], knownLessons: [] });
    const row = rows.get(id);
    if (name === 'get_learning_changes') {
      if (missingTable) return { data: null, error: { message: 'Could not find function get_learning_changes in schema cache' } };
      const changed = row.revision > parameters.p_since_revision;
      const session = row.payload.session;
      return { data: clone({ revision: row.revision, updated_at: row.updated_at,
        current_session_date: session?.date || null,
        cards: changed ? [...row.payload.cards.map(toRow), ...row.deleted.map(client_id => ({ client_id, deleted_at: row.updated_at }))] : [],
        progress: changed ? toProgress(row.payload.progress) : null,
        session: changed && session ? sessionRecord(session) : null,
        lessons: changed ? [...new Set([...row.knownLessons, ...row.payload.read])].map(lesson_id => ({ lesson_id, is_read: row.payload.read.includes(lesson_id) })) : [],
      }), error: null };
    }
    assert.equal(name, 'save_learning_changes');
    if (beforeWrite) { const callback = beforeWrite; beforeWrite = null; callback(); }
    if (failWrite) return { data: null, error: { message: 'Network request failed' } };
    if (row.revision !== parameters.p_expected_revision) return { data: { conflict: true, revision: row.revision, updated_at: null }, error: null };
    writes++;
    const changes = parameters.p_changes;
    const cards = new Map(row.payload.cards.map(card => [card.id, card]));
    for (const card of changes.cards) { cards.set(card.id, card); row.deleted = row.deleted.filter(id => id !== card.id); }
    for (const id of changes.deletedCardIds) { cards.delete(id); row.deleted.push(id); }
    row.payload.cards = [...cards.values()];
    if (changes.progress) row.payload.progress = changes.progress;
    if ('session' in changes) {
      if (!changes.session) row.payload.session = null;
      else {
        assert.equal('reviewCards' in changes.session, false);
        const { reviewIds, newIds, ...metadata } = changes.session;
        row.payload.session = { ...metadata, reviewCards: reviewIds.map(id => cards.get(id)), newCards: newIds.map(id => cards.get(id)) };
      }
    }
    for (const lesson of changes.lessons) {
      row.knownLessons.push(lesson.id);
      row.payload.read = lesson.read ? [...new Set([...row.payload.read, lesson.id])] : row.payload.read.filter(id => id !== lesson.id);
    }
    row.revision++; row.updated_at = new Date().toISOString();
    return { data: { conflict: false, revision: row.revision, updated_at: row.updated_at }, error: null };
  },
};
const clientPath = path.resolve(__dirname, '../src/lib/supabase.ts');
require.cache[clientPath] = { id: clientPath, filename: clientPath, loaded: true, exports: { supabase: client } };
const { useStore } = require('../src/lib/store.ts');
const { useStudyStore } = require('../src/lib/study-store.ts');
const { useLibraryProgress } = require('../src/lib/library-store.ts');
const { importGuestData, isLearningData } = require('../src/lib/learning-data.ts');
const { sessionRecord, buildLearningChanges, hasLearningChanges, sameLearningData } = require('../src/lib/learning-repository.ts');
const { startCloudSync, syncNow, snapshot, useCloudSync } = require('../src/lib/cloud-sync.ts');
async function waitFor(predicate) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  assert.fail('Timed out waiting for sync');
}
async function login(id) {
  authCallback('SIGNED_IN', { user: { id, email: `${id}@example.test` } });
  await waitFor(() => useCloudSync.getState().ready && useCloudSync.getState().user?.id === id && !useCloudSync.getState().busy);
}

test('cloud persistence, account isolation, offline recovery and concurrency', async t => {
  useStore.getState().addCard('guest', 'khách');
  const stop = startCloudSync();
  t.after(stop);
  authCallback('INITIAL_SESSION', null);
  await waitFor(() => useCloudSync.getState().ready);
  await login('alice');
  assert.equal(rows.get('alice').payload.cards[0].front, 'guest');
  assert.equal(rows.get('alice').revision, 1);
  assert.equal(rows.get('alice').payload.version, 1);
  assert.equal('password' in rows.get('alice').payload, false);
  assert.equal('openaiKey' in rows.get('alice').payload, false);

  useStore.getState().addCard('cloud', 'đám mây');
  useLibraryProgress.getState().toggle('ipa');
  useStudyStore.setState({ session: { date: '2026-10-04', step: 1, reviewCards: [], newCards: [], questions: [], reviewed: [], learned: [], answers: [], elapsed: [1, 2, 0, 0], sentences: ['', '', ''], completed: false } });
  await syncNow();
  assert.equal(rows.get('alice').payload.cards.length, 2);
  assert.deepEqual(rows.get('alice').payload.read, ['ipa']);
  assert.equal(rows.get('alice').payload.session.step, 1);
  assert.equal(rows.get('alice').revision, 2);
  const count = writes;
  await syncNow();
  assert.equal(writes, count, 'no unnecessary write for unchanged data');

  navigator.onLine = false;
  useStore.getState().addCard('offline', 'ngoại tuyến');
  await syncNow();
  assert.equal(rows.get('alice').payload.cards.length, 2);
  assert.equal(JSON.parse(storage.get('english-app-cloud-cache:alice')).data.cards.length, 3);
  navigator.onLine = true;
  failWrite = true;
  await syncNow();
  assert.match(useCloudSync.getState().error, /Network/);
  assert.equal(snapshot().cards.length, 3);
  failWrite = false;
  await syncNow();
  assert.equal(rows.get('alice').payload.cards.length, 3);

  missingTable = true;
  await syncNow();
  assert.match(useCloudSync.getState().error, /normalize_learning_sync/);
  assert.equal(snapshot().cards.length, 3, 'missing schema does not discard local learning');
  missingTable = false;
  await syncNow();

  // Re-opening an existing account keeps its unsynced cache and resumes uploads.
  navigator.onLine = false;
  useLibraryProgress.getState().toggle('offline-reload');
  authCallback('INITIAL_SESSION', { user: { id: 'alice', email: 'alice@example.test' } });
  await new Promise(resolve => setTimeout(resolve, 10));
  await waitFor(() => useCloudSync.getState().ready);
  assert.equal(snapshot().read.includes('offline-reload'), true);
  navigator.onLine = true;
  await syncNow();
  assert.equal(rows.get('alice').payload.read.includes('offline-reload'), true);

  // Remote change is applied if this device has no pending changes.
  const row = rows.get('alice'); row.revision++; row.payload.read.push('grammar');
  await syncNow();
  assert.deepEqual(snapshot().read, ['ipa', 'offline-reload', 'grammar']);

  // Both devices changed: neither silently overwrites the other.
  rows.get('alice').revision++; rows.get('alice').payload.read.push('listening');
  useLibraryProgress.getState().toggle('writing');
  const beforeConflict = writes;
  await syncNow();
  assert.equal(useCloudSync.getState().conflict, true);
  assert.equal(writes, beforeConflict);
  assert.equal(snapshot().read.includes('writing'), true);
  await syncNow('cloud');
  assert.equal(useCloudSync.getState().conflict, false);
  assert.equal(snapshot().read.includes('listening'), true);
  assert.equal(snapshot().read.includes('writing'), false);
  assert.ok([...storage.keys()].some(key => key.startsWith('english-app-cloud-backup:alice:')));

  // Changes during a write are retained and sent on the next sync.
  useLibraryProgress.getState().toggle('speaking');
  beforeWrite = () => useLibraryProgress.getState().toggle('reading');
  await syncNow();
  assert.equal(snapshot().read.includes('reading'), true);
  assert.equal(rows.get('alice').payload.read.includes('reading'), false);
  await syncNow();
  assert.equal(rows.get('alice').payload.read.includes('reading'), true);

  // A stale CAS update cannot replace the latest remote payload.
  useLibraryProgress.getState().toggle('stress');
  beforeWrite = () => { rows.get('alice').revision++; rows.get('alice').payload.read.push('remote-only'); };
  await syncNow();
  assert.equal(useCloudSync.getState().conflict, true);
  assert.equal(rows.get('alice').payload.read.includes('stress'), false);
  await syncNow('local');
  assert.equal(rows.get('alice').payload.read.includes('stress'), true);

  // A different signed-in account must not inherit Alice's cards or progress.
  await login('bob');
  assert.equal(snapshot().cards.length, 0);
  assert.equal(rows.get('bob').payload.cards.length, 0);
  useStore.getState().addCard('bob-only', 'chỉ Bob'); await syncNow();
  await login('alice');
  assert.equal(snapshot().cards.some(card => card.front === 'bob-only'), false);
  assert.equal(snapshot().cards.length, 3);
  authCallback('SIGNED_OUT', null);
  await waitFor(() => useCloudSync.getState().ready && !useCloudSync.getState().user);
  assert.deepEqual(snapshot().cards.map(card => card.front), ['guest']);
});

test('guest import remaps session references and preserves latest review', () => {
  const guest = snapshot();
  const card = guest.cards[0];
  const cloud = clone(guest); cloud.cards[0].id = 'cloud-id';
  guest.cards[0].last_review = new Date(); guest.cards[0].leitnerStage = 3;
  guest.session = { date: '2026-10-04', step: 1, reviewCards: [card], newCards: [], questions: [{ id: 'q', cardId: card.id, kind: 'reverse' }], reviewed: [card.id], learned: [], answers: [], elapsed: [0, 0, 0, 0], sentences: ['', '', ''], completed: false };
  const merged = importGuestData(cloud, guest);
  assert.equal(merged.cards.length, 1);
  assert.equal(merged.cards[0].id, 'cloud-id');
  assert.equal(merged.cards[0].leitnerStage, 3);
  assert.equal(merged.session.questions[0].cardId, 'cloud-id');
  assert.deepEqual(merged.session.reviewed, ['cloud-id']);
  assert.equal(isLearningData(merged), true);
  assert.equal(isLearningData({ version: 1, cards: [] }), false);
  assert.equal(isLearningData({ ...merged, session: { ...merged.session, step: 99 } }), false);
  assert.equal(isLearningData({ ...merged, cards: [null] }), false);
});

test('10,000 cards: one changed word sends one SQL row, metadata sends no vocabulary', () => {
  const source = snapshot().cards[0];
  const base = { ...empty(), cards: Array.from({ length: 10000 }, (_, index) => ({ ...source, id: `word-${index}`, front: `word ${index}` })) };
  const next = clone(base); next.cards[5000].backEn = 'Only this word changed';
  const changes = buildLearningChanges(base, next);
  assert.equal(changes.cards.length, 1);
  assert.equal(changes.cards[0].id, 'word-5000');
  assert.equal(changes.progress, undefined);
  assert.equal(changes.session, undefined);
  assert.equal(JSON.stringify(changes).length < 1000, true);
  const metadata = { ...base, read: ['ipa'] };
  assert.equal(buildLearningChanges(base, metadata).cards.length, 0);
  assert.deepEqual(buildLearningChanges(base, metadata).lessons, [{ id: 'ipa', read: true }]);
  assert.equal(hasLearningChanges(buildLearningChanges(base, clone(base))), false);
  assert.equal(sameLearningData(base, { ...base, cards: [...base.cards].reverse() }), true);
  const latestWrite = requests.filter(request => request.name === 'save_learning_changes').at(-1);
  assert.equal('payload' in latestWrite.parameters, false);
});
