import { webview } from '@kit.ArkWeb'
import { BusinessError } from '@kit.BasicServicesKit'
import { Theme } from '../common/Theme'

@Component
export struct FactoryThreeScene {
  @Prop payload: string = '{}'
  @Link selectedDeviceCode: string
  @Link selectedTraceCode: string
  @State webReady: boolean = false
  private controller: webview.WebviewController = new webview.WebviewController()

  @Watch('payload')
  onPayloadChanged(): void {
    this.pushPayload()
  }

  private pushPayload(): void {
    if (!this.webReady) return
    const script = `window.FactoryScene && window.FactoryScene.update(${this.payload})`
    this.controller.runJavaScript(script)
      .catch((error: BusinessError) => console.error(`Factory 3D sync failed: ${error.code} ${error.message}`))
  }

  private decodeRouteValue(url: string, prefix: string): string {
    return decodeURIComponent(url.substring(prefix.length))
  }

  build() {
    Stack({ alignContent: Alignment.Center }) {
      Web({ src: $rawfile('factory3d/index.html'), controller: this.controller })
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
        .height(360)
        .backgroundColor('#DFEAF1')

      if (!this.webReady) {
        Column({ space: 8 }) {
          LoadingProgress().width(28).height(28).color(Theme.accent)
          Text('正在初始化本地 Three.js 场景').fontSize(10).fontColor(Theme.muted)
        }
        .width('100%')
        .height(360)
        .justifyContent(FlexAlign.Center)
        .backgroundColor('#DFEAF1')
      }
    }
    .width('100%')
    .height(360)
    .border({ width: 1, color: Theme.line })
  }
}
