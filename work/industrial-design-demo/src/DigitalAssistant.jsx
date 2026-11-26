import { selectAssistantObject, describeAssistantObject } from './assistantSelection';
import './assistant-operations.css';
import { useEffect, useId, useRef, useState } from 'react';
import { animate } from 'animejs';
import { api, recordEvent, useTwin } from './TwinState';
import { ReportText } from './ui';
import AssistantPetPanel from './AssistantPetPanel';
import { localVoices, speechChunks, voicePreviewText } from './assistant-voices.js';
import { petActions, petDisplayDefaults, petLevel, petReward, petSizeRange, petStorageKey, readPet, updatePet } from './assistant-pet';
import {
  ArrowLeft, ArrowUp, Bell, Bot, Check, ChevronDown, ChevronRight, ChevronUp, Clock3, ListChecks, MessageSquare,
  Coins, Mic, MousePointer2, MoveDiagonal, PanelLeft, Pause, Play, Plus, RotateCcw, Settings2, ShoppingBag, Sparkles, Square,
  SquarePen, Trash2, Volume2, Wrench, X,
} from 'lucide-react';
import {
  assistantQuestionsKey, assistantRunsKey, assistantScenarioOptions, assistantScenarioTemplate, assistantWorkflowStages, createAssistantWorkflowRun,
  readAssistantQuestions, readAssistantRuns, resolveAssistantQuestion,
} from './assistant-fixed-workflow';

const MAX_RUNS = 80;
const autoSpeakKey = 'hongmou-assistant-auto-speak';
const speechVoiceKey = 'hongmou-assistant-speech-voice';
const speechRateKey = 'hongmou-assistant-speech-rate';
const speechVolumeKey = 'hongmou-assistant-speech-volume';
const savedNumber = (key, min, max, fallback) => {
  try {
    const value = Number(localStorage.getItem(key) ?? fallback);
    if (value >= min && value <= max) return value;
  } catch {}
  return fallback;
};
const voiceId = (voice) => voice.voiceURI || voice.name;
const isChineseVoice = (voice) => /zh|cmn|chinese|中文|普通话/i.test(`${voice.lang} ${voice.name}`);
const voiceRank = (voice) => {
  if (/natural|neural|online|xiaoxiao|xiaoyi|yunxi|yunjian|晓晓|晓伊|云希|云健/i.test(voice.name)) return 0;
  if (/huihui|yaoyao|kangkang|tingting|慧慧|瑶瑶|康康|婷婷/i.test(voice.name)) return 1;
  return 2;
};
const voiceLabel = (voice) => voice.name
  .replace(/^Microsoft\s+/i, '')
  .replace(/\s*-\s*Chinese.*$/i, '')
  .replace(/\s+Online\b/i, '')
  .replace(/\s*\(Natural\)/i, ' · 自然')
  .replace(/\s*\(.*?\)\s*$/, '')
  .trim() || voice.name;
const availableSpeechVoices = (synth) => {
  let voices;
  try { voices = Array.from(synth?.getVoices() ?? []); } catch { voices = []; }
  const chinese = voices.filter(isChineseVoice);
  return chinese.length ? chinese.sort((a, b) => voiceRank(a) - voiceRank(b)) : voices;
};
const voicePreview = { id: 'voice-preview', answer: voicePreviewText };
const fontSizeKey = 'hongmou-assistant-font-size';
const interfaceScaleKey = 'hongmou-assistant-interface-scale';
const minFontSize = 12;
const maxFontSize = 56;
const defaultFontSize = 16;
const activeConversationKey = 'hongmou-assistant-active-conversation';
const conversationOf = (run) => run.conversationId || 'initial';
const interfaceScaleRange = { min: 75, max: 150, default: 100 };
const alarmModes = { simulation: '模拟数据', real: '真实数据', mixed: '混合数据' };
const reportStatuses = { pending: '等待分析', analyzing: '正在分析', completed: '报告已生成', failed: '分析未完成' };

const robotStates = { idle: '待机', listening: '正在聆听', thinking: '正在处理', speaking: '正在播报', paused: '播报已暂停', alarm: '收到新告警' };

function AssistantRobot({ state = 'idle', size = 32, motion = true, follow = false, idle = true, gesture, gear, outfit }) {
  const root = useRef(null);
  const id = useId();
  useEffect(() => {
    if (!motion && state !== 'alarm') return;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let animations = [];
    const sync = () => {
      animations.forEach((animation) => animation.revert());
      animations = [];
      if (preference.matches || state === 'paused') return;
      const part = (name) => root.current.querySelector(`[data-part="${name}"]`);
      const loop = (name, options) => animations.push(animate(part(name), { loop: true, ...options }));
      if (state === 'alarm') {
        loop('shiver', { translateX: [0, -1.7, 1.5, -1.1, 0], rotate: [0, -2.4, 2, -1.5, 0], translateY: [0, -1.4, .3, -1, 0], duration: 460, loopDelay: 380, ease: 'inOutSine' });
        for (const [name, delay] of [['sweat-left', 0], ['sweat-right', 370]]) {
          loop(name, { translateY: [-3, 6], opacity: [0, 1, 1, 0], scale: [.6, 1, .75], duration: 950, delay, loopDelay: 320, ease: 'outQuad' });
        }
      } else if (gesture) {
        const head = part('head');
        const gestures = {
          greet: { rotate: [0, -12, 10, -8, 0], translateY: [0, -4, 0], duration: 1300 },
          scan: { rotate: [0, -10, 10, 0], duration: 1450 },
          dance: { rotate: [0, -16, 14, -12, 12, 0], translateY: [0, -11, 0, -11, 0], duration: 1650 },
          boost: { translateY: [0, 3, -10, -4, -13, 0], rotate: [0, 0, -5, 7, 0], duration: 1500 },
          rest: { translateY: [0, 4, 4, 0], rotate: [0, 4, 4, 0], duration: 2000 },
        };
        animations.push(animate(head, { ...gestures[gesture], ease: 'inOutSine' }));
        if (gesture === 'scan') animations.push(animate(part('scan'), { translateX: [-22, 22], alternate: true, loop: 1, duration: 720, ease: 'inOutSine' }));
        if (gesture === 'rest') animations.push(animate(part('eyes'), { scaleY: [1, 0.15, 0.15, 1], duration: 1900 }));
      } else if (state === 'idle' && idle) {
        loop('head', { translateY: [0, -2.5], rotate: [0, 2], duration: 2050, alternate: true, ease: 'inOutSine' });
        loop('eyes', { scaleY: [1, 0.13, 1], duration: 240, loopDelay: 3200, delay: 850 });
        if (!follow) loop('look', { translateX: [0, -7, 0, 6, 0], duration: 3300, loopDelay: 1400, ease: 'inOutSine' });
      } else if (state === 'listening') {
        loop('head', { rotate: [0, -5], duration: 840, alternate: true, ease: 'inOutSine' });
        loop('antenna', { opacity: [0.4, 1], duration: 490, alternate: true });
      } else if (state === 'thinking') {
        loop('scan', { translateX: [-18, 18], opacity: [0.4, 1], duration: 730, alternate: true, ease: 'inOutSine' });
      } else if (state === 'speaking') {
        loop('mouth', { scaleY: [0.45, 1.25, 0.7, 1.45, 0.45], duration: 640, ease: 'inOutSine' });
        loop('head', { translateY: [0, -1.5], duration: 520, alternate: true, ease: 'inOutSine' });
      }
    };
    sync();
    preference.addEventListener('change', sync);
    return () => {
      preference.removeEventListener('change', sync);
      animations.forEach((animation) => animation.revert());
    };
  }, [motion, state, idle, gesture, follow]);

  useEffect(() => {
    if (!follow || !motion || gesture || state === 'alarm') return;
    const svg = root.current;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let raf = 0;
    let pointer;
    const reset = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      for (const property of ['--gaze-x', '--gaze-y', '--lean', '--stretch-x', '--stretch-y']) svg.style.removeProperty(property);
    };
    const move = (event) => {
      if (preference.matches || event.pointerType === 'touch' || event.buttons) return;
      pointer = event;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const {left, top, width, height} = svg.getBoundingClientRect();
        const dx = pointer.clientX - (left + width / 2);
        const dy = pointer.clientY - (top + height * .47);
        const distance = Math.max(88, Math.hypot(dx, dy));
        const x = dx / distance, y = dy / distance;
        svg.style.setProperty('--gaze-x', `${x * 6}px`);
        svg.style.setProperty('--gaze-y', `${y * 4}px`);
        svg.style.setProperty('--lean', `${x * 3}deg`);
        svg.style.setProperty('--stretch-x', String(1 + Math.abs(x) * .055 - Math.abs(y) * .025));
        svg.style.setProperty('--stretch-y', String(1 + Math.abs(y) * .06 - Math.abs(x) * .02));
      });
    };
    const outside = (event) => { if (!event.relatedTarget) reset(); };
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerout', outside);
    window.addEventListener('blur', reset);
    preference.addEventListener('change', reset);
    return () => {
      reset();
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerout', outside);
      window.removeEventListener('blur', reset);
      preference.removeEventListener('change', reset);
    };
  }, [follow, motion, gesture, state]);

  const shellColors = outfit === 'amber' ? ['#fff3d9', '#e6ae62', '#a66638'] : outfit === 'mint' ? ['#edfdf4', '#8fcfbd', '#498c80'] : ['#fcfeff', '#bed0d9', '#7d99aa'];
  return <svg ref={root} className="ai-robot" data-state={state} data-gesture={gesture} data-gear={gear} data-outfit={outfit} width={size} height={size} viewBox="0 0 120 112" role="img" aria-label={`巡检机器人：${robotStates[state]}`}>
    <defs>
      <linearGradient id={`${id}-shell`} x2="0.28" y2="1">
        <stop stopColor={shellColors[0]}/><stop offset=".53" stopColor={shellColors[1]}/><stop offset="1" stopColor={shellColors[2]}/>
      </linearGradient>
      <linearGradient id={`${id}-visor`} x2="0" y2="1">
        <stop stopColor="#324e5e"/><stop offset="1" stopColor="#111e29"/>
      </linearGradient>
      <clipPath id={`${id}-scan`}><rect x="28" y="36" width="64" height="30" rx="9"/></clipPath>
    </defs>
    <ellipse cx="60" cy="105" rx="35" ry="4" fill="#345264" opacity=".18"/>
    <g data-part="shiver"><g data-part="posture">
    <path d="M35 80h50l14 13-4 10H25l-4-10z" fill="#344a58" stroke="#263c49" strokeWidth="2.5"/>
    <path d="M38 81h44l11 12-7 5H34l-7-5z" fill={`url(#${id}-shell)`}/>
    <path d="M48 89h24l4 5H44z" fill="#536a78"/>
    <path d="M55 92h10" stroke="#ecaa58" strokeWidth="2" strokeLinecap="round"/>
    <g data-part="head">
      <path d="M74 27l5-13h8" stroke="#435d6c" strokeWidth="3.5" strokeLinecap="round" fill="none"/>
      <circle data-part="antenna" cx="87" cy="14" r="5" stroke="#344b59" strokeWidth="2"/>
      <path d="M23 42h-8l-4 6v15l4 5h8m74-26h8l4 6v15l-4 5h-8" fill="#607b8b" stroke="#344b59" strokeWidth="2.5"/>
      <path d="M34 27h52l13 11v34L87 83H33L21 72V38z" fill={`url(#${id}-shell)`} stroke="#344b59" strokeWidth="2.5" strokeLinejoin="round"/>
      <path d="M34 31h31m-36 4-4 4v25" stroke="#fff" strokeOpacity=".76" strokeWidth="2" strokeLinecap="round" fill="none"/>
      <rect x="28" y="36" width="64" height="30" rx="9" fill={`url(#${id}-visor)`} stroke="#526e7d" strokeWidth="1.25"/>
      <path d="M36 40h47" stroke="#8ab3bd" strokeOpacity=".48" strokeLinecap="round"/>
      <g data-part="gaze"><g data-part="look"><g data-part="eyes" fill="currentColor">
        <rect x="40" y="45" width="12" height="12" rx="4"/>
        <rect x="68" y="45" width="12" height="12" rx="4"/>
      </g></g></g>
      {state === 'alarm' && <g fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M37 43l12-3m34 3-12-3" />
        <ellipse cx="44" cy="51" rx="3.7" ry="5.5" fill="currentColor" stroke="none" />
        <ellipse cx="76" cy="51" rx="3.7" ry="5.5" fill="currentColor" stroke="none" />
        <path d="M55 60q5-5 10 0" />
      </g>}
      <g clipPath={`url(#${id}-scan)`}><path data-part="scan" d="M63 39l-8 25" stroke="currentColor" strokeWidth="5" strokeLinecap="round"/></g>
      <g data-part="mouth" stroke="currentColor" strokeWidth="2.7" strokeLinecap="round">
        <path d="M54 73v3m6-5v7m6-5v3"/>
      </g>
      <path d="M34 72h6m40 0h6" stroke="#536d7c" strokeWidth="2.5" strokeLinecap="round"/>
      {gear === 'beacon' && <><path d="M43 27v-6h24v6z" fill="#263c49"/><rect x="44" y="17" width="10" height="7" rx="2" fill="#ffad51"/><rect x="56" y="17" width="10" height="7" rx="2" fill="#6af1dc"/></>}
      {gear === 'headset' && <><rect x="9" y="44" width="13" height="24" rx="4" fill="#347790" stroke="#263c49" strokeWidth="2"/><rect x="98" y="44" width="13" height="24" rx="4" fill="#347790" stroke="#263c49" strokeWidth="2"/><path d="M104 65v9H86" fill="none" stroke="#26465b" strokeWidth="3" strokeLinecap="round"/></>}
    </g></g></g>
    {state === 'alarm' && <g fill="#75d9ff" stroke="#2f83a6" strokeWidth="1">
      <path data-part="sweat-left" d="M25 8c-2 5-6 8-6 12a6 6 0 0 0 12 0c0-4-4-7-6-12z" />
      <path data-part="sweat-right" d="M105 14c-2 4-5 7-5 10a5 5 0 0 0 10 0c0-3-3-6-5-10z" />
    </g>}
  </svg>;
}

function pageLabel(route) {
  return ({ station: '工位终端', admin: '管理中心', display: '数字展板' })[route] || '平台';
}

function timeLabel(value) {
  return new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
}

function replyTime(value) {
  return new Date(value).toLocaleTimeString('zh-CN', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hour12: false });
}

function ScenarioRows({ title, name, result, rows, onChange }) {
  const move = (index, offset) => {
    const next = [...rows];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    onChange(next);
  };
  const edit = (index, column, value) => onChange(rows.map((row, i) => i === index ? row.map((cell, j) => j === column ? value : cell) : row));
  return <details className="ai-scenario-group">
    <summary>{title} <small>{rows.length} 项</small></summary>
    {rows.map((row, index) => <div className="ai-scenario-row" key={index}>
      <input aria-label={`${name} ${index + 1}`} placeholder={name} maxLength={100} value={row[0]} onChange={event => edit(index, 0, event.target.value)} />
      {result && <input aria-label={`${result} ${index + 1}`} placeholder={result} maxLength={500} value={row[1]} onChange={event => edit(index, 1, event.target.value)} />}
      <div className="ai-scenario-row-actions">
        <button type="button" aria-label={`上移第 ${index + 1} 项`} title="上移" disabled={!index} onClick={() => move(index, -1)}><ChevronUp size={15} /></button>
        <button type="button" aria-label={`下移第 ${index + 1} 项`} title="下移" disabled={index === rows.length - 1} onClick={() => move(index, 1)}><ChevronDown size={15} /></button>
        <button type="button" aria-label={`删除第 ${index + 1} 项`} title="删除" onClick={() => onChange(rows.filter((_, i) => i !== index))}><Trash2 size={14} /></button>
      </div>
    </div>)}
    <button type="button" className="ai-scenario-add" onClick={() => onChange([...rows, result ? ['', ''] : ['']])}><Plus size={15} />添加条目</button>
  </details>;
}

export default function DigitalAssistant({ route, alarmPulse }) {
  const { dataMode } = useTwin();
  const [open, setOpen] = useState(false);
  const [alarmed, setAlarmed] = useState(false);
  useEffect(() => {
    if (!alarmPulse || alarmPulse.mode !== dataMode) { setAlarmed(false); return; }
    const remaining = 6800 - (Date.now() - alarmPulse.at);
    if (remaining <= 0) { setAlarmed(false); return; }
    setAlarmed(true);
    const timer = window.setTimeout(() => setAlarmed(false), remaining);
    return () => window.clearTimeout(timer);
  }, [alarmPulse, dataMode]);
  const [robotMenuOpen, setRobotMenuOpen] = useState(false);
  const [pet, setPet] = useState(readPet);
  const [petGesture, setPetGesture] = useState(null);
  const { size: robotSize, mini, idle: robotIdle, follow: robotFollow, locked: robotLocked } = pet.display;
  const petRobot = { idle: robotIdle, gear: pet.gear, outfit: pet.outfit };
  const dispatchPet = (action) => setPet((current) => updatePet(current, action));
  const setPetDisplay = (value) => dispatchPet({ type: 'display', value });
  const [view, setView] = useState('chat');
  const [conversationView, setConversationView] = useState('chat');
  const [inspect, setInspect] = useState(false);
  const [hover, setHover] = useState(null);
  const [locked, setLocked] = useState(false);
  const [target, setTarget] = useState('');
  const [question, setQuestion] = useState('');
  const [activeRun, setActiveRun] = useState(null);
  const busy = Boolean(activeRun);
  const [notice, setNotice] = useState('');
  const [questions, setQuestions] = useState(readAssistantQuestions);
  const [runs, setRuns] = useState(readAssistantRuns);
  const [conversationId, setConversationId] = useState(() => {
    try { return localStorage.getItem(activeConversationKey) || 'initial'; } catch { return 'initial'; }
  });
  const [questionDraft, setQuestionDraft] = useState(readAssistantQuestions);
  const [questionsSaved, setQuestionsSaved] = useState(true);
  const [listening, setListening] = useState(false);
  const [speech, setSpeech] = useState(null);
  const [autoSpeak, setAutoSpeak] = useState(() => {
    try { return localStorage.getItem(autoSpeakKey) === 'true'; } catch { return false; }
  });
  const speechSupported = !!(window.speechSynthesis && window.SpeechSynthesisUtterance);
  const speechVoiceLabel = useId();
  const [speechRate, setSpeechRate] = useState(() => savedNumber(speechRateKey, .6, 1.8, 1.1));
  const [speechVolume, setSpeechVolume] = useState(() => savedNumber(speechVolumeKey, 0, 1, 1));
  const speechSettings = useRef({});
  speechSettings.current = { rate: speechRate, volume: speechVolume };
  const [speechVoices, setSpeechVoices] = useState([]);
  const [speechVoice, setSpeechVoice] = useState(() => {
    try { return localStorage.getItem(speechVoiceKey) || ''; } catch { return ''; }
  });
  const activeVoice = localVoices.some(({ id }) => id === speechVoice) || speechVoices.some((voice) => voiceId(voice) === speechVoice)
    ? speechVoice : '';
  useEffect(() => {
    if (!speechSupported) return;
    const synth = window.speechSynthesis;
    const loadVoices = () => setSpeechVoices(availableSpeechVoices(synth));
    synth.addEventListener('voiceschanged', loadVoices);
    loadVoices();
    return () => synth.removeEventListener('voiceschanged', loadVoices);
  }, [speechSupported]);
  const [fontSize, setFontSize] = useState(() => {
    try {
      const saved = Number(localStorage.getItem(fontSizeKey));
      return Number.isInteger(saved) && saved >= minFontSize && saved <= maxFontSize ? saved : defaultFontSize;
    } catch { return defaultFontSize; }
  });
  const [interfaceScale, setInterfaceScale] = useState(() => {
    try {
      const saved = Number(localStorage.getItem(interfaceScaleKey));
      if (Number.isInteger(saved) && saved >= interfaceScaleRange.min && saved <= interfaceScaleRange.max) return saved;
    } catch {}
    return interfaceScaleRange.default;
  });
  const [alarmSnapshot, setAlarmSnapshot] = useState(null);
  const [selectedAlarmId, setSelectedAlarmId] = useState(null);
  const [alarmRetry, setAlarmRetry] = useState({});
  const [compact, setCompact] = useState(false);
  const [positions, setPositions] = useState({});
  const [panelSize, setPanelSize] = useState(null);
  const [narrow, setNarrow] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarOverlay, setSidebarOverlay] = useState(false);
  const [nearbyId, setNearbyId] = useState(null);
  const [qaError, setQaError] = useState('');

  const assistantRef = useRef(null);
  const robotMenuId = useId();
  const inputRef = useRef(null);
  const logRef = useRef(null);
  const dragRef = useRef(null);
  const resizeRef = useRef(null);
  const suppressClick = useRef(false);
  const lockRef = useRef(false);
  const hoveredRef = useRef(null);
  const selectedElementRef = useRef(null);
  const recognitionRef = useRef(null);
  const nativeSpeechPending = useRef(false);
  const playbackRef = useRef(null);
  const lastReplyId = useRef(runs[0]?.id);
  const voiceActionRef = useRef(null);
  const noticeTimerRef = useRef(null);
  const busyTimerRef = useRef(null);

  useEffect(() => {
    try { localStorage.setItem(petStorageKey, JSON.stringify(pet)); } catch {}
  }, [pet]);

  useEffect(() => {
    if (!petGesture) return;
    const timer = window.setTimeout(() => setPetGesture(null), 2050);
    return () => window.clearTimeout(timer);
  }, [petGesture]);

  const playPetAction = (id) => {
    if (id === 'rest') {
      if (petGesture) return;
      dispatchPet({ type: 'rest' });
    } else if (!petActions.some((action) => action.id === id && petLevel(pet.xp) >= action.level)) return;
    setPetGesture(id);
  };

  useEffect(() => {
    if (!robotMenuOpen) return;
    if (open) { setRobotMenuOpen(false); return; }
    const closeOutside = (event) => {
      if (!assistantRef.current?.contains(event.target)) setRobotMenuOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key !== 'Escape') return;
      setRobotMenuOpen(false);
      assistantRef.current?.querySelector('.ai-robot-launch')?.focus();
    };
    const closeOnResize = () => setRobotMenuOpen(false);
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    window.addEventListener('resize', closeOnResize);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('resize', closeOnResize);
    };
  }, [robotMenuOpen, open]);

  useEffect(() => {
    if (!open || (view !== 'alarms' && view !== 'alarm-report')) return undefined;
    let live = true;
    let request;
    const load = async () => {
      if (request) return;
      request = new AbortController();
      const timeout = window.setTimeout(() => request?.abort(), 5000);
      try {
        const rows = await api('/api/ai/alarm-notifications', undefined, request.signal);
        if (live && Array.isArray(rows)) setAlarmSnapshot({ mode: dataMode, rows });
      } catch {
        if (live) setAlarmSnapshot((previous) => ({ mode: dataMode, rows: previous?.mode === dataMode ? previous.rows : [], error: true }));
      } finally { window.clearTimeout(timeout); request = undefined; }
    };
    load();
    const timer = window.setInterval(load, 2000);
    return () => { live = false; window.clearInterval(timer); request?.abort(); };
  }, [open, view, dataMode]);

  const positionKey = compact ? 'compact' : open ? 'panel' : 'launcher';
  const fit = (x, y, width, height) => ({
    left: Math.max(8, Math.min(x, window.innerWidth - width - 8)),
    top: Math.max(8, Math.min(y, window.innerHeight - height - 8)),
  });

  const showNotice = (text) => {
    setNotice(text);
    window.clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = window.setTimeout(() => setNotice(''), 3200);
  };

  const cancelSpeech = () => {
    const playback = playbackRef.current;
    if (!playback) return;
    playbackRef.current = null;
    playback.dispose();
  };

  const stopSpeech = () => {
    cancelSpeech();
    setSpeech(null);
  };

  const toggleSpeechPause = () => {
    const playback = playbackRef.current;
    if (!speech || !playback) return;
    playback.paused = !playback.paused;
    playback.syncPause();
    if (playbackRef.current === playback) setSpeech({ ...speech, paused: playback.paused });
  };

  const speakReply = (run, preferredVoice = activeVoice, restart = false) => {
    if (!restart && speech?.id === run.id && playbackRef.current) { toggleSpeechPause(); return; }
    const chunks = speechChunks(run.answer);
    if (!chunks.length) return;
    cancelSpeech();
    const synth = window.speechSynthesis;
    const voices = availableSpeechVoices(synth);
    const voice = voices.find((item) => voiceId(item) === preferredVoice || item.name === preferredVoice) || voices[0];
    const localVoice = localVoices.find(({ id }) => id === preferredVoice) || (!speechSupported || !voice ? localVoices[0] : null);
    if (localVoice) {
      const audio = new Audio();
      const controller = new AbortController();
      const playback = { paused: false };
      let objectUrl;
      const live = () => playbackRef.current === playback;
      const finish = (message) => {
        if (!live()) return;
        stopSpeech();
        if (message) showNotice(message);
      };
      playback.scheduleSettings = () => {
        audio.playbackRate = speechSettings.current.rate;
        audio.volume = speechSettings.current.volume;
      };
      const playAudio = () => {
        playback.scheduleSettings();
        audio.play().catch((error) => {
          if (!live() || error.name === 'AbortError') return;
          if (error.name === 'NotAllowedError') {
            playback.paused = true;
            setSpeech({ id: run.id, paused: true });
            showNotice('浏览器暂停了自动播报，请点继续播报。');
          } else finish('音频无法播放，请重试。');
        });
      };
      playback.syncPause = () => {
        if (playback.paused) audio.pause();
        else if (audio.hasAttribute('src')) playAudio();
      };
      playback.dispose = () => {
        controller.abort();
        audio.onended = audio.onerror = null;
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      };
      const playChunk = async (index) => {
        if (index >= chunks.length) { finish(); return; }
        try {
          const response = await fetch('/api/ai/assistant-voice', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ voice: localVoice.id, text: chunks[index] }), signal: controller.signal,
          });
          if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw Error(error.error || '平台语音服务暂不可用，请重试。');
          }
          const blob = await response.blob();
          if (!live()) return;
          if (objectUrl) URL.revokeObjectURL(objectUrl);
          objectUrl = URL.createObjectURL(blob);
          audio.src = objectUrl;
          audio.onended = () => {
            audio.removeAttribute('src');
            playChunk(index + 1);
          };
          if (!playback.paused) playAudio();
        } catch (error) { finish(error.message); }
      };
      audio.onerror = () => finish('音频无法播放，请重试。');
      playbackRef.current = playback;
      setSpeech({ id: run.id, paused: false });
      if (run.id === voicePreview.id) {
        audio.src = `/assistant-voices/${localVoice.sample}`;
        audio.onended = () => finish();
        playAudio();
      } else playChunk(0);
      return;
    }
    const playback = { utterance: null, index: 0, paused: false, settingsTimer: null };
    const live = () => playbackRef.current === playback;
    const cancelUtterance = () => {
      if (!playback.utterance) return;
      playback.utterance.onend = playback.utterance.onerror = null;
      playback.utterance = null;
      synth.cancel();
    };
    playback.dispose = () => {
      clearTimeout(playback.settingsTimer);
      cancelUtterance();
    };
    const finish = (message) => {
      if (!live()) return;
      stopSpeech();
      if (message) showNotice(message);
    };
    const playChunk = (index) => {
      if (!live()) return;
      if (index >= chunks.length) { finish(); return; }
      const utterance = new window.SpeechSynthesisUtterance(run.id === voicePreview.id ? '你好，这里是这个音色的试听。' : chunks[index]);
      utterance.lang = voice?.lang || 'zh-CN';
      utterance.rate = speechSettings.current.rate;
      utterance.pitch = 1.08;
      utterance.volume = speechSettings.current.volume;
      if (voice) utterance.voice = voice;
      utterance.onend = () => {
        if (playback.utterance !== utterance) return;
        playback.utterance = null;
        playChunk(index + 1);
      };
      utterance.onerror = () => {
        if (live()) speakReply(run, localVoices[0].id, true);
      };
      playback.index = index;
      playback.utterance = utterance;
      try {
        if (synth.paused) synth.resume();
        synth.speak(utterance);
      } catch { if (live()) speakReply(run, localVoices[0].id, true); }
    };
    const applySettings = () => {
      const { utterance, index } = playback;
      const { rate, volume } = speechSettings.current;
      if (!live() || playback.paused || !utterance || (utterance.rate === rate && utterance.volume === volume)) return false;
      cancelUtterance();
      playChunk(index);
      return true;
    };
    playback.scheduleSettings = () => {
      clearTimeout(playback.settingsTimer);
      // Restart just the current chunk after the slider stops moving.
      playback.settingsTimer = setTimeout(applySettings, 220);
    };
    playback.syncPause = () => {
      if (playback.paused) synth.pause();
      else if (!applySettings()) synth.resume();
    };
    playbackRef.current = playback;
    setSpeech({ id: run.id, paused: false });
    playChunk(0);
  };

  const persistRuns = (update) => {
    setRuns((current) => {
      const next = typeof update === 'function' ? update(current) : update;
      try {
        localStorage.setItem(assistantRunsKey, JSON.stringify(next.slice(0, MAX_RUNS)));
      } catch {
        showNotice('本机存储空间不足，最新记录仍显示在当前页面。');
      }
      return next;
    });
  };

  const updateRun = (runId, update) => {
    persistRuns((current) => current.map((run) => run.id === runId ? update(run) : run));
  };

  const dragStart = (event) => {
    if (event.button !== 0 || event.target.closest('input, textarea, select') || (open && event.target.closest('button'))) return;
    if (!open && robotLocked) { suppressClick.current = false; return; }
    const rect = assistantRef.current.getBoundingClientRect();
    dragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      key: positionKey,
    };
    suppressClick.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const dragMove = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (Math.hypot(dx, dy) < 5 && !suppressClick.current) return;
    if (robotMenuOpen && drag.key === 'launcher') setRobotMenuOpen(false);
    suppressClick.current = true;
    setPositions((current) => ({
      ...current,
      [drag.key]: fit(drag.left + dx, drag.top + dy, drag.width, drag.height),
    }));
  };

  const dragEnd = (event) => {
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const dragHandlers = {
    onPointerDown: dragStart,
    onPointerMove: dragMove,
    onPointerUp: dragEnd,
    onPointerCancel: dragEnd,
  };

  const resizePanel = (rect, dx, dy) => {
    const maxWidth = Math.max(0, Math.min(rect.right, window.innerWidth - 8) - 8);
    const maxHeight = Math.max(0, Math.min(rect.bottom, window.innerHeight - 8) - 8);
    const width = Math.min(maxWidth, Math.max(320, rect.width - dx));
    const height = Math.min(maxHeight, Math.max(430, rect.height - dy));
    setPanelSize({ width, height });
    setPositions((current) => ({ ...current, panel: fit(rect.right - width, rect.bottom - height, width, height) }));
  };

  const resizeHandlers = {
    onPointerDown(event) {
      if (event.button !== 0 || resizeRef.current) return;
      resizeRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, rect: assistantRef.current.getBoundingClientRect() };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerMove(event) {
      const resize = resizeRef.current;
      if (resize?.pointerId === event.pointerId) resizePanel(resize.rect, event.clientX - resize.x, event.clientY - resize.y);
    },
    onLostPointerCapture(event) {
      if (resizeRef.current?.pointerId === event.pointerId) resizeRef.current = null;
    },
    onKeyDown(event) {
      const delta = { ArrowLeft: [-24, 0], ArrowRight: [24, 0], ArrowUp: [0, -24], ArrowDown: [0, 24] }[event.key];
      if (!delta) return;
      event.preventDefault();
      resizePanel(assistantRef.current.getBoundingClientRect(), ...delta);
    },
  };

  const unlock = () => {
    lockRef.current = false;
    setLocked(false);
    setTarget('');
    setHover(null);
    selectedElementRef.current = null;
    hoveredRef.current?.removeAttribute('data-ai-highlight');
    hoveredRef.current = null;
  };

  const lock = () => {
    if (!hoveredRef.current) return;
    lockRef.current = true;
    setLocked(true);
    selectedElementRef.current = hoveredRef.current;
    const element = hoveredRef.current;
    setTarget(describeAssistantObject(element, route).text);
    setHover(null);
    const rect = element.getBoundingClientRect();
    const width = Math.min(360, innerWidth - 16);
    const left = rect.right + width + 20 < innerWidth ? rect.right + 12 : rect.left - width - 12;
    setPositions((current) => ({ ...current, compact: fit(left, rect.top, width, 300) }));
    setCompact(true);
    setView('chat');
    setOpen(true);
  };

  const stopRecognition = () => {
    const session = recognitionRef.current;
    recognitionRef.current = null;
    nativeSpeechPending.current = false;
    if (!session) return;
    clearTimeout(session.timeout);
    session.stream?.getTracks().forEach((track) => track.stop());
    if (session.recognition) {
      const rec = session.recognition;
      rec.onresult = rec.onend = rec.onerror = null;
      try { rec.abort(); } catch {}
    }
  };

  useEffect(() => {
    if (!navigator.userAgent.includes('HongmouTerminal/')) return;
    window.HongmouSpeechResult = (transcript, error) => {
      if (!nativeSpeechPending.current) return;
      nativeSpeechPending.current = false;
      setListening(false);
      if (error) showNotice(error);
      if (transcript) setQuestion((current) => [current.trimEnd(), transcript].filter(Boolean).join(' '));
      inputRef.current?.focus();
    };
    return () => { delete window.HongmouSpeechResult; };
  }, []);

  const toggleVoice = async () => {
    if (recognitionRef.current || nativeSpeechPending.current) {
      stopRecognition();
      setListening(false);
      return;
    }
    setOpen(true);
    setView('chat');
    setConversationView('chat');
    stopSpeech();
    if (navigator.userAgent.includes('HongmouTerminal/')) {
      nativeSpeechPending.current = true;
      setListening(true);
      window.location.href = 'hongmou-terminal://speech';
      return;
    }
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) { showNotice('当前浏览器不支持语音输入，可使用键盘听写。'); return; }

    const session = { heard: false };
    const prefix = question.match(/^ +/)?.[0] || '';
    recognitionRef.current = session;
    setListening(true);
    const finish = (message) => {
      if (recognitionRef.current !== session) return;
      stopRecognition();
      setListening(false);
      if (message) showNotice(message);
      inputRef.current?.focus();
    };
    session.timeout = setTimeout(() => finish(session.heard ? '' : '没听到声音，请重试。'), 12000);
    try {
      if (navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (recognitionRef.current !== session) { stream.getTracks().forEach((track) => track.stop()); return; }
        session.stream = stream;
      }
      const rec = new Recognition();
      session.recognition = rec;
      rec.lang = 'zh-CN';
      rec.interimResults = true;
      rec.continuous = false;
      rec.onresult = (event) => {
        if (recognitionRef.current !== session) return;
        const transcript = Array.from(event.results, (result) => result[0]?.transcript || '').join('').trim();
        if (transcript) { session.heard = true; setQuestion(prefix + transcript); }
      };
      rec.onerror = (event) => {
        const permission = window.isSecureContext ? '没有麦克风权限，请检查浏览器设置。' : '当前局域网 HTTP 地址的麦克风被浏览器拒绝，可使用键盘听写。';
        finish({ 'not-allowed': permission, 'service-not-allowed': permission, 'audio-capture': '没有可用的麦克风。',
          'no-speech': '没听到声音，请重试。', network: '浏览器的语音识别服务连不上。' }[event.error] || '语音输入没能启动。');
      };
      rec.onend = () => finish(session.heard ? '' : '没听到声音，请重试。');
      rec.start();
    } catch (error) {
      finish(error.name === 'NotAllowedError' ? '没有麦克风权限，请检查浏览器设置。' : error.name === 'NotFoundError' ? '没有可用的麦克风。' : '语音输入没能启动。');
    }
  };
  voiceActionRef.current = toggleVoice;

  useEffect(() => {
    const clamp = () => {
      const element = assistantRef.current;
      if (!element || element.hidden) return;
      const rect = element.getBoundingClientRect();
      if (positionKey === 'panel') setNarrow(rect.width < 650);
      if (rect.left < 8 || rect.top < 8 || rect.right > innerWidth - 8 || rect.bottom > innerHeight - 8) {
        setPositions((current) => ({ ...current, [positionKey]: fit(rect.left, rect.top, rect.width, rect.height) }));
      }
    };
    clamp();
    const observer = new ResizeObserver(clamp);
    if (assistantRef.current) observer.observe(assistantRef.current);
    window.addEventListener('resize', clamp);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', clamp);
    };
  }, [positionKey, inspect, locked]);

  useEffect(() => {
    if (compact) inputRef.current?.focus();
  }, [compact]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [runs, activeRun, view, conversationId]);

  useEffect(() => {
    let rightShiftDown = false;
    let chordUsed = false;
    const onKeyDown = (event) => {
      if (event.code === 'ShiftRight' && !event.repeat) {
        rightShiftDown = !event.ctrlKey && !event.altKey && !event.metaKey;
        chordUsed = !rightShiftDown;
        return;
      }
      if (rightShiftDown && !['ShiftLeft', 'ShiftRight'].includes(event.code)) chordUsed = true;
      if (event.key === 'Escape' && inspect) {
        unlock();
        setInspect(false);
        setCompact(false);
        setOpen(true);
      }
    };
    const onKeyUp = (event) => {
      if (event.code !== 'ShiftRight' || !rightShiftDown) return;
      rightShiftDown = false;
      if (!chordUsed && !event.ctrlKey && !event.altKey && !event.metaKey) {
        event.preventDefault();
        voiceActionRef.current?.();
      }
    };
    const onBlur = () => { rightShiftDown = false; chordUsed = false; };
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('keyup', onKeyUp, true);
    window.addEventListener('blur', onBlur);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('keyup', onKeyUp, true);
      window.removeEventListener('blur', onBlur);
    };
  }, [inspect]);

  useEffect(() => () => {
    cancelSpeech();
    stopRecognition();
    window.clearTimeout(noticeTimerRef.current);
    window.clearTimeout(busyTimerRef.current);
    hoveredRef.current?.removeAttribute('data-ai-highlight');
  }, []);

  useEffect(() => {
    window.addEventListener('pagehide', stopSpeech);
    return () => window.removeEventListener('pagehide', stopSpeech);
  }, []);

  useEffect(() => {
    if (inspect && !locked) stopSpeech();
  }, [inspect, locked]);

  useEffect(() => {
    const latest = runs[0];
    if (!latest || lastReplyId.current === latest.id) return;
    lastReplyId.current = latest.id;
    if (latest.status !== 'stopped' && autoSpeak && open && !listening && (!inspect || locked)) speakReply(latest);
  }, [runs, autoSpeak, open, listening, inspect, locked]);

  useEffect(() => {
    if (!inspect) {
      if (!lockRef.current) hoveredRef.current?.removeAttribute('data-ai-highlight');
      return undefined;
    }
    const move = (event) => {
      if (lockRef.current) return;
      const element = selectAssistantObject(event.target);
      hoveredRef.current?.removeAttribute('data-ai-highlight');
      hoveredRef.current = null;
      setHover(null);
      if (!element) return;
      hoveredRef.current = element;
      element.setAttribute('data-ai-highlight', 'true');
      const rect = element.getBoundingClientRect();
      setHover({
        text: describeAssistantObject(element, route).text,
        x: Math.max(8, Math.min(innerWidth - 210, rect.right - 200)),
        y: Math.max(8, Math.min(innerHeight - 60, rect.top - 42)),
      });
    };
    const choose = (event) => {
      if (lockRef.current || event.target.closest('.digital-assistant, .ai-hover')) return;
      move(event);
      if (!hoveredRef.current) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      lock();
    };
    const preventAction = (event) => {
      if (!lockRef.current && selectAssistantObject(event.target)) {
        event.stopImmediatePropagation();
        if (event.type === 'keydown') event.preventDefault();
      }
    };
    const selectByKeyboard = (event) => {
      if (['Enter', ' '].includes(event.key) && !lockRef.current && selectAssistantObject(event.target)) {
        preventAction(event);
        move(event);
        lock();
      }
    };
    document.addEventListener('pointerdown', preventAction, true);
    document.addEventListener('pointerup', preventAction, true);
    document.addEventListener('keydown', selectByKeyboard, true);
    document.addEventListener('click', choose, true);
    document.addEventListener('pointerover', move);
    document.addEventListener('focusin', move);
    return () => {
      document.removeEventListener('pointerdown', preventAction, true);
      document.removeEventListener('pointerup', preventAction, true);
      document.removeEventListener('keydown', selectByKeyboard, true);
      document.removeEventListener('click', choose, true);
      document.removeEventListener('pointerover', move);
      document.removeEventListener('focusin', move);
      if (!lockRef.current) hoveredRef.current?.removeAttribute('data-ai-highlight');
    };
  }, [inspect, route]);

  const submitQuestion = (value = question) => {
    if (!value.length || busy) return;
    const { number, entry } = resolveAssistantQuestion(value, questions);
    if (!entry) {
      showNotice(number === null ? '请输入编号，或用开头的空格数选择场景。' : `尚未设置编号 ${number} 的模拟场景。`);
      return;
    }
    const context = target || document.querySelector('main [data-ai-context]')?.dataset.aiContext || document.querySelector('main h1')?.innerText || pageLabel(route);
    const run = { ...createAssistantWorkflowRun({ text: value, entry, route, target: context, selectedTarget: target }), conversationId };
    stopSpeech();
    setOpen(true);
    setView('chat');
    setConversationView('chat');
    if (compact) setNearbyId(run.id);
    setQuestion('');
    setActiveRun({ run, step: 0, phase: 'workflow' });
    const stages = assistantWorkflowStages(run);
    const characters = Array.from(run.answer);
    const chunkSize = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? characters.length : Math.max(2, Math.ceil(characters.length / 100));
    const advance = (step) => {
      if (step < stages) {
        setActiveRun({ run, step, phase: 'workflow' });
        busyTimerRef.current = window.setTimeout(() => advance(step + 1), 430);
        return;
      }
      const typeReply = (typed, partial = '') => {
        const next = Math.min(characters.length, typed + chunkSize);
        const answer = partial + characters.slice(typed, next).join('');
        if (next < characters.length) {
          setActiveRun({ run, step: stages, partial: answer, phase: 'answer' });
          busyTimerRef.current = window.setTimeout(() => typeReply(next, answer), 24);
          return;
        }
        const finished = { ...run, durationMs: Date.now() - Date.parse(run.createdAt) };
        recordEvent('ai', `问题${run.number} · ${run.scenario.title}：${run.answer}`, undefined);
        persistRuns((currentRuns) => [finished, ...currentRuns].slice(0, MAX_RUNS));
        dispatchPet({ type: 'reward', id: finished.id });
        setActiveRun(null);
      };
      typeReply(0);
    };
    advance(0);
  };

  const stopRun = () => {
    if (!activeRun) return;
    window.clearTimeout(busyTimerRef.current);
    const { run, step, partial } = activeRun;
    const stopped = {
      ...run, answer: partial || '', status: 'stopped', confirmation: null,
      tasks: run.tasks.filter(task => task.status !== 'waiting').slice(0, step),
      toolCalls: run.toolCalls.filter(tool => tool.status !== 'waiting').slice(0, step),
      scenario: { ...run.scenario, steps: run.scenario.steps.slice(0, step) },
    };
    persistRuns((current) => [stopped, ...current].slice(0, MAX_RUNS));
    setActiveRun(null);
  };

  const openConversation = (id) => {
    if (id !== conversationId) {
      stopRun();
      stopSpeech();
      stopRecognition();
      window.clearTimeout(noticeTimerRef.current);
      setListening(false);
      setNotice('');
      unlock();
      setInspect(false);
      setQuestion('');
      setNearbyId(null);
      setConversationId(id);
      try { localStorage.setItem(activeConversationKey, id); } catch {}
    }
    setCompact(false);
    setSidebarOverlay(false);
    setView('chat');
    setConversationView('chat');
  };

  const startConversation = () => openConversation(globalThis.crypto?.randomUUID?.() || `chat-${Date.now()}-${Math.random().toString(16).slice(2)}`);

  const decideConfirmation = (runId, decision) => {
    updateRun(runId, (run) => {
      if (!run.confirmation || run.confirmation.status !== 'pending') return run;
      const status = decision === 'confirm' ? 'confirmed' : 'cancelled';
      const label = decision === 'confirm' ? '已确认并记录' : '已取消';
      return {
        ...run,
        status,
        confirmation: { ...run.confirmation, status, value: label },
        tasks: run.tasks.map((task) => task.id === 'confirm' ? { ...task, title: `人工确认：${label}`, status: 'completed' } : task),
        toolCalls: run.toolCalls.map((tool) => tool.id === 'confirm-card' ? { ...tool, result: label, status: 'success' } : tool),
      };
    });
  };

  const updateQuestionDraft = (index, patch) => {
    setQuestionDraft((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
    setQuestionsSaved(false);
    setQaError('');
  };

  const renumberQuestions = (items) => items.map((item, index) => ({ ...item, number: index + 1, id: `question-${index + 1}` }));

  const addQuestion = () => {
    const next = renumberQuestions([...questionDraft, {
      id: '', number: questionDraft.length + 1, prompt: '', answer: '', needsConfirmation: false,
      kind: 'general', workflow: { ...assistantScenarioTemplate({ kind: 'general' }), steps: [], tasks: [], tools: [] },
    }]);
    setQuestionDraft(next);
    setQuestionsSaved(false);
  };

  const removeQuestion = (index) => {
    if (questionDraft.length <= 1) {
      setQaError('至少保留一个模拟场景。');
      return;
    }
    setQuestionDraft(renumberQuestions(questionDraft.filter((_, itemIndex) => itemIndex !== index)));
    setQuestionsSaved(false);
  };

  const moveQuestion = (index, offset) => {
    const nextIndex = index + offset;
    if (nextIndex < 0 || nextIndex >= questionDraft.length) return;
    const next = [...questionDraft];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    setQuestionDraft(renumberQuestions(next));
    setQuestionsSaved(false);
  };

  const saveQuestions = () => {
    if (questionDraft.some((item) => !item.prompt.trim() || !item.answer.trim())) {
      setQaError('每个场景都需要填写场景名称和回复。');
      return;
    }
    const cleanRows = (rows) => rows.map(row => row.map(value => value.trim())).filter(([name]) => name);
    const saved = renumberQuestions(questionDraft.map((item) => ({ ...item,
      prompt: item.prompt.trim(), answer: item.answer.trim(),
      workflow: { ...item.workflow, title: item.workflow.title.trim() || item.prompt.trim(),
        steps: cleanRows(item.workflow.steps), tasks: cleanRows(item.workflow.tasks), tools: cleanRows(item.workflow.tools),
      },
    })));
    try {
      localStorage.setItem(assistantQuestionsKey, JSON.stringify(saved));
      setQuestionDraft(saved);
      setQuestions(saved);
      setQuestionsSaved(true);
      setQaError('');
      showNotice('模拟场景已保存在本机浏览器。');
    } catch {
      setQaError('浏览器暂时无法保存，请检查本机存储空间。');
    }
  };

  const editWorkflow = (index, patch) => updateQuestionDraft(index, { workflow: { ...questionDraft[index].workflow, ...patch } });

  const conversations = new Map();
  for (const run of runs) {
    const id = conversationOf(run);
    const chat = conversations.get(id);
    if (chat) chat.title = run.prompt;
    else conversations.set(id, { title: run.prompt, updatedAt: run.createdAt });
  }
  const displayedRuns = runs.filter((run) => conversationOf(run) === conversationId).reverse();
  const conversationRuns = activeRun ? [...displayedRuns, activeRun.run] : displayedRuns;
  const alarmRecords = alarmSnapshot?.mode === dataMode ? alarmSnapshot?.rows : undefined;
  const selectedAlarm = alarmRecords?.find((record) => record.id === selectedAlarmId);
  const viewingAlarms = view === 'alarms' || view === 'alarm-report';
  const nearbyRun = runs.find((run) => run.id === nearbyId);
  const statusLabel = (run) => run.status === 'waiting' ? '等待确认' : run.status === 'confirmed' ? '已确认' : run.status === 'cancelled' ? '已取消' : run.status === 'stopped' ? '已停止' : '已完成';
  const changeAutoSpeak = (checked) => {
    setAutoSpeak(checked);
    try { localStorage.setItem(autoSpeakKey, String(checked)); } catch {}
    if (!checked) stopSpeech();
  };
  const changeFontSize = (size) => {
    setFontSize(size);
    try { localStorage.setItem(fontSizeKey, String(size)); } catch {}
  };
  const changeInterfaceScale = (scale) => {
    setInterfaceScale(scale);
    try { localStorage.setItem(interfaceScaleKey, String(scale)); } catch {}
  };
  const renderRobotSize = () => <label className="ai-font-setting">
    <span>机器人大小</span>
    <input type="range" min={petSizeRange.min} max={petSizeRange.max} step={1} value={robotSize} aria-valuetext={`${robotSize} 像素`} onChange={(event) => setPetDisplay({ size: event.target.valueAsNumber, mini: false })} />
    <span className="ai-font-value" aria-hidden="true">{robotSize} px</span>
  </label>;
  const resetPetDisplay = () => {
    setPetDisplay(petDisplayDefaults);
    setPositions(({ launcher, ...otherPositions }) => otherPositions);
  };
  const retryAlarmAnalysis = async (id) => {
    setAlarmRetry({ id, pending: true });
    try {
      await api('/api/ai/alarm-notifications/retry', { id }, AbortSignal.timeout(5000));
      setAlarmSnapshot((snapshot) => snapshot?.rows.some((row) => row.id === id && row.status === 'failed') ? {
        ...snapshot, rows: snapshot.rows.map((row) => row.id === id ? { ...row, status: 'pending' } : row),
      } : snapshot);
      setAlarmRetry({});
    } catch (error) { setAlarmRetry({ id, error: error.message }); }
  };

  const renderProcess = (run, step = null, phase = '', expanded = false) => (
    <details className="ai-workflow-record" open={expanded || undefined}>
      <summary><span>{phase === 'workflow' ? run.scenario?.steps?.[step]?.[0] || run.tasks[step]?.title || run.toolCalls[step]?.name : phase === 'answer' ? '正在输出回复' : statusLabel(run)}</span>
        {phase === 'workflow' && <small>{step + 1} / {assistantWorkflowStages(run)}</small>}
        {!phase && run.durationMs > 0 && <small>用时 {(run.durationMs / 1000).toFixed(1)} 秒</small>}
        <ChevronDown size={14} />
      </summary>
      <div className="ai-workflow-grid">
        {!!run.scenario?.steps?.length && <section className="ai-workflow-block">
          <h4><Clock3 size={15} /> 执行轨迹</h4>
          <ol className="ai-tool-calls">{run.scenario.steps.slice(0, step === null ? undefined : step + 1).map(([name, result], index) => (
            <li key={index}><span><code>{name}</code>{result && !(phase === 'workflow' && index === step) && <small>{result}</small>}</span></li>
          ))}</ol>
        </section>}
        {!!run.tasks.length && <section className="ai-workflow-block">
          <h4><ListChecks size={15} /> 任务清单</h4>
          <ol className="ai-task-list">
            {run.tasks.map((task, index) => {
              const status = step === null || (task.status !== 'waiting' && index < step) ? task.status : index === step && phase === 'workflow' && task.status !== 'waiting' ? 'running' : 'queued';
              return <li key={task.id} className={`task-${status}`}>
                <span>{status === 'completed' ? <Check size={14} /> : <Clock3 size={14} />}</span>
                <span>{task.title}</span>
                <small>{{ waiting: '等待确认', running: '运行中', queued: '待处理', completed: '完成' }[status]}</small>
              </li>;
            })}
          </ol>
        </section>}
        {!!run.toolCalls.length && <section className="ai-workflow-block">
          <h4><Wrench size={15} /> 工具调用</h4>
          <ul className="ai-tool-calls">
            {run.toolCalls.filter(tool => step === null || tool.status !== 'waiting').slice(0, step === null ? undefined : step + (phase === 'workflow' ? 1 : 0)).map((tool, index) => (
              <li key={tool.id}>
                <span><code>{tool.name}</code>{index !== step && <small>{tool.result}</small>}</span>
                <b className={`tool-${index === step && tool.status !== 'waiting' ? 'running' : tool.status}`}>{index === step && tool.status !== 'waiting' ? '处理中' : tool.status === 'waiting' ? '等待确认' : '已返回'}</b>
              </li>
            ))}
          </ul>
        </section>}
      </div>
      <p className="ai-workflow-footnote">模拟运行</p>
    </details>
  );

  const renderConfirmation = (run) => {
    if (!run.confirmation) return null;
    const pending = run.confirmation.status === 'pending';
    return (
      <section className={`ai-confirmation-card ${pending ? 'is-pending' : 'is-resolved'}`} aria-label="二次确认卡">
        <div className="ai-confirmation-heading"><Clock3 size={17} /><strong>{pending ? '等待二次确认' : run.confirmation.status === 'confirmed' ? '已确认' : '已取消'}</strong></div>
        <h4>{run.confirmation.title}</h4>
        <dl><div><dt>提交状态</dt><dd>{run.confirmation.before}</dd></div><div><dt>当前步骤</dt><dd>{run.confirmation.value}</dd></div></dl>
        <p>{run.confirmation.reason}</p>
        {pending && <div className="ai-confirmation-actions">
          <button type="button" className="secondary" onClick={() => decideConfirmation(run.id, 'cancel')}>取消</button>
          <button type="button" className="primary" onClick={() => decideConfirmation(run.id, 'confirm')}>确认并记录</button>
        </div>}
      </section>
    );
  };

  const renderSpeechButton = (run) => {
    const current = speech?.id === run.id;
    const label = current ? (speech.paused ? '继续播报' : '暂停播报') : '播报回复';
    const Icon = current ? (speech.paused ? Play : Pause) : Volume2;
    return <span className="ai-reply-speech">
      <button type="button" className="ai-speech-button" aria-label={label} title={label} onClick={() => speakReply(run)}><Icon size={16} /></button>
      {current && <button type="button" className="ai-speech-button" aria-label="停止播报" title="停止播报" onClick={stopSpeech}><Square size={15} /></button>}
    </span>;
  };

  const renderRun = (run, active = null) => (
    <div className="ai-run-pair" key={run.id}>
      <div className="ai-user-turn"><article className="ai-message user" aria-label="你的提问"><p>{run.input.trim() && !/^\d+$/.test(run.input.trim()) ? run.input.replace(/^\d+\s+/, '').trim() : run.prompt}</p></article><time dateTime={run.createdAt} title={timeLabel(run.createdAt)}>{replyTime(run.createdAt)}</time></div>
      <article className="ai-message assistant" aria-label="鸿眸助手回复">
        {renderProcess(run, active?.step, active?.phase, Boolean(active))}
        {active?.phase === 'answer' && <p className="ai-final-answer is-streaming" aria-hidden="true">{active.partial}<span className="ai-stream-caret" /></p>}
        {!active && <>
          {run.answer && <p className="ai-final-answer">{run.answer}</p>}
          {renderConfirmation(run)}
          {run.answer && run.status !== 'stopped' && <div className="ai-answer-actions">{renderSpeechButton(run)}</div>}
        </>}
      </article>
    </div>
  );

  const presets = questions.slice(0, 4);
  const questionPreview = question.length ? resolveAssistantQuestion(question, questions) : null;
  const chatTitle = conversations.get(conversationId)?.title || '新对话';
  const showSidebar = !compact && (narrow ? sidebarOverlay : !sidebarCollapsed);
  const emptyChat = !compact && !activeRun && !displayedRuns.length;
  const robotState = alarmed ? 'alarm' : listening ? 'listening' : speech ? (speech.paused ? 'paused' : 'speaking') : busy ? 'thinking' : 'idle';
  const previewSpeaking = speech?.id === voicePreview.id;
  const changeSpeechSetting = (key, value) => {
    const rate = key === speechRateKey;
    (rate ? setSpeechRate : setSpeechVolume)(value);
    speechSettings.current[rate ? 'rate' : 'volume'] = value;
    playbackRef.current?.scheduleSettings();
    try { localStorage.setItem(key, String(value)); } catch {}
  };
  const changeSpeechVoice = (value) => {
    setNotice('');
    setSpeechVoice(value);
    try { localStorage.setItem(speechVoiceKey, value); } catch {}
    speakReply(voicePreview, value, true);
  };
  const showView = (next) => {
    if (view === 'settings' && next !== 'settings' && previewSpeaking) stopSpeech();
    setView(next);
    setSidebarOverlay(false);
  };
  const openFromRobot = (next) => {
    setRobotMenuOpen(false);
    setCompact(false);
    if (next === 'chat') setConversationView('chat');
    showView(next);
    setOpen(true);
  };
  const panelPosition = positions[positionKey];
  const robotMenuStyle = robotMenuOpen && !open && panelPosition ? {
    left: Math.max(8 - panelPosition.left, Math.min(0, window.innerWidth - 248 - panelPosition.left)),
    ...(panelPosition.top < window.innerHeight / 2 && { top: 'calc(100% + 7px)', bottom: 'auto' }),
  } : undefined;
  const panelStyle = {
    '--ai-interface-scale': interfaceScale / interfaceScaleRange.default,
    '--ai-chat-scale': fontSize / defaultFontSize / (interfaceScale / interfaceScaleRange.default),
    '--ai-robot-size': `${mini ? 58 : robotSize}px`,
    ...(panelPosition && { ...panelPosition, right: 'auto', bottom: 'auto' }),
    ...(open && !compact && panelSize && {
      width: `min(${panelSize.width}px, calc(100vw - 16px))`,
      height: `min(${panelSize.height}px, calc(100dvh - 16px))`,
    }),
  };

  return <>
    <aside
      ref={assistantRef}
      hidden={inspect && !locked}
      style={panelStyle}
      className={`digital-assistant ${open ? 'is-open' : ''} ${compact ? 'is-compact' : ''} ${narrow ? 'is-narrow' : ''}`}
      aria-label="鸿眸助手"
    >
      {!open ? <>
        <button type="button" className="ai-robot-launch" aria-label="鸿眸助手" aria-controls={robotMenuOpen ? robotMenuId : undefined} aria-expanded={robotMenuOpen} title="单击设置，双击打开对话" {...dragHandlers} onClick={(event) => {
          if (suppressClick.current) { suppressClick.current = false; return; }
          if (event.detail < 2) setRobotMenuOpen((current) => !current);
        }} onDoubleClick={() => openFromRobot('chat')}><AssistantRobot {...petRobot} follow={robotFollow} state={alarmed ? 'alarm' : 'idle'} gesture={petGesture} size={robotSize} /></button>
        {robotMenuOpen && <section id={robotMenuId} className="ai-robot-menu" aria-label="机器人快捷设置" style={robotMenuStyle}>
          {renderRobotSize()}
          <div className="ai-robot-menu-actions ai-robot-menu-toggles">
            <button type="button" aria-pressed={mini} onClick={() => setPetDisplay({ mini: !mini })}>{mini ? '恢复大小' : '迷你模式'}</button>
            <button type="button" onClick={() => playPetAction('greet')}>打招呼</button>
          </div>
          <div className="ai-robot-menu-actions">
            <button type="button" onClick={() => openFromRobot('chat')}><MessageSquare size={15} />对话</button>
            <button type="button" onClick={() => openFromRobot('pet')}><Sparkles size={15} />养成</button>
            <button type="button" onClick={() => openFromRobot('pet-shop')}><ShoppingBag size={15} />商城</button>
            <button type="button" onClick={() => openFromRobot('settings')}><Settings2 size={15} />设置</button>
          </div>
        </section>}
      </> : <>
        <header className="ai-drag-handle" {...dragHandlers}>
          {compact ? <div><button type="button" className="ai-robot-settings" aria-label="机器人设置" title="机器人设置" onClick={() => { setCompact(false); showView('settings'); }}><AssistantRobot {...petRobot} state={robotState} /></button><strong>鸿眸助手</strong></div> : <>
            <button type="button" className="ai-header-action" aria-label="对话侧栏" title="对话侧栏" aria-expanded={showSidebar} onClick={() => {
              if (narrow) setSidebarOverlay(!sidebarOverlay);
              else { setSidebarCollapsed(!sidebarCollapsed); setSidebarOverlay(false); }
            }}><PanelLeft size={19} /></button>
            <strong className="ai-window-title" title={view === 'chat' ? chatTitle : undefined}>{view === 'chat' ? chatTitle : { alarms: '告警记录', 'alarm-report': '告警分析报告', settings: '助手设置', pet: '机器人养成', 'pet-shop': 'Token 商城' }[view]}</strong>
            <button type="button" className="ai-robot-settings" aria-label="机器人设置" title="机器人设置" onClick={() => showView(view === 'settings' ? 'chat' : 'settings')}><AssistantRobot {...petRobot} state={robotState} motion={!(view === 'pet' || (emptyChat && view === 'chat' && conversationView === 'chat'))} /></button>
          </>}
          {compact && <button className="ai-expand" onClick={() => setCompact(false)} aria-label="展开完整对话">展开</button>}
          {!compact && !showSidebar && <button type="button" className="ai-header-action" aria-label="新对话" title="新对话" onClick={startConversation}><SquarePen size={18} /></button>}
          <button className="ai-header-action" aria-label="助手设置" title="助手设置" onClick={() => {
            showView(view === 'settings' ? 'chat' : 'settings');
          }}><Settings2 size={19} /></button>
          <button className="ai-header-action" aria-label="关闭助手" title="关闭助手" onClick={() => {
            stopSpeech(); stopRecognition(); setListening(false); unlock(); setInspect(false); setCompact(false); setSidebarOverlay(false); setOpen(false);
          }}><X size={20} /></button>
        </header>
        {!compact && <button type="button" className="ai-resize-handle" aria-label="调整对话框大小" title="拖动调整对话框大小" {...resizeHandlers}><MoveDiagonal size={14} /></button>}
        <div className="ai-workspace">
        {showSidebar && <nav className="ai-sidebar" aria-label="对话侧栏">
          <div className="ai-sidebar-brand"><AssistantRobot size={27} motion={false} /><strong>鸿眸助手</strong></div>
          <button type="button" className="ai-new-chat" onClick={startConversation}><SquarePen size={16} />新对话</button>
          <div className="ai-sidebar-sections" role="group" aria-label="记录分类">
            <button type="button" aria-pressed={view === 'chat'} onClick={() => showView('chat')}>对话记录</button>
            <button type="button" aria-pressed={viewingAlarms} onClick={() => showView('alarms')}><Bell size={15} />告警记录</button>
            <button type="button" aria-pressed={view === 'pet'} onClick={() => showView('pet')}><Sparkles size={15} />养成</button>
            <button type="button" aria-pressed={view === 'pet-shop'} onClick={() => showView('pet-shop')}><ShoppingBag size={15} />商城</button>
          </div>
          {!viewingAlarms && <section className="ai-conversations" aria-label="历史对话">
            {!conversations.size && <p>暂无对话记录</p>}
            {[...conversations].map(([id, chat]) => (
              <button type="button" key={id} title={chat.title} aria-current={id === conversationId && view === 'chat' ? 'true' : undefined} onClick={() => openConversation(id)}>
                <MessageSquare size={15} aria-hidden="true" />
                <span>{chat.title}</span>
                <time dateTime={chat.updatedAt} title={timeLabel(chat.updatedAt)}>{new Date(chat.updatedAt).toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai', month: 'numeric', day: 'numeric' })}</time>
              </button>
            ))}
          </section>}
        </nav>}
        <div className="ai-main" hidden={narrow && showSidebar}>
        {!compact && view === 'chat' && <nav className="ai-conversation-tabs" aria-label="会话视图">
          <button type="button" aria-pressed={conversationView === 'chat'} onClick={() => setConversationView('chat')}>对话</button>
          <button type="button" aria-pressed={conversationView === 'trace'} onClick={() => setConversationView('trace')}>轨迹</button>
        </nav>}
        {view === 'pet' || view === 'pet-shop' ? <AssistantPetPanel view={view} pet={pet} preview={<AssistantRobot {...petRobot} follow={robotFollow} state={alarmed ? 'alarm' : 'idle'} gesture={petGesture} size={112} />} onAction={playPetAction} dispatch={dispatchPet} showView={showView} /> : view === 'settings' ? <section className="ai-qa-settings" aria-label="助手设置">
          <div className="ai-settings-scroll">
          <div className="ai-qa-settings-heading"><strong>桌面机器人</strong><button type="button" onClick={resetPetDisplay}><RotateCcw size={15} />恢复默认</button></div>
          {renderRobotSize()}
          <label className="ai-speech-setting">迷你模式<input type="checkbox" role="switch" checked={mini} onChange={(event) => setPetDisplay({ mini: event.target.checked })} /></label>
          <label className="ai-speech-setting">待机动画<input type="checkbox" role="switch" checked={robotIdle} onChange={(event) => setPetDisplay({ idle: event.target.checked })} /></label>
          <label className="ai-speech-setting">鼠标跟随<input type="checkbox" role="switch" checked={robotFollow} onChange={(event) => setPetDisplay({ follow: event.target.checked })} /></label>
          <label className="ai-speech-setting">锁定机器人位置<input type="checkbox" role="switch" checked={robotLocked} onChange={(event) => setPetDisplay({ locked: event.target.checked })} /></label>
          <div className="ai-qa-settings-heading"><strong>对话与播报</strong></div>
          <label className="ai-speech-setting"><Volume2 size={16} />自动播报回复<input type="checkbox" role="switch" checked={autoSpeak} onChange={(event) => changeAutoSpeak(event.target.checked)} /></label>
          <label className="ai-font-setting ai-speech-range">
            <span>播报语速</span><input type="range" min="0.6" max="1.8" step="0.05" value={speechRate} onChange={(event) => changeSpeechSetting(speechRateKey, event.target.valueAsNumber)} />
            <span className="ai-font-value">{speechRate.toFixed(2)}×</span>
          </label>
          <label className="ai-font-setting ai-speech-range">
            <span>播报音量</span><input type="range" min="0" max="1" step="0.05" value={speechVolume} onChange={(event) => changeSpeechSetting(speechVolumeKey, event.target.valueAsNumber)} />
            <span className="ai-font-value">{Math.round(speechVolume * 100)}%</span>
          </label>
          <div className="ai-voice-preview">
            <label>
              <span id={speechVoiceLabel}>播报音色</span>
              <select aria-labelledby={speechVoiceLabel} value={activeVoice} onChange={(event) => changeSpeechVoice(event.target.value)}>
                <option value="">自动（优先自然音色）</option>
                {speechVoices.length > 0 && <optgroup label="本机系统音色">
                  {speechVoices.map((voice) => <option key={voiceId(voice)} value={voiceId(voice)}>{voiceLabel(voice)}</option>)}
                </optgroup>}
                <optgroup label="平台音色">
                  {localVoices.map((voice) => <option key={voice.id} value={voice.id}>{voice.label}</option>)}
                </optgroup>
              </select>
            </label>
            <button type="button" onClick={() => {
              setNotice('');
              if (previewSpeaking && !speech.paused) stopSpeech();
              else speakReply(voicePreview);
            }}>
              {previewSpeaking && !speech.paused ? <Square size={16} /> : <Play size={16} />}{previewSpeaking ? speech.paused ? '继续试听' : '停止试听' : '试听音色'}
            </button>
            <small>自动模式优先使用系统音色。系统音色不可用时，使用平台音色。</small>
            {notice && <p role="status">{notice}</p>}
          </div>
          <label className="ai-font-setting">
            <span>对话字号</span>
            <input type="range" aria-valuetext={fontSize + ' 像素'} min={minFontSize} max={maxFontSize} value={fontSize} onChange={(event) => changeFontSize(event.target.valueAsNumber)} />
            <span className="ai-font-value" aria-hidden="true">{fontSize} px</span>
          </label>
          <label className="ai-font-setting">
            <span>界面缩放</span>
            <input type="range" min={interfaceScaleRange.min} max={interfaceScaleRange.max} step={5} value={interfaceScale} aria-valuetext={interfaceScale + '%'} onChange={(event) => changeInterfaceScale(event.target.valueAsNumber)} />
            <span className="ai-font-value" aria-hidden="true">{interfaceScale}%</span>
          </label>
          <div className="ai-qa-settings-heading"><strong>模拟场景</strong><button type="button" className="secondary" onClick={addQuestion}><Plus size={16} />添加场景</button></div>
          <div className="ai-qa-settings-list">
            {questionDraft.map((item, index) => <article className="ai-qa-item" key={item.id || index}>
              <header><strong>场景 {index + 1}</strong><div>
                <button type="button" aria-label={`场景${index + 1}上移`} title="上移" disabled={index === 0} onClick={() => moveQuestion(index, -1)}><ChevronUp size={17} /></button>
                <button type="button" aria-label={`场景${index + 1}下移`} title="下移" disabled={index === questionDraft.length - 1} onClick={() => moveQuestion(index, 1)}><ChevronDown size={17} /></button>
                <button type="button" aria-label={`删除场景${index + 1}`} title="删除" onClick={() => removeQuestion(index)}><Trash2 size={16} /></button>
              </div></header>
              <label>场景名称<input value={item.prompt} maxLength={80} placeholder={`场景${index + 1}`} onChange={(event) => updateQuestionDraft(index, { prompt: event.target.value })} /></label>
              <label>模拟回复<textarea value={item.answer} maxLength={1200} rows={4} placeholder="输入场景回复内容" onChange={(event) => updateQuestionDraft(index, { answer: event.target.value })} /></label>
              <label>场景分类<select value={item.kind || 'general'} onChange={(event) => updateQuestionDraft(index, { kind: event.target.value })}>{assistantScenarioOptions.map(([kind, label]) => <option key={kind} value={kind}>{label}</option>)}</select></label>
              <label>轨迹标题<input value={item.workflow.title} maxLength={100} onChange={(event) => editWorkflow(index, { title: event.target.value })} /></label>
              <ScenarioRows title="执行轨迹" name="步骤名称" result="步骤结果" rows={item.workflow.steps} onChange={(steps) => editWorkflow(index, { steps })} />
              <ScenarioRows title="任务清单" name="任务名称" rows={item.workflow.tasks} onChange={(tasks) => editWorkflow(index, { tasks })} />
              <ScenarioRows title="工具调用" name="工具名称" result="返回内容" rows={item.workflow.tools} onChange={(tools) => editWorkflow(index, { tools })} />
              <label className="ai-confirm-toggle"><input type="checkbox" checked={Boolean(item.needsConfirmation)} onChange={(event) => updateQuestionDraft(index, { needsConfirmation: event.target.checked })} />显示二次确认卡</label>
              {item.needsConfirmation && <details className="ai-scenario-group"><summary>二次确认卡</summary>
                {[['title', '卡片标题'], ['before', '当前状态'], ['value', '待确认内容'], ['reason', '说明']].map(([key, label]) => <label key={key}>{label}
                  <input value={item.workflow.confirmation[key]} maxLength={300} onChange={(event) => editWorkflow(index, { confirmation: { ...item.workflow.confirmation, [key]: event.target.value } })} />
                </label>)}
              </details>}
            </article>)}
          </div>
          </div>
          {qaError && <p className="ai-qa-error" role="alert">{qaError}</p>}
          <div className="ai-qa-settings-actions"><span>{questionsSaved ? '设置已保存到本机' : '有未保存的修改'}</span><button type="button" className="primary" disabled={questionsSaved} onClick={saveQuestions}>保存模拟场景</button></div>
        </section> : <>
          {target && <div className="ai-context-label" hidden={view !== 'chat' || conversationView === 'trace'}><span>已锁定：{target.slice(0, 130)}</span><button onClick={() => { unlock(); setCompact(false); setInspect(true); }}>重新选择</button></div>}

          {compact && (activeRun || nearbyRun) && <section className="ai-nearby-reply" aria-live="polite" aria-label="助手回复">
            {activeRun ? renderRun(activeRun.run, activeRun) : renderRun(nearbyRun)}
          </section>}

          {view === 'chat' && (compact || conversationView === 'chat') && <div className={`ai-chat-stage${emptyChat ? ' is-empty' : ''}`}>
            {emptyChat && <div className="ai-chat-welcome"><AssistantRobot {...petRobot} follow={robotFollow} state={robotState} size={92} /><h2>鸿眸助手</h2></div>}
            {!emptyChat && !compact && <div className="ai-messages" ref={logRef} aria-live="polite">
              {conversationRuns.map((run) => renderRun(run, run.id === activeRun?.run.id ? activeRun : null))}
              {!activeRun && displayedRuns.at(-1)?.id === pet.lastRun && <p className="ai-pet-reward"><Coins size={14} />+{petReward.xp} XP · +{petReward.tokens} Token 币</p>}
            </div>}
            <div className="ai-composer-area">
            {notice && <p className="ai-local-notice" role="status">{notice}</p>}
            <form className="ai-composer" onSubmit={(event) => { event.preventDefault(); submitQuestion(); }}>
              <textarea
                aria-label="向鸿眸助手提问"
                ref={inputRef}
                placeholder="编号或开头空格"
                maxLength={2000}
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={(event) => {
                  if (event.nativeEvent.isComposing) return;
                  if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submitQuestion(); }
                }}
              />
              <div className="ai-composer-tools">
                <button type="button" className="ai-pick-device" title="点选设备" aria-pressed={inspect} onClick={() => {
                  unlock(); setCompact(false); setInspect(!inspect);
                }}><MousePointer2 size={16} />点选设备</button>
                {questionPreview?.number != null && <span className="ai-question-route" title={questionPreview.entry?.prompt} aria-live="polite">{questionPreview.number} · {questionPreview.entry?.prompt || '未设置回复'}</span>}
                <button type="button" className={`ai-voice-button ${listening ? 'is-listening' : ''}`} aria-label={listening ? '停止语音输入' : '开始语音输入'} aria-pressed={listening} title={listening ? '停止语音输入' : '语音输入'} onClick={toggleVoice}><Mic size={18} /></button>
                {busy ? <button type="button" className="ai-stop-run" aria-label="停止生成" title="停止生成" onClick={stopRun}><Square size={15} /></button>
                  : <button type="submit" disabled={!question.length} aria-label="发送问题" title="发送问题"><ArrowUp size={19} /></button>}
              </div>
            </form>
            {emptyChat && <div className="ai-suggestions">{presets.map((item, index) => <button key={item.id} onClick={() => submitQuestion(`${index + 1} ${item.prompt}`)}><span>{index + 1}</span>{item.prompt}</button>)}</div>}
            </div>
          </div>}

          {view === 'chat' && !compact && conversationView === 'trace' && <section className="ai-trace" aria-label="会话轨迹">
            {!conversationRuns.length ? <div className="ai-trace-empty"><ListChecks size={25} /><p>暂无执行轨迹</p></div> : <ol className="ai-trace-list">
              {conversationRuns.map((run, index) => {
                const active = run.id === activeRun?.run.id ? activeRun : null;
                return <li key={run.id}>
                  <span className="ai-trace-index" aria-label={`第 ${index + 1} 轮`}>{String(index + 1).padStart(2, '0')}</span>
                  <div className="ai-trace-turn">
                    <div className="ai-trace-meta"><span>{run.scenario?.title || '处理记录'}</span><time dateTime={run.createdAt} title={timeLabel(run.createdAt)}>{replyTime(run.createdAt)}</time></div>
                    <h3>{run.prompt}</h3>
                    {run.target && <p className="ai-trace-context">上下文：{run.target}</p>}
                    {renderProcess(run, active?.step, active?.phase, index === conversationRuns.length - 1)}
                    {active && <button type="button" className="ai-trace-stop" onClick={stopRun}><Square size={13} />停止生成</button>}
                  </div>
                </li>;
              })}
            </ol>}
          </section>}

          {viewingAlarms && <section className="ai-alarm-page" aria-label={view === 'alarms' ? '告警记录' : '告警分析报告'}>
            {view === 'alarm-report' && <button className="ai-alarm-back" type="button" onClick={() => showView('alarms')}><ArrowLeft size={16} />返回告警记录</button>}
            {alarmSnapshot?.mode === dataMode && alarmSnapshot?.error && <p className="ai-alarm-notice" role="status">告警记录同步失败，正在重试。</p>}
            {view === 'alarms' && <>
              <div className="ai-alarm-page-heading"><h2>告警记录</h2>{alarmRecords && <span>{alarmRecords.length} 条</span>}</div>
              {!alarmRecords ? <p role="status">正在读取告警记录…</p> : !alarmRecords.length && !alarmSnapshot?.error && <p>暂无告警记录</p>}
              {!!alarmRecords?.length && <ul className="ai-alarm-list">
                {alarmRecords.map((row) => <li key={row.id}><button type="button" onClick={() => { setSelectedAlarmId(row.id); setAlarmRetry({}); showView('alarm-report'); }}>
                  <div><strong>{row.alarm.title || '设备告警'}</strong><small>{timeLabel(row.alarm.time || row.createdAt)} · {row.resolvedAt ? '已恢复' : '未恢复'}</small></div>
                  <span data-status={row.status}>{reportStatuses[row.status] || '等待分析'}</span><ChevronRight size={16} />
                </button></li>)}
              </ul>}
            </>}
            {view === 'alarm-report' && (selectedAlarm ? <article className="ai-alarm-report">
              <p className="ai-alarm-report-meta">{alarmModes[selectedAlarm.mode]} · {selectedAlarm.alarm.severity || '告警'} · {selectedAlarm.resolvedAt ? '已恢复' : '未恢复'}</p>
              <h2>{selectedAlarm.alarm.title || '设备告警'}</h2>
              <time dateTime={selectedAlarm.alarm.time || selectedAlarm.createdAt}>{timeLabel(selectedAlarm.alarm.time || selectedAlarm.createdAt)}</time>
              {selectedAlarm.alarm.detail && <section className="ai-alarm-evidence"><h3>告警依据</h3><p>{selectedAlarm.alarm.detail}</p></section>}
              <section className="ai-alarm-analysis" aria-label="分析与建议">
                <h3>分析与建议</h3>
                {selectedAlarm.status === 'completed' ? <ReportText text={selectedAlarm.answer} /> : selectedAlarm.status === 'failed' ? <>
                  <p role="status">分析未完成{selectedAlarm.error && '：' + selectedAlarm.error}</p>
                  <button className="ai-alarm-back" type="button" disabled={alarmRetry.pending} onClick={() => retryAlarmAnalysis(selectedAlarm.id)}>重试分析</button>
                  {alarmRetry.id === selectedAlarm.id && alarmRetry.error && <p role="alert">{alarmRetry.error}</p>}
                </> : <p role="status">{reportStatuses[selectedAlarm.status] || '等待分析'}…</p>}
              </section>
            </article> : <p role="status">{alarmRecords ? '当前数据模式下找不到这条告警。' : '正在读取告警记录…'}</p>)}
          </section>}
        </>}
        </div>
        </div>
      </>}
    </aside>
    {inspect && !locked && <button className="ai-pick-cancel" data-ai-ignore onClick={() => {
      unlock(); setInspect(false); setCompact(false); setOpen(true);
    }}>点击页面内容提问 · 退出点选（Esc）</button>}
    {inspect && hover && <button className="ai-hover" style={{ left: hover.x, top: hover.y }} onClick={lock}><Bot size={17} />点击锁定 · 问鸿眸助手</button>}
  </>;
}
