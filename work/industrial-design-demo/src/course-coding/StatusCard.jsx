export default function StatusCard({state}) {
  // 练习一：用设备数据制作状态卡，不写死运行状态。
  return <section className="status-card">
    <h2>机械臂 · 通信状态</h2>
    <dl>
      <div><dt>通信设备</dt><dd>{state.deviceId}</dd></div>
      <div><dt>连接状态</dt><dd>{state.online ? '在线' : '离线 / 数据过期'}</dd></div>
      <div><dt>运行反馈</dt><dd>{!state.online ? '未知' : state.running ? '运行' : '停止'}</dd></div>
      <div><dt>节拍设定</dt><dd>{state.rate ?? '—'} 瓶/min</dd></div>
      <div><dt>夹持力回读</dt><dd>{state.gripForce ?? '—'} N</dd></div>
    </dl>
  </section>;
}
