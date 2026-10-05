const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

// Exercise audio events without opening or controlling a browser/microphone.
function harness(lines) {
  const slots = [];
  const cleanups = [];
  const spoken = [];
  let cursor = 0;
  let cancellations = 0;
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { current: initial };
      return slots[index];
    },
    useEffect(effect) {
      const index = cursor++;
      if (!(index in slots)) { slots[index] = true; cleanups.push(effect()); }
    },
  };
  const synth = {
    getVoices: () => [], addEventListener() {}, removeEventListener() {}, pause() {}, resume() {},
    cancel() { cancellations++; }, speak(utterance) { spoken.push(utterance); },
  };
  const output = ts.transpileModule(fs.readFileSync('src/components/SentenceAudio.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(output, {
    exports, require: name => name === 'react' ? react : require(name), window: { speechSynthesis: synth },
    SpeechSynthesisUtterance: class { constructor(text) { this.text = text; } },
  });
  function render() { cursor = 0; return exports.default({ lines }); }
  function elements(node, predicate) {
    if (!node || typeof node !== 'object') return [];
    if (Array.isArray(node)) return node.flatMap(item => elements(item, predicate));
    return [...(predicate(node) ? [node] : []), ...elements(node.props?.children, predicate)];
  }
  const button = name => elements(render(), node => node.type === 'button' && node.props.children === name)[0];
  return {
    spoken, button, get cancellations() { return cancellations; },
    toggleRepeat() { elements(render(), node => node.type === 'input' && node.props.type === 'checkbox')[0].props.onChange({ target: { checked: true } }); },
    unmount() { for (const cleanup of cleanups) cleanup?.(); },
  };
}

test('plays complete text, advances only on audio end and cancels stale callbacks', () => {
  const paragraph = 'A complete sentence. '.repeat(60); // Longer than the old 800-character cutoff.
  const player = harness([paragraph, 'The final sentence.']);
  player.button('▶ Nghe bài').props.onClick();
  assert.equal(player.spoken.length, 1);
  assert.equal(player.spoken[0].text, paragraph);
  player.spoken[0].onend();
  assert.equal(player.spoken[1].text, 'The final sentence.');
  player.button('Dừng').props.onClick();
  player.spoken[1].onend();
  assert.equal(player.spoken.length, 2, 'stopping must not queue more audio');
  player.button('▶ Nghe bài').props.onClick();
  assert.equal(player.spoken[2].text, paragraph);
  player.unmount();
  player.spoken[2].onend();
  assert.equal(player.spoken.length, 3, 'leaving a lesson must not restart its audio');
  assert.ok(player.cancellations >= 3);
});

test('repeats the selected sentence and changing sentences ignores previous events', () => {
  const player = harness(['First sentence.', 'Second sentence.']);
  player.toggleRepeat();
  player.button('▶ Nghe bài').props.onClick();
  const first = player.spoken[0];
  first.onend();
  assert.equal(player.spoken[1].text, 'First sentence.');
  player.button('Câu sau →').props.onClick();
  assert.equal(player.spoken[2].text, 'Second sentence.');
  first.onend();
  assert.equal(player.spoken.length, 3, 'previous playback generation cannot advance the new one');
  player.spoken[2].onend();
  assert.equal(player.spoken[3].text, 'Second sentence.');
  player.unmount();
});
