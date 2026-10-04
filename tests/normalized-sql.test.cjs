// PGLITE_MODULE can point to a temporary install; the app does not depend on it.
// node --test --test-isolation=none tests/normalized-sql.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const { createEmptyCard } = require('ts-fsrs');
const alice = '00000000-0000-0000-0000-000000000001';
const bob = '00000000-0000-0000-0000-000000000002';
const card = (id, front) => ({ ...createEmptyCard(new Date('2026-10-04T12:00:00Z')), id, front, back: 'nghĩa tiếng Việt', backEn: 'English definition', backVi: 'nghĩa tiếng Việt', exampleVi: 'câu ví dụ', level: 'B1', tags: ['noun'], leitnerStage: 1, createdAt: '2026-10-04T12:00:00.000Z' });
const progress = { streak: 1, lastStudyDate: '2026-10-04', totalReviews: 1, xp: 10, level: 1, dailyGoal: 20, lastDailyGen: null };
const aCards = [card('a1', 'first'), card('a2', 'second')];
const session = { date: '2026-10-04', step: 1, reviewCards: [aCards[0]], newCards: [aCards[1]], questions: [{ id: 'q1', cardId: 'a1', kind: 'reverse' }], reviewed: [], learned: [], answers: [], elapsed: [1, 2, 0, 0], sentences: ['', '', ''], completed: false };
const original = { version: 1, cards: aCards, progress, session, read: ['ipa'] };

test('migration preserves snapshots, normalizes cards and enforces incremental RPC + RLS', async t => {
  const db = new PGlite(); t.after(() => db.close());
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key, created_at timestamptz default now());
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth,public to anon,authenticated;
    insert into auth.users(id) values('${alice}'),('${bob}');`);
  const sql = file => fs.readFileSync(path.resolve(__dirname, '../supabase', file), 'utf8');
  await db.exec(sql('schema.sql'));
  await db.exec(sql('migrations/20261004_learning_sync.sql'));
  await db.query('insert into public.learning_data(user_id,payload) values($1,$2),($3,$4)', [alice, JSON.stringify(original), bob, JSON.stringify({ ...original, cards: [card('b1', 'bob-only')], session: null, read: [] })]);
  const migration = sql('migrations/20261004170328_normalize_learning_sync.sql');
  await db.exec(migration);
  assert.equal((await db.query('select count(*)::integer as n from public.cards')).rows[0].n, 3);
  assert.deepEqual((await db.query('select payload from public.learning_data where user_id=$1', [alice])).rows[0].payload, JSON.parse(JSON.stringify(original)));
  assert.equal((await db.query('select session_data from public.study_sessions where user_id=$1', [alice])).rows[0].session_data.reviewCards, undefined);

  const asUser = async id => {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
    await db.exec('set role authenticated');
  };
  const read = async revision => (await db.query('select public.get_learning_changes($1) as data', [revision])).rows[0].data;
  const save = async (revision, changes) => (await db.query('select public.save_learning_changes($1,$2) as data', [revision, JSON.stringify(changes)])).rows[0].data;
  await asUser(alice);
  const first = await read(0);
  assert.equal(first.revision, 1); assert.equal(first.cards.length, 2);
  assert.deepEqual(first.cards.map(card => card.client_id).sort(), ['a1', 'a2']);
  assert.equal(first.cards[0].back_en, 'English definition');
  assert.equal(first.progress.xp, 10);
  assert.deepEqual(first.session.reviewIds, ['a1']);
  const idle = await read(1);
  assert.deepEqual(idle.cards, []); assert.equal(idle.progress, null); assert.equal(idle.session, null);

  const updated = { ...aCards[0], front: 'updated', leitnerStage: 2 };
  const result = await save(1, { cards: [updated], deletedCardIds: [], progress: { ...progress, xp: 20 }, lessons: [] });
  assert.equal(result.conflict, false); assert.equal(result.revision, 2);
  const delta = await read(1);
  assert.equal(delta.cards.length, 1); assert.equal(delta.cards[0].front, 'updated');
  assert.equal(delta.progress.xp, 20);
  assert.equal(delta.cards[0].id, first.cards.find(card => card.client_id === 'a1').id, 'database UUID remains stable');
  const stale = await save(1, { cards: [{ ...updated, front: 'stale' }], lessons: [] });
  assert.equal(stale.conflict, true);
  assert.equal((await read(0)).cards.find(card => card.client_id === 'a1').front, 'updated');

  await assert.rejects(save(2, { cards: [card('invalid-batch', 'temporary')], progress: { ...progress, xp: 'invalid' }, lessons: [] }));
  assert.equal((await read(0)).revision, 2, 'entire batch rolls back on invalid progress');
  assert.equal((await read(0)).cards.some(card => card.client_id === 'invalid-batch'), false);
  await assert.rejects(db.query('insert into public.library_progress(user_id,lesson_id) values($1,$2)', [bob, 'not-yours']), /row-level security/i);
  await assert.rejects(db.query('update public.cards set user_id=$1 where client_id=$2', [bob, 'a1']), /row-level security/i);
  await assert.rejects(db.exec("update public.learning_data set payload='{}'"), /permission denied/i);
  await asUser(bob);
  assert.deepEqual((await read(0)).cards.map(card => card.client_id), ['b1']);

  await asUser(alice);
  await save(2, { cards: [], deletedCardIds: ['a1'], lessons: [{ id: 'ipa', read: false }] });
  const removed = await read(2);
  assert.equal(removed.cards.length, 1); assert.ok(removed.cards[0].deleted_at);
  assert.equal(removed.lessons[0].is_read, false);
  const nextSession = { ...first.session, date: '2026-10-05', reviewIds: [], newIds: ['a2'], questions: [] };
  await save(3, { cards: [], deletedCardIds: [], lessons: [], session: nextSession });
  assert.equal((await read(3)).session.date, '2026-10-05');
  assert.equal((await db.query('select count(*)::integer as n from public.study_sessions')).rows[0].n, 2, 'old sessions are retained');

  await db.exec('reset role');
  await db.exec(migration);
  assert.equal((await db.query("select front from public.cards where user_id=$1 and client_id='a1'", [alice])).rows[0].front, 'updated', 'migration rerun cannot overwrite newer cards with backup');
  assert.deepEqual((await db.query('select payload from public.learning_data where user_id=$1', [alice])).rows[0].payload, JSON.parse(JSON.stringify(original)));
  await db.exec(sql('verify-learning-sync.sql'));
  assert.equal((await db.query("select count(*)::integer as n from public.cards where client_id='_verify_sync_'")).rows[0].n, 0);
  await db.exec('set role anon');
  await assert.rejects(db.exec('select * from public.cards'), /permission denied/i);
  await assert.rejects(db.query('select public.get_learning_changes(0)'), /permission denied/i);
});
