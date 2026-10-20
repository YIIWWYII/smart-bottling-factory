# 工艺视图：新粗野主义三渲二样稿

## 页面分工
- 饮料视图：今日饮料及历史生产总览 → 单款饮料介绍与生产详情。
- 工艺视图：以整条产线及设备为主体，工艺关系优先，不做厂房漫游。
- 当前仅交付场景视觉样稿，未更换前端、未接实时数据、未添加动画。

## 文件
- concept-lovart.png：Lovart 生成的方向参考，项目 https://www.lovart.ai/canvas?projectId=2rvmi6isyx34 。参考图编号不是最终工艺编号。
- process-neobrutalism.blend：独立 Blender 5.2.1 场景。
- process-render.png：最终静态样稿，2400×1350。
- build_scene.py：从原有 factory_realistic.blend 复用设备几何、重排产线、新建连接输送带与管线、瓶子阵列和运输路线。
- refine.py：最终配色、材质和相机调整。重建顺序为先 build_scene.py，后在生成的 blend 上执行 refine.py。

## 工艺编号
01 瓶体预处理 → 02 气体检测 → 03 视觉检测 → 05 灌装 → 06 二次检测 → 07 装箱 → 08 AGV → 09 仓储。
04 饮料准备通过独立料液管路汇入 05。

## 样稿边界
采用透视相机、Eevee Shader to RGB 分段色阶和反向外壳描边。设备按工序分组，静态瓶子表示工艺流向，不表示正在生产。空间排列用于界面展示，不是硬件施工布局。原始 factory_realistic.blend 未覆盖。

已检查最终渲染的取景、工序编号、支线和物流路线；设备内部机械结构基于项目既有模型，本轮没有重新校验硬件尺寸。
