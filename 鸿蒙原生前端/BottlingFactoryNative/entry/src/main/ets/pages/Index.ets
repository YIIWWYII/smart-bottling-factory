import { router } from '@kit.ArkUI'
import { Theme } from '../common/Theme'
import { SessionStore } from '../service/SessionStore'

@Entry
@Component
struct Index {
  aboutToAppear(): void {
    router.replaceUrl({ url: SessionStore.isAuthenticated ? 'pages/Home' : 'pages/Login' })
  }

  build() {
    Column({ space: 12 }) {
      Text('智慧装瓶产线').fontSize(28).fontWeight(FontWeight.Bold).fontColor('#FFFFFF')
      Text('正在启动鸿蒙原生应用').fontSize(13).fontColor('#C8DCE9')
      LoadingProgress().width(42).height(42).color('#FFFFFF')
    }
    .width('100%').height('100%')
    .justifyContent(FlexAlign.Center).alignItems(HorizontalAlign.Center)
    .backgroundColor(Theme.navy)
  }
}
