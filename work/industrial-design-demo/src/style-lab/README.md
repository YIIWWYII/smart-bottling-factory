# 工业数字孪生风格实验室

入口：`/styles-lab.html?style=1`。`style` 取值 1–49，与原视频顺序一致。

沿用项目的 React、Vite、Three.js、Lucide 及九工序装瓶产线模型。原来的数字展板、工位终端和运营管理入口仍在 `/index.html`。

## 本地运行

在 `work/industrial-design-demo` 目录运行：

```powershell
npm install
npm run dev -- --port 5176
```

然后打开 `http://127.0.0.1:5176/styles-lab.html`。构建命令为 `npm run build`，会同时输出原入口与风格实验室入口。

## 范围

- 49 套视觉方案，共用相同模拟数据，便于比较。
- 三维旋转与缩放、俯视、工艺视图、工位定位、暂停及复位。
- 设备筛选、能耗分布、告警确认、CSV 导出。
- 风格缩略图总览、搜索、分类、浏览器本地收藏。
- 第 25 / 44 套包含本地规则查询；第 44 套在浏览器支持并获得麦克风权限时可进行语音输入。
- 第 45 套支持选中设备的近景和金属、哑光、线框材质。
- 第 31 套包含滚动叙事，第 18 / 42 套支持按需展开工位遥测。

未连接真实设备、后端或大模型服务。告警确认仅改变本次页面会话的数据，不会向实际生产设备发送命令。

## 文件

- `themes.js`：49 种风格名称、配色、布局及分类。
- `main.jsx`：预览导航、数据视图和交互。
- `TwinScene.jsx`：可换材质的三维产线，复用 `../FactoryScene.jsx` 的设备建模。
- `styles.css`：基础排版、49 种差异化样式及移动端适配。
- `../../public/previews/`：49 张实际页面预览。
- `../../screenshots/style-lab-verification.json`：桌面、手机和交互验证结果。
