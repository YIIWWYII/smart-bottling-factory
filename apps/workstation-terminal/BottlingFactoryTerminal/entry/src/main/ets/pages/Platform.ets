import { webview } from '@kit.ArkWeb'
import { router } from '@kit.ArkUI'

@Entry
@Component
struct Platform {
  @StorageLink('platformUrl') address: string = 'http://10.0.2.2:5174/#station'
  @State currentUrl: string = ''
  @State notice: string = '正在打开平台…'
  @State showAddressRecovery: boolean = false
  private controller: webview.WebviewController = new webview.WebviewController()

  aboutToAppear(): void {
    this.currentUrl = this.address
  }

  build() {
    Column({ space: 8 }) {
      Row({ space: 12 }) {
        Text('瓶安智慧产线 · HarmonyOS').fontSize(20).fontWeight(FontWeight.Bold)
        Button('原生工位').onClick(() => { router.pushUrl({ url: 'pages/Workstation' }) })
      }.width('100%').justifyContent(FlexAlign.SpaceBetween)
      Text(this.notice).fontSize(14).fontColor('#40586E').width('100%')
      if (this.showAddressRecovery) {
        Row({ space: 8 }) {
          TextInput({ text: this.address, placeholder: 'http://电脑IP:5174/#station' })
            .layoutWeight(1).onChange((value: string) => { this.address = value })
          Button('重试').onClick(() => {
            if (!/^https?:\/\//.test(this.address)) { this.notice = '请输入完整的 HTTP 或 HTTPS 地址。'; return }
            AppStorage.setOrCreate('platformUrl', this.address)
            this.currentUrl = this.address
            this.showAddressRecovery = false
            this.notice = '正在加载平台…'
          })
        }
      }
      if (this.currentUrl.length > 0) {
        Web({ src: this.currentUrl, controller: this.controller })
          .javaScriptAccess(true).domStorageAccess(true)
          .onPageEnd(() => { this.notice = '网页平台已打开 · 配置与数据由平台服务保存' })
          .onErrorReceive(() => { this.notice = '平台未连接，请检查电脑服务和网络地址。'; this.showAddressRecovery = true })
          .width('100%').layoutWeight(1)
      } else {
        Text('连接现有平台后，即可使用数字展板、工位终端和工程管理。')
          .fontSize(20).layoutWeight(1).width('100%').textAlign(TextAlign.Center)
      }
    }.width('100%').height('100%').padding(16).backgroundColor('#EDF3F8')
  }
}
