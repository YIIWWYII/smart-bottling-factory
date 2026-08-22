# 鸿蒙后台管理端

工程入口：`BottlingFactoryAdmin`，bundleName：`com.factory.bottling.admin`。

后台管理端面向管理人员，负责登录认证、生产任务、设备和工位基础资料、产品与质量规则、异常处置、物流仓储、AI 配置与知识审核、权限和操作审计。主要使用路径为 `Index -> Login/Register -> AdminConsole`。

后台管理端不承担数字展板的沉浸式展示，也不替代工位终端进行现场操作。所有设备写操作和配置发布都通过生产后端的权限、范围、版本、联锁和审计校验完成；AI 助手只提供问答、解释和只读定位，正式审核和调参仍在对应业务页面完成。

本工程不包含 Three.js 产线场景资源。跨应用接口、实时事件、权限和 AI 数据语义见根目录 `contracts/`。

构建、配置、模拟数据和联调步骤见根目录 [ONBOARDING-DEPLOYMENT.md](../../ONBOARDING-DEPLOYMENT.md)。
