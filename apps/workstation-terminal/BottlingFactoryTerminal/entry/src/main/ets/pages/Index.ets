import { router } from '@kit.ArkUI'
import { Theme } from '../common/Theme'

@Entry
@Component
struct Index {
  aboutToAppear(): void {
    router.replaceUrl({ url: 'pages/Workstation' })
  }

  build() {
    Column({ space: 12 }) {
      Text('智慧工位终端').fontSize(28).fontWeight(FontWeight.Bold).fontColor('#FFFFFF')
      Text('正在连接本站设备与实时状态').fontSize(13).fontColor('#C8DCE9')
      LoadingProgress().width(42).height(42).color('#FFFFFF')
    }
    .width('100%').height('100%')
    .justifyContent(FlexAlign.Center).alignItems(HorizontalAlign.Center)
    .backgroundColor(Theme.navy)
  }
}
