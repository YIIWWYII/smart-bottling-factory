import { webview } from '@kit.ArkWeb'
import { BusinessError } from '@kit.BasicServicesKit'
import { Theme } from '../common/Theme'

@Component
export struct FactoryThreeScene {
  @Prop payload: string = '{}'
  @Prop sceneHeight: number = 360
  @Prop label: string = 'THREE.JS'
  onDeviceSelected: (deviceCode: string) => void = (deviceCode: string): void => {}
  onProductSelected: (traceCode: string) => void = (traceCode: string): void => {}
  @Link selectedDeviceCode: string
  @Link selectedTraceCode: string
  @State webReady: boolean = false
  private controller: webview.WebviewController = new webview.WebviewController()
  private syncTimer: number = -1
  private probeTimer: number = -1

  aboutToAppear(): void {
    this.syncTimer = setInterval(() => this.pushPayload(), 700)
  }

  aboutToDisappear(): void {
    if (this.syncTimer >= 0) clearInterval(this.syncTimer)
    if (this.probeTimer >= 0) clearTimeout(this.probeTimer)
    this.syncTimer = -1
    if (this.webReady) {
      this.controller.runJavaScript('window.FactoryScene && window.FactoryScene.dispose && window.FactoryScene.dispose()')
        .catch((error: BusinessError) => console.error(`Factory scene dispose failed: ${error.code} ${error.message}`))
    }
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

  private logTestProbe(): void {
    if (!this.webReady) return
    this.controller.runJavaScript('JSON.stringify(window.__factoryTest__)')
      .then((result: string) => console.info('[BottlingFactory][ArkWebProbe][' + this.label + '] ' + result))
      .catch((error: BusinessError) => console.error(`Factory scene probe failed: ${error.code} ${error.message}`))
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
          this.probeTimer = setTimeout(() => this.logTestProbe(), 1800)
        })
        .onLoadIntercept((event) => {
          if (event === undefined) return false
          const url: string = event.data.getRequestUrl()
          const devicePrefix: string = 'factory://device/'
          const productPrefix: string = 'factory://product/'
          if (url.indexOf(devicePrefix) === 0) {
            const deviceCode: string = this.decodeRouteValue(url, devicePrefix)
            this.selectedDeviceCode = deviceCode
            this.selectedTraceCode = ''
            this.onDeviceSelected(deviceCode)
            return true
          }
          if (url.indexOf(productPrefix) === 0) {
            const traceCode: string = this.decodeRouteValue(url, productPrefix)
            this.selectedTraceCode = traceCode
            this.selectedDeviceCode = ''
            this.onProductSelected(traceCode)
            return true
          }
          return false
        })
        .width('100%')
        .height(this.sceneHeight)
        .id(this.label.indexOf('2D') >= 0 ? 'workstation-scene-2d' : 'workstation-scene-3d')
        .backgroundColor('#DFEAF1')

      if (!this.webReady) {
        Column({ space: 8 }) {
          LoadingProgress().width(28).height(28).color(Theme.accent)
          Text('正在初始化本地 ' + this.label + ' 场景').fontSize(10).fontColor(Theme.muted)
        }
        .width('100%')
        .height(this.sceneHeight)
        .justifyContent(FlexAlign.Center)
        .backgroundColor('#DFEAF1')
      }
    }
    .width('100%')
    .height(this.sceneHeight)
    .border({ width: 1, color: Theme.line })
  }
}
