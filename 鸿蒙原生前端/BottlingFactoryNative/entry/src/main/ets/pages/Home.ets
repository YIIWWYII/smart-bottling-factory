import { router } from '@kit.ArkUI'
import { Theme } from '../common/Theme'
import { SessionStore } from '../service/SessionStore'

@Entry
@Component
struct Home {
  build() {
    Scroll() {
      Column() {
        Row() {
          Column() {
            Text('HARMONYOS NATIVE').fontSize(10).fontColor('#A9CDE6').fontWeight(FontWeight.Bold)
            Text('智慧装瓶产线').fontSize(28).fontColor('#FFFFFF').fontWeight(FontWeight.Bold).margin({ top: 5 })
            Text('选择当前设备承担的工作台').fontSize(12).fontColor('#C6D9E6').margin({ top: 5 })
          }.alignItems(HorizontalAlign.Start).layoutWeight(1)
          Column() {
            Text(SessionStore.user === undefined ? '演示账号' : SessionStore.user.displayName).fontSize(12).fontColor('#FFFFFF').fontWeight(FontWeight.Bold)
            Text(SessionStore.user === undefined ? 'VIEWER' : SessionStore.user.role).fontSize(9).fontColor('#B7D0E0').margin({ top: 4 })
          }.alignItems(HorizontalAlign.End)
        }.width('100%').padding(22).backgroundColor(Theme.navy)

        Flex({ wrap: FlexWrap.Wrap, justifyContent: FlexAlign.Start }) {
          this.workspaceCard('监控工作台', '全局产线、生产质量、设备状态、物流仓储和产品追踪', '适合大屏和管理人员查看', 'pages/FactoryOverview', true)
          this.workspaceCard('管理工作台', '异常处置、用户权限、设备、物料、仓储、报表和配置', '需要登录账号，写操作由后端鉴权', 'pages/AdminConsole', true)
          this.workspaceCard('工位工作台', '现场小屏查看本站设备、传感器、质量门和允许操作', '适合固定工位屏和平板', 'pages/Workstation', true)
        }.width('100%').padding(18)

        Button('退出登录').type(ButtonType.Normal).fontColor(Theme.danger).backgroundColor(Color.Transparent).onClick(() => { SessionStore.clear(); router.replaceUrl({ url: 'pages/Login' }) })
      }.width('100%').alignItems(HorizontalAlign.Start)
    }.width('100%').height('100%').backgroundColor(Theme.page)
  }

  @Builder
  workspaceCard(title: string, description: string, note: string, url: string, enabled: boolean) {
    Column() {
      Text(title).fontSize(21).fontColor(Theme.navy).fontWeight(FontWeight.Bold)
      Text(description).fontSize(12).fontColor(Theme.text).lineHeight(19).margin({ top: 10 })
      Blank()
      Text(note).fontSize(9).fontColor(Theme.muted).margin({ bottom: 12 })
      Button('进入工作台').enabled(enabled).width('100%').height(40).backgroundColor(Theme.blue).borderRadius(3).onClick(() => router.pushUrl({ url: url }))
    }.alignItems(HorizontalAlign.Start).width(310).height(235).padding(18).margin(8).backgroundColor(Theme.panel).border({ width: { top: 5, left: 1, right: 1, bottom: 2 }, color: Theme.blue }).borderRadius(3)
  }
}
