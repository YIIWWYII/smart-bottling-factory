# 第十四课：Python视觉识别

## 本节学习路线

### 这是什么

Python视觉服务负责拍照、识别瓶型、检测瓶盖瓶身瓶底缺陷，并把结构化结果交给Spring Boot。它不负责最终放行或直接控制剔除设备。

### 为什么要学

摄像头识别是流程进入后端的事实来源，但模型可能低置信度、相机可能离线、光线可能变化。因此必须把拍摄条件、模型结果、UNKNOWN和后端规则一起设计。

### 它在项目中的位置

相机和到位传感器 → Python OpenCV和模型 → FastAPI视觉服务 → Spring Boot → 状态机、数据库、MQTT和三个界面。

### 需要的软件与安装

- Python 3.x：安装到E盘或使用E盘虚拟环境。
- VS Code：编辑Python。
- OpenCV和模型依赖：安装到视觉虚拟环境。
- FastAPI和Uvicorn：运行HTTP视觉服务。
- 相机驱动：根据实际型号安装官方驱动。
- 标注工具：选择一种，数据集放E盘。

创建E盘虚拟环境vision-env。模型、数据集、缓存和图片统一放bottling-data、bottling-models和hdc_runtime/files/vision。相机型号未知时不能编造驱动安装步骤，必须先拿到型号和说明书。

### 最小例子

先不接摄像头和模型，FastAPI固定返回一条PASS JSON。Spring Boot成功接收后，再把固定结果替换为测试图片推理，最后才接实时摄像头。

### 项目实操顺序

1. 固定相机、距离、角度、背景和补光。
2. 建立normal、缺陷、train、val、test数据目录。
3. 写缺陷标注标准。
4. 按样品而不是视频相邻帧划分数据。
5. 先完成离线图片推理。
6. 创建FastAPI健康接口。
7. 创建固定结果检测接口。
8. Spring Boot接收并保存inspection_result。
9. 接入真实模型。
10. 接入摄像头到位触发。
11. 低置信度返回UNKNOWN。
12. 后端按PASS、FAIL、UNKNOWN推进状态机。

### 视觉调试怎么做

- 相机打不开：查设备编号、驱动、USB权限和是否被其他程序占用。
- 图片全黑或反光：先调曝光、补光和背景，不先换模型。
- 模型结果漂移：检查位置、光线、样品和训练测试划分。
- FastAPI不能访问：查虚拟环境、Uvicorn端口8091和防火墙。
- 后端未收到结果：用PowerShell调用视觉接口，区分视觉服务问题和后端问题。
- 缺陷被错误放行：检查Spring Boot是否把视觉结果送进状态机，而不是页面自行判断。

### 如何与下一节连接

第15课的AI可以读取视觉识别出的瓶型和缺陷，但不能覆盖视觉事实；第16课用正常图片、缺陷图片和相机离线场景进行完整彩排。

### 通过门禁

测试图片能返回稳定结构化结果，低置信度进入UNKNOWN，相机和视觉服务失败不会自动放行，检测记录和缺陷图片能在管理端和大屏看到。

## 学习目标

- 区分瓶型识别与瑕疵检测。
- 根据任务选择分类、目标检测、分割或规则算法。
- 设计稳定的相机、灯光、背景和触发条件。
- 建立数据采集、标注、训练、验证和测试流程。
- 通过FastAPI向Spring Boot返回结构化结果。

## 完整视觉流程

```text
瓶子到达检测位置
→ 到位传感器触发
→ 摄像头拍照
→ OpenCV读取和预处理
→ 模型推理
→ 置信度与规则判断
→ 保存缺陷图片
→ 向Spring Boot提交JSON
→ 后端状态机决定放行、剔除或复核
```

视觉模型负责看，生产状态机负责决定下一步。

## 两类视觉任务

### 瓶型识别

回答“这是什么瓶子”：

```text
PLA-330
PLA-500
UNKNOWN
```

结果用于选择工艺方案、灌装量、传送带速度和装箱参数。

### 瑕疵检测

第一版建议范围：

```text
CAP_MISSING       缺瓶盖
CAP_TILTED        瓶盖歪斜
BODY_DENT         瓶身变形
BODY_SCRATCH      瓶身划痕
BOTTOM_DEFORMED   瓶底变形
FILL_LEVEL_LOW    液位不足
FILL_LEVEL_HIGH   液位过高
```

不承诺第一版识别工厂全部缺陷。

## 模型选择

- 固定位置识别瓶型：图像分类。
- 找出已知缺陷位置：目标检测。
- 精确描出划痕区域：图像分割。
- 检测未见异常：异常检测。
- 固定相机液位：规则检测或目标检测。

第一版推荐：

```text
瓶型：分类模型
明确缺陷：YOLO目标检测
液位：固定相机规则或YOLO
```

分割与开放式异常检测作为后续提升。

## 拍摄条件比模型更先解决

稳定性取决于：

- 瓶子位置是否固定。
- 相机角度、距离和焦距是否固定。
- 灯光是否稳定。
- 背景是否干净。
- 反光是否被控制。
- 运动是否模糊。
- 缺陷是否能从当前角度看见。

检测区建议：

- 固定背景板和遮光结构。
- 固定LED补光。
- 到位后短暂停带拍摄。
- 光电开关或位置传感器触发。
- 锁定曝光、焦距和白平衡。
- 不依赖教室环境光。

## 瓶盖、瓶身和瓶底

### 瓶盖

- 斜上方或正面相机。
- 检测有无、歪斜、偏移和明显损坏。
- 视觉不能可靠证明拧紧扭矩或完全不漏液。
- 真实密封性需要扭矩、压力或泄漏检测。

### 瓶身

- 侧面相机检测凹陷、划痕、污渍、标签偏移、变形和液位。
- 单相机只能看见一侧。
- 全周检测需要旋转瓶子或多相机。

### 瓶底

- 底部相机、透明支撑、镜面或翻转结构。
- 机械结构暂时不成熟时，可设置固定瓶底检测位置并保留软件工位记录。

## 瓶型与瓶子身份

- 视觉识别`PLA-500`是瓶型。
- `BOT-20260719-0008`是唯一瓶子身份。

追踪方法：

- 二维码或条码。
- RFID。
- PLC工位队列。
- 传送带顺序和位置追踪。

第一版最稳：二维码获得`traceCode`，视觉获得`bottleType`和`defects`。

## 数据采集

第一版范围：

- 两种瓶型。
- 四至六种缺陷。
- 正常瓶与不同缺陷实物。
- 不同但受控的角度和亮度变化。

每类可先采集约100至300张相对独立图片作为起点，再根据验证结果补充。数量不保证效果，实际样品覆盖更重要。

## 数据集划分

```text
训练集约70%
验证集约20%
测试集约10%
```

- 不把同一视频相邻帧随机分到训练和测试。
- 按实际瓶子或采集批次划分。
- 测试集包含模型未见过的实物样品。

## 标注规范

目标类别：

```text
cap_missing
cap_tilted
body_dent
body_scratch
bottom_deformed
```

标注前统一：

- 什么程度算缺陷。
- 一个缺陷画一个框还是多个框。
- 遮挡时是否标注。
- 模糊图片是否保留。
- 类别名称与大小写。

所有标注人员使用同一规则。

## 置信度与UNKNOWN

示例：

```text
PLA-500：0.92
PLA-330：0.06
其他：0.02
```

不能永远强制选择最高项。

```text
置信度≥0.80：接受候选结果
置信度<0.80：返回UNKNOWN
```

- 阈值通过验证集调整。
- `UNKNOWN`进入`HOLD`和人工复核，不自动放行。

## Python视觉服务

技术组成：

```text
Python
OpenCV
训练模型
FastAPI
```

数据模型：

```python
from pydantic import BaseModel

class DefectResult(BaseModel):
    defect_type: str
    confidence: float
    box: list[float]

class InspectionResult(BaseModel):
    inspection_id: str
    trace_code: str
    bottle_type: str
    bottle_confidence: float
    result: str
    defects: list[DefectResult]
    image_url: str | None
    processing_ms: int
```

结果：

```json
{
  "inspectionId": "VIS-0008",
  "traceCode": "BOT-0008",
  "bottleType": "PLA-500",
  "bottleConfidence": 0.94,
  "result": "FAIL",
  "defects": [
    {
      "defectType": "CAP_TILTED",
      "confidence": 0.91,
      "box": [120, 40, 210, 105]
    }
  ],
  "imageUrl": "/files/vision/VIS-0008.jpg",
  "processingMs": 86
}
```

## 与Spring Boot交互

### 后端主动调用

```text
到位事件进入Spring Boot
→ Spring Boot调用视觉服务
→ 视觉服务拍摄和识别
→ 返回结果
```

### 视觉服务主动上报

```text
视觉电脑收到硬件触发
→ 识别
→ 调用Spring Boot接口上报
```

第一版可采用主动上报，便于相机和模型在一台电脑调试。

## 后端决定PASS或FAIL

- 视觉服务返回缺陷、置信度和位置。
- Spring Boot根据瓶型工艺、阈值和状态机决定放行、剔除或复核。
- 视觉模型不能直接发布剔除器MQTT命令。

```text
视觉结果
→ Spring Boot保存检测
→ 状态机判断
→ 生成剔除或放行命令
```

## 保存数据

- 瓶子追踪号。
- 检测工位和时间。
- 瓶型和置信度。
- 缺陷类别、位置和置信度。
- 最终结果。
- 模型版本和处理耗时。
- 缺陷图片路径。

正常图片抽样保存，缺陷图片重点保存；数据库不保存大量图片二进制。

## 模型评价

- Precision：报出的缺陷有多少是真的。
- Recall：真实缺陷有多少被发现。
- False Accept：缺陷瓶被错误放行。
- False Reject：正常瓶被错误剔除。

质量检测中，缺陷瓶错误放行通常风险更高。

测试包含：

- 正常样品。
- 每类缺陷。
- 未见样品。
- 光线变化。
- 相机断开。

## E盘存储

```text
E:\dev\vision-env
E:\bottling-data
E:\bottling-models
E:\hdc_runtime\files\vision
```

Python环境、模型、数据集和缓存不放C盘。

## 失败与降级

### 相机离线

- 检测工位`FAULT`。
- 禁止自动放行。
- 通知工位屏和大屏。

### UNKNOWN

- 瓶子`HOLD`。
- 等待人工复核。

### 模型服务崩溃

- 后端超时。
- 停止视觉自动放行。
- 演示备用可以使用本地预拍图片，但明确标识降级。

### 现场光线变化

- 使用固定遮光与补光，不依赖场地灯光。

## 实操作业

- 固定相机、背景、距离和补光。
- 确定两种瓶型和四至六种缺陷。
- 编写标注规则。
- 采集并划分数据。
- 完成瓶型分类与缺陷检测基础模型。
- OpenCV获取摄像头图像。
- 建立FastAPI服务。
- 向Spring Boot提交结果。
- 测试正常、缺陷、UNKNOWN、相机离线和模型超时。
- 在管理端和大屏显示缺陷图片。

## 验收标准

- 准备的正常和缺陷样品可稳定演示。
- 结果绑定正确瓶子。
- 低置信度进入UNKNOWN。
- 缺陷触发后端剔除流程。
- 每次识别有记录和图片依据。

视觉首先依赖稳定相机、灯光、位置和样品，模型无法弥补完全失控的拍摄条件。

## 具体实操：从一张图片到后端检测结果

### 步骤1：固定拍摄工位

先不要训练模型，先固定：

```text
相机高度
相机角度
瓶子到镜头距离
传送带停止位置
背景颜色
补光灯位置
```

用胶带标出瓶子摆放位置，连续拍10张同一个正常瓶，观察轮廓和亮度是否基本一致。

### 步骤2：建立数据目录

```text
E:\bottling-data
├─ raw
│  ├─ normal
│  ├─ cap_tilted
│  ├─ body_scratch
│  └─ bottom_deformed
├─ labeled
├─ train
├─ val
└─ test
```

每张图片命名包含样品编号和拍摄角度，例如：

```text
sample03_front_001.jpg
sample03_side_001.jpg
```

### 步骤3：采集正常与缺陷图片

每类先准备多只实际样品，而不是只拍一只瓶子的不同帧。

采集记录：

```text
图片名 | 瓶型 | 缺陷类别 | 样品编号 | 相机位置 | 光照 | 是否可用
```

模糊、遮挡严重或不符合实际演示的图片单独标记，不要悄悄混入训练集。

### 步骤4：写标注规则

在训练前先确定：

```text
瓶盖偏离中心多少算CAP_TILTED
划痕多长或多深算BODY_SCRATCH
瓶底什么变形程度算BOTTOM_DEFORMED
液位上下限如何判断
```

三个人分别标注同一批图片，比较分歧，统一规则后再正式标注。

### 步骤5：划分数据集

按样品编号划分，不按相邻视频帧随机划分：

```text
样品01～10：train
样品11～13：val
样品14～15：test
```

测试集在训练过程中不打开，最后只用于评价。

### 步骤6：先做离线图片推理

先不要接摄像头。使用几张测试图片调用模型，输出：

```text
图片路径
预测瓶型
瓶型置信度
缺陷类别
缺陷置信度
框坐标
耗时
```

检查模型是否能正确识别正常、缺陷和UNKNOWN。

### 步骤7：建立Python环境

环境和缓存放E盘：

```powershell
python -m venv E:\dev\vision-env
E:\dev\vision-env\Scripts\Activate.ps1
$env:PIP_CACHE_DIR='E:\dev\pip-cache'
```

安装OpenCV、FastAPI、Uvicorn和你们选定的模型依赖。不要把训练数据和模型放到项目的`node_modules`或Java目录。

### 步骤8：先写固定结果API

创建视觉服务前，先用固定JSON验证后端接口：

```json
{
  "inspectionId": "VIS-TEST-001",
  "traceCode": "BOT-TEST-001",
  "bottleType": "PLA-500",
  "bottleConfidence": 0.94,
  "result": "PASS",
  "defects": [],
  "imageUrl": "/files/vision/VIS-TEST-001.jpg",
  "processingMs": 50
}
```

先让Spring Boot成功接收，再替换固定结果为真实推理。

### 步骤9：创建FastAPI接口

接口输入：

```text
traceCode
imagePath或图片上传
inspectionStation
```

接口输出必须固定字段：

```text
inspectionId
traceCode
bottleType
bottleConfidence
result
defects
imageUrl
processingMs
modelVersion
```

启动服务：

```powershell
uvicorn main:app --host 0.0.0.0 --port 8091
```

健康检查：

```text
http://localhost:8091/health
```

### 步骤10：接入摄像头

1. 用OpenCV打开指定摄像头编号。
2. 读取一帧并保存到`E:\hdc_runtime\files\vision`。
3. 检查图片宽高和清晰度。
4. 调用模型推理。
5. 保存缺陷结果图片。
6. 返回结构化JSON。

相机打开失败时，服务必须返回明确错误，不返回假的PASS。

### 步骤11：接入Spring Boot流程

```text
到位事件
→ 后端生成inspectionId
→ 调视觉服务
→ 保存inspection_result
→ 根据PASS/FAIL/UNKNOWN推进状态机
→ 需要剔除时由后端发MQTT
→ WebSocket通知页面
```

### 步骤12：设置置信度阈值

先规定：

```text
瓶型置信度<0.80：UNKNOWN
缺陷检测置信度<0.70：人工复核
```

用测试集统计误放行和误剔除，再调整阈值。所有阈值写入配置或数据库，不要散落在代码中。

### 步骤13：测试五种情况

```text
正常瓶：PASS
明确缺陷：FAIL并记录框
低置信度：UNKNOWN并HOLD
相机断开：检测工位FAULT
视觉服务超时：禁止自动放行
```

### 步骤14：检查前端展示

- 管理端显示检测结果和图片路径。
- 大屏显示通过率和缺陷统计。
- 工位屏显示当前瓶子、结果和报警。
- 三个界面使用同一个`inspectionId`和`traceCode`。

### 本课完成标志

- 能从测试图片得到结构化结果。
- FastAPI服务能健康检查。
- Spring Boot能接收并保存检测结果。
- 缺陷、UNKNOWN、相机离线和服务超时都不会错误放行。
- 缺陷图片可在管理端和大屏展示。

## 保姆式实操：从零建立 E 盘 Python 视觉服务

### 第 1 步：检查 Python 和相机

~~~powershell
python --version
python -c "import sys; print(sys.executable)"
~~~

建议使用 Python 3.10 或 3.11。若系统 Python 版本不匹配，安装时选择自定义路径，例如 E:\dev\Python311，不要覆盖其他项目的 Python。

相机先不接算法，先验证 OpenCV：

~~~powershell
python -c "import cv2; print(cv2.__version__)"
~~~

没有相机时使用测试图片，流程不应被硬件阻塞。

### 第 2 步：创建虚拟环境

~~~powershell
New-Item -ItemType Directory -Force 'E:\dev\python-envs' | Out-Null
python -m venv 'E:\dev\python-envs\bottling-vision'
& 'E:\dev\python-envs\bottling-vision\Scripts\Activate.ps1'
$env:PIP_CACHE_DIR='E:\dev\pip-cache'
python -m pip install --upgrade pip --cache-dir $env:PIP_CACHE_DIR
python -m pip install fastapi uvicorn opencv-python pydantic python-multipart --cache-dir $env:PIP_CACHE_DIR
~~~

每次打开新终端都要重新激活。看到命令行前出现 bottling-vision 才能继续。

### 第 3 步：先做固定结果 API

建立目录：

~~~powershell
New-Item -ItemType Directory -Force 'E:\bottling-ai\vision','E:\bottling-ai\vision\images','E:\bottling-ai\vision\models','E:\bottling-ai\vision\logs'
Set-Location 'E:\bottling-ai\vision'
~~~

先实现 /health 和 /vision/inspect 两个接口，/vision/inspect 暂时返回固定 JSON。启动：

~~~powershell
python -m uvicorn main:app --host 0.0.0.0 --port 8091 --reload
~~~

另开窗口验证：

~~~powershell
Invoke-RestMethod 'http://127.0.0.1:8091/health'
~~~

必须先看到健康响应，再接模型。

### 第 4 步：接入摄像头和模型

1. 使用 cv2.VideoCapture(0) 打开默认相机。
2. 判断 ret 是否为真。
3. 保存原图到 E:\bottling-ai\vision\images。
4. 调用检测函数。
5. 返回 inspectionId、traceCode、bottleType、confidence、result、defects、imageUrl。
6. 相机打不开时返回 CAMERA_OFFLINE，不能返回 PASS。

先实现 CAP_MISSING、CAP_TILTED、BODY_DENT、BODY_SCRATCH、BOTTOM_DEFORMED 五类结果。每完成一类，都测试正常样本、明确缺陷样本和低置信度样本。

### 第 5 步：Spring Boot 接入和失败回退

~~~text
视觉结果
→ Spring Boot 校验 inspectionId 和 traceCode
→ 保存检测记录和图片地址
→ 状态机判断 PASS/FAIL/UNKNOWN
→ 只有后端生成剔除命令
~~~

视觉服务停机、超时、非法 JSON、置信度过低时，后端进入 HOLD，不允许自动放行。先通过固定图片 API，再通过摄像头采图，再通过模型，再接真实传送带，一次只增加一个变量。
