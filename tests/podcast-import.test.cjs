const test = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
const { sourceLines, validateSource, makeImportedMaterial, gradeDictation } = require('../src/lib/podcast-import.ts');

test('AI output cannot rewrite original words/timestamps or add ungrounded vocabulary', () => {
  const lines = [{ text: 'I drink tea.', start: 1, end: 3 }, { text: 'I walk to work.', start: 4, end: 6 }];
  const data = { title: 'My morning', goal: 'Hiểu lịch sinh hoạt.', task: 'Nói về buổi sáng.', translations: ['Tôi uống trà.', 'Tôi đi bộ đến chỗ làm.'], vocabulary: [{ word: 'tea', meaning: 'trà', example: 'Would you like tea?' }],
    questions: Array.from({ length: 3 }, () => ({ prompt: 'What does the speaker drink?', options: ['Tea', 'Coffee', 'Water'], answer: 0, evidenceIndex: 0, explanation: 'Câu đầu nói tea.' })), lines: [{ text: 'I drink coffee.' }] };
  const material = makeImportedMaterial(data, lines, 'A2');
  assert.deepEqual(material.lines[0], { ...lines[0], vi: 'Tôi uống trà.' });
  assert.throws(() => makeImportedMaterial({ ...data, translations: [] }, lines, 'A2'));
  assert.throws(() => makeImportedMaterial({ ...data, vocabulary: [{ word: 'coffee', meaning: 'cà phê', example: 'I drink coffee.' }] }, lines, 'A2'));
  assert.throws(() => makeImportedMaterial({ ...data, questions: data.questions.map(q => ({ ...q, evidenceIndex: 99 })) }, lines, 'A2'));
  assert.throws(() => makeImportedMaterial({ ...data, questions: data.questions.map(q => ({ ...q, answer: -1 })) }, lines, 'A2'));
});
test('source parsing preserves full text, rejects invalid timestamps and oversized lessons', () => {
  assert.deepEqual(sourceLines('I drink tea. I walk to work.').map(line => line.text), ['I drink tea.', 'I walk to work.']);
  assert.throws(() => sourceLines('x'.repeat(12001)));
  assert.throws(() => validateSource([{ text: 'A', start: 4, end: 3 }, { text: 'B' }]));
  assert.throws(() => validateSource([{ text: 'A', start: 4, end: 6 }, { text: 'B', start: 2, end: 3 }]));
  assert.throws(() => validateSource(Array.from({ length: 61 }, () => ({ text: 'Hello.' }))));
});
test('dictation grades missing/extra/reordered words and common contractions fairly', () => {
  assert.equal(gradeDictation('I am ready.', 'i AM ready!').score, 100);
  assert.equal(gradeDictation('I cannot go.', 'I can’t go').score, 100);
  assert.equal(gradeDictation('I do not know.', "I don't know").score, 100);
  const missing = gradeDictation('I drink hot tea.', 'I drink tea');
  assert.equal(missing.score, 75);
  assert.deepEqual(missing.words.filter(word => !word.correct).map(word => word.word), ['hot']);
  assert.deepEqual(gradeDictation('I drink tea.', 'I drink hot tea').extra, ['hot']);
  assert.ok(gradeDictation('I walk to work.', 'work to walk I').score < 100);
  assert.ok(gradeDictation('I drink tea.', 'I I I I drink tea').score < 100);
  assert.equal(gradeDictation('I drink tea.', '').score, 0);
});
