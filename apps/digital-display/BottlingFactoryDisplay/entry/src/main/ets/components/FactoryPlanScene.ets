import { webview } from '@kit.ArkWeb'
import { BusinessError } from '@kit.BasicServicesKit'
import { Theme } from '../common/Theme'

@Component
export struct FactoryPlanScene {
  @Prop @Watch('onPayloadChanged') payload: string = '{}'
  @Link selectedDeviceCode: string
  @Link selectedTraceCode: string
  @State webReady: boolean = false
  private controller: webview.WebviewController = new webview.WebviewController()

  onPayloadChanged(): void {
    this.pushPayload()
  }

  private pushPayload(): void {
    if (!this.webReady) return
    const script = `window.FactoryPlan && window.FactoryPlan.update(${this.payload})`
    this.controller.runJavaScript(script)
      .catch((error: BusinessError) => console.error(`Factory 2D sync failed: ${error.code} ${error.message}`))
  }

  private decodeRouteValue(url: string, prefix: string): string {
    return decodeURIComponent(url.substring(prefix.length))
  }

  build() {
    Stack({ alignContent: Alignment.Center }) {
      Web({ src: $rawfile('factory2d/index.html'), controller: this.controller })
        .javaScriptAccess(true)
        .domStorageAccess(true)
        .fileAccess(true)
        .onPageEnd(() => {
          this.webReady = true
          this.pushPayload()
        })
        .onLoadIntercept((event) => {
          if (event === undefined) return false
          const url: string = event.data.getRequestUrl()
          const devicePrefix: string = 'factory://device/'
          const productPrefix: string = 'factory://product/'
          if (url.indexOf(devicePrefix) === 0) {
            this.selectedDeviceCode = this.decodeRouteValue(url, devicePrefix)
            return true
          }
          if (url.indexOf(productPrefix) === 0) {
            this.selectedTraceCode = this.decodeRouteValue(url, productPrefix)
            return true
          }
          return false
        })
        .width('100%')
        .height(520)
        .backgroundColor('#EAF1F6')

      if (!this.webReady) {
        Column({ space: 8 }) {
          LoadingProgress().width(28).height(28).color(Theme.accent)
          Text('正在初始化 2D 平面工艺图').fontSize(10).fontColor(Theme.muted)
        }
        .width('100%')
        .height(520)
        .justifyContent(FlexAlign.Center)
        .backgroundColor('#EAF1F6')
      }
    }
    .width('100%')
    .height(520)
    .border({ width: 1, color: Theme.line })
  }
}
