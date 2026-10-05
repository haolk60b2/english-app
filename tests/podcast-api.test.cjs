const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);

function route(name, client) {
  const output = ts.transpileModule(fs.readFileSync(`src/app/api/ai/${name}/route.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(output, { exports, File, require: name => {
    if (name === '@/lib/openai') return { getOpenAIClient: () => client, getChatModel: () => 'configured-model' };
    if (name === '@/lib/podcast-import') return require('../src/lib/podcast-import.ts');
    return require(name);
  } });
  return exports.POST;
}
const request = data => new Request('http://localhost/api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
function audio(file = new File(['audio'], 'test.mp3')) { const form = new FormData(); form.append('audio', file); return new Request('http://localhost/api', { method: 'POST', body: form }); }

test('lesson API rejects invalid input and invalid AI answers instead of generating demo results', async () => {
  assert.equal((await route('podcast-lesson', null)(request({ lines: [{ text: 'Hi.' }], level: 'A2' }))).status, 400);
  assert.equal((await route('podcast-lesson', null)(request({ lines: [{ text: 'I drink tea.' }, { text: 'I walk.' }], level: 'A2' }))).status, 401);
  const client = { chat: { completions: { create: async () => ({ choices: [{ message: { content: JSON.stringify({ title: 'Tea', goal: 'Learn.', task: 'Speak.', translations: ['Trà.', 'Đi bộ.'], vocabulary: [], questions: Array.from({ length: 3 }, () => ({ prompt: 'Drink?', options: ['Tea', 'Coffee'], answer: 4, explanation: 'Tea.', evidenceIndex: 0 })) }) } }] }) } } };
  const response = await route('podcast-lesson', client)(request({ lines: [{ text: 'I drink tea.' }, { text: 'I walk.' }], level: 'A2' }));
  assert.equal(response.status, 502);
  assert.equal((await response.json()).material, undefined);
});
test('transcription preserves provider timestamps and falls back explicitly to untimed real text', async () => {
  const timed = { audio: { transcriptions: { create: async () => ({ text: 'I drink tea. I walk.', segments: [{ text: 'I drink tea.', start: 0, end: 2 }, { text: 'I walk.', start: 2, end: 4 }] }) } } };
  const response = await route('podcast-transcribe', timed)(audio());
  const data = await response.json();
  assert.equal(response.status, 200); assert.equal(data.timed, true); assert.equal(data.lines[1].start, 2);
  const models = [];
  const fallback = { audio: { transcriptions: { create: async args => { models.push(args.model); if (args.model === 'whisper-1') throw new Error('unavailable'); return { text: 'I drink tea. I walk.' }; } } } };
  const plain = await (await route('podcast-transcribe', fallback)(audio())).json();
  assert.equal(plain.timed, false); assert.equal(plain.lines[0].start, undefined); assert.deepEqual(models, ['whisper-1', 'gpt-4o-mini-transcribe']);
  const unavailable = { audio: { transcriptions: { create: async () => { throw new Error('unavailable'); } } } };
  const failed = await route('podcast-transcribe', unavailable)(audio());
  assert.equal(failed.status, 502); assert.equal((await failed.json()).transcript, undefined);
});
test('transcription refuses large files and unsupported formats before contacting AI', async () => {
  const client = { audio: { transcriptions: { create: () => { throw new Error('must not be called'); } } } };
  assert.equal((await route('podcast-transcribe', client)(audio(new File([new Uint8Array(4 * 1024 * 1024 + 1)], 'large.mp3')))).status, 413);
  assert.equal((await route('podcast-transcribe', client)(audio(new File(['text'], 'text.txt')))).status, 400);
});
