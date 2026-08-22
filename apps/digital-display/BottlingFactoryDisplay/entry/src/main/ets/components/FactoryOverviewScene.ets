import { webview } from '@kit.ArkWeb'
import { BusinessError } from '@kit.BasicServicesKit'
import { Theme } from '../common/Theme'

@Component
export struct FactoryOverviewScene {
  @Prop payload: string = '{}'
  @Prop heightValue: number = 286
  @State webReady: boolean = false
  onStageSelected: (stageCode: string) => void = (stageCode: string): void => {}
  private controller: webview.WebviewController = new webview.WebviewController()
  private syncTimer: number = -1

  aboutToAppear(): void {
    this.syncTimer = setInterval(() => this.pushPayload(), 400)
  }

  aboutToDisappear(): void {
    if (this.syncTimer >= 0) clearInterval(this.syncTimer)
    this.syncTimer = -1
    if (this.webReady) {
      this.controller.runJavaScript('window.FactoryOverview && window.FactoryOverview.dispose && window.FactoryOverview.dispose()')
        .catch((error: BusinessError) => console.error(`Factory overview dispose failed: ${error.code} ${error.message}`))
    }
  }

  private pushPayload(): void {
    if (!this.webReady) return
    this.controller.runJavaScript(`window.FactoryOverview && window.FactoryOverview.update(${this.payload})`)
      .catch((error: BusinessError) => console.error(`Factory overview sync failed: ${error.code} ${error.message}`))
  }

  build() {
    Stack({ alignContent: Alignment.Center }) {
      Web({ src: $rawfile('factoryoverview/index.html'), controller: this.controller })
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
          const prefix: string = 'factory://stage/'
          if (url.indexOf(prefix) !== 0) return false
          this.onStageSelected(decodeURIComponent(url.substring(prefix.length)))
          return true
        })
        .width('100%')
        .height(this.heightValue)
        .backgroundColor('#09151B')

      if (!this.webReady) {
        Column({ space: 8 }) {
          LoadingProgress().width(26).height(26).color(Theme.accent)
          Text('正在建立产线数字孪生').fontSize(10).fontColor(Theme.onDarkMuted)
        }
        .width('100%')
        .height(this.heightValue)
        .justifyContent(FlexAlign.Center)
        .backgroundColor('#09151B')
      }
    }
    .width('100%')
    .height(this.heightValue)
  }
}
