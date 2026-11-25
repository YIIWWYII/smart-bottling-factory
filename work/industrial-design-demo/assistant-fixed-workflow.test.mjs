import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAssistantWorkflowRun,
  getDefaultAssistantQuestions,
  readAssistantQuestions,
  resolveAssistantQuestion,
} from './src/assistant-fixed-workflow.js';

test('question routing accepts a bare number or a leading number followed by question text', () => {
  const entries = getDefaultAssistantQuestions();
  const result = resolveAssistantQuestion('2 请问完全不同的内容', entries);
  assert.equal(result.number, 2);
  assert.equal(result.entry, entries[1]);
  assert.equal(resolveAssistantQuestion('2', entries).entry, entries[1]);
});

test('question routing requires a number or spaces at the start', () => {
  const entries = Array.from({ length: 23 }, (_, index) => ({ number: index + 1 }));
  assert.equal(resolveAssistantQuestion('12', entries).entry.number, 12);
  for (const text of ['问题1', '问题二十三 随便问', '#2 随便问', '没有序号的提问']) {
    assert.deepEqual(resolveAssistantQuestion(text, entries), { number: null, entry: null });
  }
});

test('leading spaces select a question, including a spaces-only selector', () => {
  const entries = getDefaultAssistantQuestions();
  assert.equal(resolveAssistantQuestion('  随便问一句', entries).number, 2);
  assert.equal(resolveAssistantQuestion('   随便问一句', entries).number, 3);
  assert.equal(resolveAssistantQuestion('  ', entries).number, 2);
  assert.equal(resolveAssistantQuestion('  1 随便问一句', entries).number, 2);
});

test('an unmapped number stays explicit instead of silently answering another question', () => {
  const result = resolveAssistantQuestion('99', getDefaultAssistantQuestions());
  assert.equal(result.number, 99);
  assert.equal(result.entry, null);
});

test('workflow records include the fixed answer, task list, tool calls and optional confirmation', () => {
  const entry = getDefaultAssistantQuestions().find(item => item.needsConfirmation);
  const run = createAssistantWorkflowRun({ text: '7 调整设备参数', entry, route: 'station', target: '机械臂' });
  assert.equal(run.answer, entry.answer);
  assert.equal(run.scenario.kind, 'device-command');
  assert.ok(run.tasks.slice(0, -1).every(task => task.status === 'completed'));
  assert.equal(run.tasks.at(-1).status, 'waiting');
  assert.equal(run.toolCalls.at(-1).name, '人工确认节点');
  assert.equal(run.confirmation.status, 'pending');
});

test('the selected question determines the answer, workflow and confirmation independently of wording and page', () => {
  const entries = getDefaultAssistantQuestions();
  for (const preset of entries) {
    const answer = `自定义答复 ${preset.number}`;
    const configured = entries.map(item => item === preset ? { ...item, answer } : item);
    for (const text of [String(preset.number), `${' '.repeat(preset.number)}更换轨迹`]) {
      const { entry } = resolveAssistantQuestion(text, configured);
      const run = createAssistantWorkflowRun({ text, entry, route: 'station', target: '告警页面' });
      assert.equal(run.number, preset.number);
      assert.equal(run.answer, answer);
      assert.equal(run.scenario.kind, preset.kind);
      assert.equal(Boolean(run.confirmation), preset.needsConfirmation);
    }
  }
});

test('saved question settings preserve reply content and confirmation flag', () => {
  const original = globalThis.localStorage;
  const values = new Map();
  globalThis.localStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  try {
    const configured = [{ number: 40, prompt: '测试问题', answer: '固定回复', needsConfirmation: true }];
    values.set('hongmou-assistant-fixed-questions-v1', JSON.stringify(configured));
    const [entry] = readAssistantQuestions();
    assert.equal(entry.number, 1);
    assert.equal(entry.prompt, '测试问题');
    assert.equal(entry.answer, '固定回复');
    assert.equal(entry.needsConfirmation, true);
  } finally {
    if (original === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = original;
  }
});
