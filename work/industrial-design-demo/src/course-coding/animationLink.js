export function advanceAnimation(mixer, seconds, state) {
  // 练习三：8 秒一次动作，原速对应 60 / 8 = 7.5 次/分钟。
  const baseRate = state.baseRate || 7.5;
  if (!state.online || !state.running || !Number.isFinite(state.rate)) return;
  const speed = state.rate / baseRate;
  if (speed <= 0) return;
  // 停止时不推进动画时间；这是预制动作驱动，不是实物关节回传。
  mixer.update(seconds * Math.min(speed, 100));
}
