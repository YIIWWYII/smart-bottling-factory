import { router } from '@kit.ArkUI'
import { Theme } from '../common/Theme'
import { SessionStore } from '../service/SessionStore'

@Entry
@Component
struct Index {
  aboutToAppear(): void {
    router.replaceUrl({ url: SessionStore.isAuthenticated ? 'pages/AdminConsole' : 'pages/Login' })
  }

  build() {
    Column({ space: 12 }) {
      Text('智慧工厂后台管理').fontSize(28).fontWeight(FontWeight.Bold).fontColor('#FFFFFF')
      Text('正在验证管理端登录状态').fontSize(13).fontColor('#C8DCE9')
      LoadingProgress().width(42).height(42).color('#FFFFFF')
    }
    .width('100%').height('100%')
    .justifyContent(FlexAlign.Center).alignItems(HorizontalAlign.Center)
    .backgroundColor(Theme.navy)
  }
}
