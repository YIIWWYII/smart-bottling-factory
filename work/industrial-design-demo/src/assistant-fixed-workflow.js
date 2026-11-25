import demoQuestionData from '../config/demo-questions.json' with { type: 'json' };

export const assistantQuestionsKey = 'hongmou-assistant-fixed-questions-v1';
export const assistantRunsKey = 'hongmou-assistant-workflow-runs-v1';
const defaultScenarios = ['general', 'industrial', 'industrial', 'point-select', 'alarm-report', 'alarm-report', 'device-command', 'bottle-match', 'alarm-report', 'point-select'];
export const assistantScenarioOptions = [
  ['general', '通用问题'], ['industrial', '工业问题'], ['point-select', '点选设备'],
  ['alarm-report', '告警报告'], ['device-command', '设备操作确认'], ['bottle-match', '瓶型与轨迹'],
];

export function getDefaultAssistantQuestions() {
  const entries = demoQuestionData.questions.map((item, index) => ({
    id: `question-${index + 1}`,
    number: index + 1,
    prompt: item.questions?.[0] || `问题${index + 1}`,
    answer: item.answer || '',
    needsConfirmation: false,
  }));
  entries.push({
    id: 'question-7',
    number: 7,
    prompt: '调整设备参数并提交',
    answer: '已生成一项待确认操作，请核对变更信息后选择确认或取消。',
    needsConfirmation: true,
  });
  entries.push({ id: 'question-8', number: 8, prompt: '识别瓶型并核对轨迹', answer: '请查看瓶型与轨迹匹配链条：匹配时执行，不匹配时等待人工确认换轨迹。', needsConfirmation: true });
  entries.push({ id: 'question-9', number: 9, prompt: '读取告警并生成分析报告', answer: '已读取平台告警快照，生成原因、影响和处置建议报告，并写入 AI 记录。', needsConfirmation: false });
  entries.push({ id: 'question-10', number: 10, prompt: '回答当前点选设备', answer: '已读取当前点选设备的状态、指标和数据来源，返回固定设备说明。', needsConfirmation: false });
  return entries.map((item, index) => {
    const configured = { ...item, kind: defaultScenarios[index], needsConfirmation: item.needsConfirmation || ['device-command', 'bottle-match'].includes(defaultScenarios[index]) };
    return { ...configured, workflow: assistantScenarioTemplate(configured) };
  });
}

export function readAssistantQuestions() {
  try {
    const stored = JSON.parse(localStorage.getItem(assistantQuestionsKey) || 'null');
    if (Array.isArray(stored) && stored.length) {
      const defaults = getDefaultAssistantQuestions();
      const entries = stored
        .filter(item => item && typeof item.prompt === 'string' && typeof item.answer === 'string')
        .map((item, index) => ({
          ...item,
          id: `question-${index + 1}`,
          number: index + 1,
          needsConfirmation: Boolean(item.needsConfirmation),
          kind: assistantScenarioOptions.some(([kind]) => kind === item.kind) ? item.kind : defaults.find(preset => preset.prompt === item.prompt)?.kind || 'general',
        }));
      if (entries.length) return entries.map(item => ({ ...item, workflow: readScenarioWorkflow(item) }));
    }
  } catch {}
  return getDefaultAssistantQuestions();
}

export function readAssistantRuns() {
  try {
    const stored = JSON.parse(localStorage.getItem(assistantRunsKey) || '[]');
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

export function resolveAssistantQuestion(text, entries) {
  const raw = String(text || '');
  const leadingSpaces = raw.match(/^[ \u3000]+/)?.[0].length;
  const prefix = raw.match(/^(\d+)(?=$|\s)/)?.[1];
  const number = leadingSpaces ?? (prefix === undefined ? null : Number(prefix));
  return { number, entry: entries.find(item => Number(item.number) === number) || null };
}


function scenarioDetails(kind, target) {
  const details = {
    'bottle-match': { title: '瓶型与轨迹匹配', steps: [['识别瓶型', '怡宝'], ['核对轨迹', '怡宝轨迹，匹配'], ['模拟人工换品', '当前轨迹切换为可乐'], ['再次核对', '怡宝瓶型与可乐轨迹不匹配，建议切换回怡宝轨迹']] },
    'alarm-report': { title: '告警分析报告', steps: [['整理告警案例', '按工位和告警类型归类'], ['梳理排查项', '核对阈值、趋势和关联设备'], ['整理处置建议', '已生成报告内容']] },
    'device-command': { title: '设备操作二次确认', steps: [['整理操作上下文', target || '未点选设备'], ['生成操作建议', '已准备变更建议']] },
    'point-select': { title: '点选设备问答', steps: [['读取点选对象', target || '未点选设备，使用预设问题'], ['匹配设备说明', '已选中预设说明']] },
    industrial: { title: '工业知识问答', steps: [['匹配工艺资料', '已选中预设知识条目']] },
    general: { title: '通用问题问答', steps: [] },
  };
  return details[kind] || details.general;
}

export function assistantScenarioTemplate(entry, selectedTarget = '{设备}') {
  const scenarioKind = entry.kind || 'general';
  const scenario = scenarioDetails(scenarioKind, selectedTarget);
  const confirmation = {
    title: '问题{编号} · 待确认操作',
    before: '未提交',
    value: '等待人工确认',
    reason: scenarioKind === 'bottle-match' ? '当前轨迹与识别瓶型不一致。本卡只记录人工换品确认，不向设备发送真实指令。' : '本卡只记录确认或取消结果，不向设备发送指令。',
  };
  return {
    title: scenario.title,
    steps: scenario.steps,
    tasks: [['接收用户问题'], ['解析序号并选择场景 {编号}'], ...scenario.steps.map(([title]) => [title]), ['整理回复']],
    tools: [['会话入口', '已创建本次任务记录'], ['问题序号路由', '问题{编号} · {场景}'], ...scenario.steps, ['问答节点', '已读取对应答复']],
    confirmation,
  };
}

function readScenarioWorkflow(entry) {
  const fallback = assistantScenarioTemplate(entry);
  const workflow = entry.workflow;
  if (!workflow) return fallback;
  const rows = (key, width) => Array.isArray(workflow[key])
    ? workflow[key].filter(row => Array.isArray(row) && typeof row[0] === 'string' && row[0].trim())
      .map(row => Array.from({ length: width }, (_, index) => typeof row[index] === 'string' ? row[index] : ''))
    : fallback[key];
  return {
    title: typeof workflow.title === 'string' ? workflow.title : fallback.title,
    steps: rows('steps', 2), tasks: rows('tasks', 1), tools: rows('tools', 2),
    confirmation: Object.fromEntries(Object.entries(fallback.confirmation).map(([key, value]) => [key,
      typeof workflow.confirmation?.[key] === 'string' ? workflow.confirmation[key] : value,
    ])),
  };
}

export function createAssistantWorkflowRun({ text, entry, route, target, selectedTarget }) {
  const id = globalThis.crypto?.randomUUID?.() || `run-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const createdAt = new Date().toISOString();
  const scenarioKind = entry.kind || 'general';
  const workflow = entry.workflow || assistantScenarioTemplate(entry, selectedTarget || '');
  const variables = { '设备': selectedTarget || '未点选设备', '编号': entry.number, '场景': entry.prompt };
  const fill = (text = '') => text.replace(/\{(设备|编号|场景)\}/g, (_, name) => variables[name]);
  const confirmation = entry.needsConfirmation ? {
    ...Object.fromEntries(Object.entries(workflow.confirmation).map(([key, value]) => [key, fill(value)])),
    id: `${id}-confirmation`,
    status: 'pending',
  } : null;
  const tasks = [
    ...workflow.tasks.map(([title], index) => ({ id: `task-${index}`, title: fill(title), status: 'completed' })),
    ...(confirmation ? [{ id: 'confirm', title: '等待人工二次确认', status: 'waiting' }] : []),
  ];
  const toolCalls = [
    ...workflow.tools.map(([name, result], index) => ({ id: `tool-${index}`, name: fill(name), result: fill(result), status: 'success' })),
    ...(confirmation ? [{ id: 'confirm-card', name: '人工确认节点', result: '确认卡已生成，等待选择', status: 'waiting' }] : []),
  ];
  return {
    id,
    createdAt,
    input: text,
    number: entry.number,
    prompt: entry.prompt,
    answer: fill(entry.answer),
    route,
    target: target || '',
    tasks,
    toolCalls,
    confirmation,
    scenario: { kind: scenarioKind, title: fill(workflow.title), steps: workflow.steps.map(([name, result]) => [fill(name), fill(result)]) },
    status: confirmation ? 'waiting' : 'completed',
  };
}

export function assistantWorkflowStages(run) {
  return Math.max(
    run.tasks.filter(task => task.status === 'completed').length,
    run.toolCalls.filter(tool => tool.status !== 'waiting').length,
    run.scenario?.steps?.length || 0,
  );
}
