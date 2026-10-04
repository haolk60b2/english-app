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
const rows = new Map();
const clone = value => JSON.parse(JSON.stringify(value));
const client = {
  auth: { onAuthStateChange(callback) { authCallback = callback; return { data: { subscription: { unsubscribe() {} } } }; } },
  from(table) {
    assert.equal(table, 'learning_data');
    const query = { operation: 'read', filters: {}, values: null,
      select() { return this; }, eq(key, value) { this.filters[key] = value; return this; },
      update(values) { this.operation = 'update'; this.values = values; return this; },
      insert(values) { this.operation = 'insert'; this.values = values; return this; },
      single() { return this.maybeSingle(); },
      async maybeSingle() {
        const id = this.values?.user_id || this.filters.user_id;
        if (this.operation === 'read') {
          if (missingTable) return { data: null, error: { message: 'Could not find table learning_data in schema cache' } };
          return { data: rows.has(id) ? clone(rows.get(id)) : null, error: null };
        }
        if (beforeWrite) { const callback = beforeWrite; beforeWrite = null; callback(); }
        if (failWrite) return { data: null, error: { message: 'Network request failed' } };
        const row = rows.get(id);
        if (this.operation === 'insert' && row) return { data: null, error: { code: '23505' } };
        if (this.operation === 'update' && row?.revision !== this.filters.revision) return { data: null, error: null };
        writes++; rows.set(id, clone(this.values));
        return { data: { revision: this.values.revision }, error: null };
      },
    };
    return query;
  },
};
const clientPath = path.resolve(__dirname, '../src/lib/supabase.ts');
require.cache[clientPath] = { id: clientPath, filename: clientPath, loaded: true, exports: { supabase: client } };
const { useStore } = require('../src/lib/store.ts');
const { useStudyStore } = require('../src/lib/study-store.ts');
const { useLibraryProgress } = require('../src/lib/library-store.ts');
const { importGuestData, isLearningData } = require('../src/lib/learning-data.ts');
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
  assert.match(useCloudSync.getState().error, /20261004_learning_sync.sql/);
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
