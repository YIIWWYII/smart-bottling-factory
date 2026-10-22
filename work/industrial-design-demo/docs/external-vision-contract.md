# 外部整瓶视觉服务交接

## USB相机配置

工程管理 → AI视觉 → 连接USB摄像头：搜索摄像头（自动准备本机采集） → 逐台预览 → 分配顶部及三个侧面 → 保存。未分配机位保存为空，不算四路齐全。

本机采集端口8097，与AI检测服务分开。搜索时在平台服务器上调用Python，需安装opencv-python；可用CAPTURE_PYTHON指定Python可执行文件。手动启动：`python vision/camera_capture.py`。本机默认只监听127.0.0.1；局域网使用需在受信网络手动指定`--host 0.0.0.0`并配置防火墙，平台中改填采集电脑地址。本采集服务无认证，不应暴露公网。

当前发现前8个OpenCV设备编号，默认640×480低帧率预览，编号不是稳定序列号；拔插重启后必须预览复核。设备空闲约20秒释放；画面和snapshot可供外部视觉服务采集，不代表已完成同步触发或AI识别。HTTPS页面访问HTTP采集流还需同源网关或HTTPS部署。

视觉服务完成采集、时钟和输送延迟校正、同瓶归组、展开、模型推理及整瓶判定。平台不执行视觉算法。相机地址在平台用于预览；外部服务的实际采集源由视觉岗独立配置。

平台 AI 视觉页保存一个服务地址、令牌及版本，保存后使用 whole-bottle 模式。旧配置在保存前仍兼容历史机位调用方式。模型部署由视觉岗完成，平台支持上传交付文件并请求服务加载验证。

## 单次样例

- GET /health：返回 status=ready、contract=bottleworks-vision-v1、version。
- POST /inspect：接收 requestId、batchId、bottleId、images[{cameraId,data}]。data为图片Data URL。机位为 top、side-0、side-120、side-240。
- 返回同一组编号及 cameras[{cameraId,status,reason,imageUrl,overlayUrl,heatmapUrl}]、verdict(pass/review/reject)、reason、version、demo。
- 联合检测可补充 body/cap:{status,reason}、coverageComplete、modelsReady、panoramaUrl、overlayUrl、heatmapUrl、durationMs。durationMs必须表示采集至整瓶结果的端到端耗时，不能填单次推理耗时。未提供则平台显示未提供。
- 图片地址必须是浏览器可访问的绝对HTTP(S)地址或图片Data URL，不能返回容器内路径。
- 平台保留服务判定；四路通过不覆盖整体复检。声称通过但机位缺失、区域不完整或模型未就绪的结果拒绝入库。

## 连续任务（视觉岗需实现）

health.capabilities包含 inspection-jobs-v1 才允许使用。当前平台已实现客户端，不代表现有Python服务已支持这些接口。

- POST /jobs/start，输入 requestId、batchId。服务负责去重，返回 jobId、batchId、status。
- GET /jobs/{jobId}，返回相同编号、status、results数组；数组中每条是上述完整检测结果，瓶号由采集服务生成。服务应保留任务结果，供页面关闭后重新同步。
- POST /jobs/{jobId}/stop，输入{}，停止视觉采集任务，返回实际状态，不控制机械臂或产线。
- status支持 starting/running/stopping/stopped/completed/failed。错误用非2xx响应，不伪造成功。

任务运行于外部服务，关闭网页不停止任务。平台保存任务ID，通过“查询任务并同步结果”拉取记录，按requestId去重；当前保留最近200条。工程管理及外观检测共用只读接口 GET /api/ai/integrations/vision-monitor，页面可见时约每2.5秒刷新，服务端合并重复查询并同步外部任务结果。关闭所有页面后不主动拉取，重新打开后继续同步；正式大量生产记录需要另行接入持久化结果流。

记录可携带stageIndex：2为外观检测，5为二次检测；旧记录未提供时归外观检测，不在二次检测冒用。相机地址只在工程管理配置，工位终端只展示。

跨电脑服务地址不能填写对方的localhost。认证令牌由后端转发，不下发浏览器。界面截帧仅用于静态同瓶样例的接口测试，不保证运动产线的四路同步。


## 平台模型与程序槽位

工程管理先添加模型，再添加程序；每类均可新增多项，自定义名称并选择或上传文件，不预设算法。
`/packages/load` 请求携带 `slot`（model / program）与 `packageId`；兼容历史 yolo / patchcore 槽位。
服务应验证文件类型及依赖，注册 packageId；返回 ready 代表加载完成，不能仅代表收到了文件。
平台不会直接执行上传脚本。检测程序需要先部署为兼容 HTTP 服务，可部署在平台电脑。
`/inspect` 与 `/jobs/start` 携带 `assets: {models: [{id, name, packageId}], programs: [{id, name, packageId}]}`；旧配置兼容 `{yolo, patchcore, program}`。
服务须按这些 ID 使用模型和程序；不支持或未加载时应返回错误，不能静默使用别的模型。
同一条结果可提供 `panoramaUrl`（展开并遮罩码区）、`overlayUrl`（缺陷标注）、`heatmapUrl`（异常热力图）、`verdict`、`reason` 与瓶号、批次、时间。图像类型与具体算法无绑定关系。
缺图时界面显示等待，不从其他检测记录拼接结果。当前上传接口单文件上限 24 MB。
