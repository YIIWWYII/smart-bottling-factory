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
      Text('智慧工厂数字展板').fontSize(28).fontWeight(FontWeight.Bold).fontColor('#FFFFFF')
      Text('正在连接产线实时数据').fontSize(13).fontColor('#C8DCE9')
      LoadingProgress().width(42).height(42).color('#FFFFFF')
    }
    .width('100%').height('100%')
    .justifyContent(FlexAlign.Center).alignItems(HorizontalAlign.Center)
    .backgroundColor(Theme.navy)
  }
}
