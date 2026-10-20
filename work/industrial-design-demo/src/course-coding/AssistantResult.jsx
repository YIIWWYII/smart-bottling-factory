export default function AssistantResult({execution}) {
  // 只展示交付服务返回的记录，不把“请求成功”改写成“设备执行成功”。
  if (!execution) return <p>请先选择一份助手执行记录。</p>;
  return <section className="assistant-result">
    <h2>产线助手 · 执行结果</h2>
    <p>任务：{execution.id} ｜ 状态：{execution.status} ｜ 来源：{execution.source}</p>
    <p>执行时间：{execution.time} ｜ {execution.reason}</p>
    <table><thead><tr><th>操作</th><th>设定值</th><th>回读值</th><th>结果</th></tr></thead>
      <tbody>{execution.operations.map(item => <tr key={item.id}>
        <td>{item.title}</td><td>{item.value} {item.unit}</td>
        <td>{item.readback ?? '未取得'} {item.unit}</td><td>{item.result}</td>
      </tr>)}</tbody>
    </table>
  </section>;
}
