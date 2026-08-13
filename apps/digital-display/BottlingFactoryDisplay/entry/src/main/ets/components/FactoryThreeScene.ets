import { webview } from '@kit.ArkWeb'
import { BusinessError } from '@kit.BasicServicesKit'
import { Theme } from '../common/Theme'

@Component
export struct FactoryThreeScene {
  @Prop payload: string = '{}'
  @Prop viewMode: string = 'THREE'
  @Prop caption: string = '本地 Three.js 场景'
  @Prop heightValue: number = 360
  @Prop selectionSource: string = 'THREE_3D'
  @Link selectedDeviceCode: string
  @Link selectedTraceCode: string
  @State webReady: boolean = false
  onDeviceSelected: (deviceCode: string, source: string) => void =
    (deviceCode: string, source: string): void => {}
  onProductSelected: (traceCode: string, source: string) => void =
    (traceCode: string, source: string): void => {}
  onSelectionCleared: (source: string) => void =
    (source: string): void => {}
  private controller: webview.WebviewController = new webview.WebviewController()
  private syncTimer: number = -1

  aboutToAppear(): void {
    this.syncTimer = setInterval(() => this.pushPayload(), 350)
  }

  aboutToDisappear(): void {
    if (this.syncTimer >= 0) clearInterval(this.syncTimer)
    this.syncTimer = -1
    if (this.webReady) {
      this.controller.runJavaScript('window.FactoryScene && window.FactoryScene.dispose && window.FactoryScene.dispose()')
        .catch((error: BusinessError) => console.error(`Factory scene dispose failed: ${error.code} ${error.message}`))
    }
  }

  private pushPayload(): void {
    if (!this.webReady) return
    const script = `window.FactoryScene && window.FactoryScene.update(Object.assign({}, ${this.payload}, { viewMode: '${this.viewMode}' }))`
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
          const clearUrl: string = 'factory://clear'
          if (url === clearUrl || url.indexOf(clearUrl + '/') === 0) {
            this.selectedDeviceCode = ''
            this.selectedTraceCode = ''
            this.onSelectionCleared(this.selectionSource)
            return true
          }
          if (url.indexOf(devicePrefix) === 0) {
            this.selectedDeviceCode = this.decodeRouteValue(url, devicePrefix)
            this.onDeviceSelected(this.selectedDeviceCode, this.selectionSource)
            return true
          }
          if (url.indexOf(productPrefix) === 0) {
            this.selectedTraceCode = this.decodeRouteValue(url, productPrefix)
            this.onProductSelected(this.selectedTraceCode, this.selectionSource)
            return true
          }
          return false
        })
        .width('100%')
        .height(this.heightValue)
        .backgroundColor('#DFEAF1')

      if (!this.webReady) {
        Column({ space: 8 }) {
          LoadingProgress().width(28).height(28).color(Theme.accent)
          Text('正在初始化' + this.caption).fontSize(10).fontColor(Theme.muted)
        }
        .width('100%')
        .height(this.heightValue)
        .justifyContent(FlexAlign.Center)
        .backgroundColor('#DFEAF1')
      }
    }
    .width('100%')
    .height(this.heightValue)
    .border({ width: 1, color: Theme.line })
  }
}
