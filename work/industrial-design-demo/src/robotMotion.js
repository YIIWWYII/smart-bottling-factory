// Teaching asset identity is separate from the prepared protocol fixture.
export const robotBinding = {
  assetCode: 'MG400-TEACH-01',
  deviceId: 'PK-ARM-01',
  cycleSeconds: 8,
};

export function robotMotion(protocol, now = Date.now()) {
  const device = protocol?.devices?.find(d => d.id === robotBinding.deviceId);
  const point = name => device?.points?.find(p => p.name === name)?.value;
  const expiresAt = Number(device?.receivedAt || 0) + 10000;
  const online = !!protocol?.enabled && !!device?.online && now < expiresAt;
  const pickRate = Number(point('pickRate'));
  const validRate = Number.isFinite(pickRate) && pickRate >= 2 && pickRate <= 30;
  const running = online && validRate && point('runState_feedback') === 1;
  return {online, running, expiresAt, rate: running ? pickRate * robotBinding.cycleSeconds / 60 : 0};
}
