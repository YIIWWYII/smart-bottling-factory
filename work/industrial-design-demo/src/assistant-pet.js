export const petStorageKey = 'hongmou-assistant-pet';
export const petSizeRange = { min: 48, max: 320, default: 176 };
export const petReward = { xp: 20, tokens: 10 };
export const petLevelXp = 60;
export const petActions = [
  { id: 'greet', title: '打招呼', level: 1 },
  { id: 'scan', title: '环视巡检', level: 2 },
  { id: 'dance', title: '庆祝摇摆', level: 3 },
  { id: 'boost', title: '动力起跳', level: 4 },
];
export const petAttributes = { energy: '体力', bond: '默契', condition: '维护值' };
export const petShop = {
  battery: { name: '充能电池', kind: 'supply', price: 10, attribute: 'energy', amount: 25 },
  oil: { name: '维护工具包', kind: 'supply', price: 15, attribute: 'condition', amount: 30 },
  chip: { name: '默契芯片', kind: 'supply', price: 20, attribute: 'bond', amount: 20 },
  beacon: { name: '巡检灯', kind: 'gear', price: 25, detail: '顶部双灯' },
  headset: { name: '通讯耳罩', kind: 'gear', price: 35, detail: '两侧通讯模块' },
  amber: { name: '琥珀工装', kind: 'outfit', price: 30, detail: '暖橙机壳' },
  mint: { name: '薄荷工装', kind: 'outfit', price: 40, detail: '薄荷绿机壳' },
};
export const petDisplayDefaults = { size: petSizeRange.default, mini: false, idle: true, locked: false };
const initialPet = {
  xp: 0, tokens: 0, rounds: 0, lastRun: '', energy: 70, bond: 20, condition: 80,
  bag: {}, gear: null, outfit: null, display: petDisplayDefaults,
};
const clampStat = (value) => Math.max(0, Math.min(100, value));
export const petLevel = (xp) => Math.floor(xp / petLevelXp) + 1;

export function readPet() {
  try {
    const saved = JSON.parse(localStorage.getItem(petStorageKey));
    if (saved) return { ...initialPet, ...saved, display: { ...petDisplayDefaults, ...saved.display } };
  } catch {}
  return initialPet;
}

export function updatePet(pet, { type, id, value }) {
  if (type === 'reward' && id && id !== pet.lastRun) return {
    ...pet, lastRun: id, xp: pet.xp + petReward.xp, tokens: pet.tokens + petReward.tokens, rounds: pet.rounds + 1,
    energy: clampStat(pet.energy - 2), bond: clampStat(pet.bond + 4), condition: clampStat(pet.condition - 1),
  };
  if (type === 'display') return { ...pet, display: { ...pet.display, ...value } };
  if (type === 'rest') return { ...pet, energy: clampStat(pet.energy + 8) };
  const item = Object.hasOwn(petShop, id) ? petShop[id] : null;
  if (!item) return pet;
  const count = pet.bag[id] || 0;
  if (type === 'buy' && pet.tokens >= item.price && (item.kind === 'supply' || !count)) return {
    ...pet, tokens: pet.tokens - item.price, bag: { ...pet.bag, [id]: count + 1 },
  };
  if (type === 'use' && count && item.kind === 'supply' && pet[item.attribute] < 100) return {
    ...pet, [item.attribute]: clampStat(pet[item.attribute] + item.amount), bag: { ...pet.bag, [id]: count - 1 },
  };
  if (type === 'equip' && count && item.kind !== 'supply') return { ...pet, [item.kind]: pet[item.kind] === id ? null : id };
  return pet;
}
