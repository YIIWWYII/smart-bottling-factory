import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAssistantWorkflowRun,
  assistantScenarioTemplate,
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

test('custom scenario steps, tasks, tools, template variables and confirmation are reflected in the run', () => {
  const entry = {
    number: 3, prompt: '核对设备', answer: '正在检查 {设备}', kind: 'device-command', needsConfirmation: true,
    workflow: {
      title: '自定义检查',
      steps: [['读取', '{设备} 已读取'], ['判断', '结果正常']],
      tasks: [['查询状态'], ['整理建议']],
      tools: [['状态工具', '收到 {设备} 状态'], ['建议工具', '已生成建议']],
      confirmation: { title: '{设备}待确认', before: '运行中', value: '暂停设备', reason: '现场确认' },
    },
  };
  const run = createAssistantWorkflowRun({ text: '3', entry, route: 'station', target: '机械臂', selectedTarget: '机械臂' });
  assert.equal(run.scenario.title, '自定义检查');
  assert.deepEqual(run.scenario.steps[0], ['读取', '机械臂 已读取']);
  assert.deepEqual(run.tasks.slice(0, 2).map(task => task.title), ['查询状态', '整理建议']);
  assert.equal(run.toolCalls[0].name, '状态工具');
  assert.equal(run.toolCalls[0].result, '收到 机械臂 状态');
  assert.equal(run.confirmation.title, '机械臂待确认');
  assert.equal(run.confirmation.reason, '现场确认');
  assert.equal(run.answer, '正在检查 机械臂');
});

test('a custom scenario can intentionally contain no optional stages', () => {
  const entry = { number: 1, prompt: '简答', answer: '完成', kind: 'general', needsConfirmation: false,
    workflow: { ...assistantScenarioTemplate({ number: 1, kind: 'general' }), title: '简答', steps: [], tasks: [], tools: [] } };
  const run = createAssistantWorkflowRun({ text: '1', entry, route: 'station' });
  assert.deepEqual(run.scenario.steps, []);
  assert.deepEqual(run.tasks, []);
  assert.deepEqual(run.toolCalls, []);
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
