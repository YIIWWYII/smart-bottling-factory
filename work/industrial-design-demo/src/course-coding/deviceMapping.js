export function mapDevice(protocol, now = Date.now(), binding = {}) {
  // 练习二：按编号找到设备，再按点位名读取，不能依赖列表顺序。
  const deviceId = binding.deviceId || 'PK-ARM-01';
  const device = protocol?.devices?.find(item => item.id === deviceId);
  const read = name => device?.points?.find(point => point.name === name)?.value;
  const age = now - (device?.receivedAt ?? 0);
  const online = Boolean(protocol?.enabled && device?.online && age >= 0 && age < 10000);
  const rateValue = binding.ratePoint === '' ? (binding.baseRate || 7.5) : read(binding.ratePoint || 'pickRate');
  const rate = online && Number.isFinite(rateValue) ? rateValue : null;
  const running = online && read(binding.runPoint || 'runState_feedback') === 1;
  const gripper = protocol?.devices?.find(item => item.id === 'PK-GRIP-01');
  const gripOnline = protocol?.enabled && gripper?.online && now - (gripper.receivedAt ?? 0) >= 0 && now - (gripper.receivedAt ?? 0) < 10000;
  const gripForce = gripOnline ? gripper.points?.find(point => point.name === 'gripForce')?.value ?? null : null;
  return {deviceId, online, running, rate, baseRate: binding.baseRate || 7.5,
    animationName: binding.animationName || '', gripForce};
}
