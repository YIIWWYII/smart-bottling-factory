import { router } from '@kit.ArkUI'
import { Theme } from '../common/Theme'

@Entry
@Component
struct Index {
  aboutToAppear(): void {
    router.replaceUrl({ url: 'pages/FactoryOverview' })
  }

  build() {
    Column({ space: 12 }) {
      Text('BOTTLING / DISPLAY').fontSize(11).fontWeight(FontWeight.Bold).fontColor('#A9CDE6')
      Text('数字展板').fontSize(28).fontWeight(FontWeight.Bold).fontColor('#FFFFFF')
      Text('正在连接产线实时数据').fontSize(12).fontColor('#C8DCE9')
      LoadingProgress().width(36).height(36).color('#FFFFFF')
    }
    .width('100%').height('100%')
    .justifyContent(FlexAlign.Center).alignItems(HorizontalAlign.Center)
    .backgroundColor(Theme.navy)
  }
}
