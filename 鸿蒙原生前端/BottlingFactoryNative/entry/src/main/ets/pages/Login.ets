import { promptAction, router } from '@kit.ArkUI'
import { Theme } from '../common/Theme'
import { apiClient } from '../service/ApiClient'
import { SessionStore } from '../service/SessionStore'

@Entry
@Component
struct Login {
  @State username: string = 'admin'
  @State password: string = ''
  @State loading: boolean = false
  @State message: string = ''

  async signIn(): Promise<void> {
    if (this.username.trim().length === 0 || this.password.length === 0) {
      this.message = '请输入用户名和密码'
      return
    }
    this.loading = true
    this.message = ''
    try {
      const result = await apiClient.login(this.username.trim(), this.password)
      SessionStore.setSession(result.token, result.user)
      promptAction.showToast({ message: '登录成功' })
      router.replaceUrl({ url: 'pages/Home' })
    } catch (error) {
      this.message = error instanceof Error ? error.message : '登录失败'
    } finally {
      this.loading = false
    }
  }

  enterDemo(): void {
    SessionStore.setSession('LOCAL-DEMO', { id: 0, username: 'demo', displayName: '演示账号', role: 'VIEWER', status: 'ACTIVE' })
    router.replaceUrl({ url: 'pages/Home' })
  }

  build() {
    Row() {
      Column() {
        Text('BOTTLING FACTORY').fontSize(11).fontColor('#A9CDE6').fontWeight(FontWeight.Bold)
        Text('智慧装瓶生产线').fontSize(34).fontColor('#FFFFFF').fontWeight(FontWeight.Bold).margin({ top: 14 })
        Text('工业监测、生产运营与工位控制鸿蒙原生平台').fontSize(14).fontColor('#C9D9E4').margin({ top: 10 })
        Blank()
        Row({ space: 24 }) {
          Column() { Text('HTTP').fontSize(9).fontColor('#A9CDE6'); Text('8088').fontSize(17).fontColor('#FFFFFF').fontWeight(FontWeight.Bold) }
          Column() { Text('实时通道').fontSize(9).fontColor('#A9CDE6'); Text('WebSocket').fontSize(17).fontColor('#FFFFFF').fontWeight(FontWeight.Bold) }
          Column() { Text('设备数据').fontSize(9).fontColor('#A9CDE6'); Text('MQTT / SIM').fontSize(17).fontColor('#FFFFFF').fontWeight(FontWeight.Bold) }
        }.width('100%')
      }
      .alignItems(HorizontalAlign.Start).padding(34).height('100%').layoutWeight(1).backgroundColor(Theme.navy)

      Scroll() {
        Column() {
          Text('AUTHORIZED PERSONNEL').fontSize(10).fontColor(Theme.accent).fontWeight(FontWeight.Bold)
          Text('账号登录').fontSize(28).fontColor(Theme.navy).fontWeight(FontWeight.Bold).margin({ top: 8 })
          Text('登录后根据角色进入监控、管理或工位工作台。').fontSize(12).fontColor(Theme.muted).margin({ top: 6, bottom: 24 })
          Text('用户名').fontSize(11).fontColor(Theme.text).fontWeight(FontWeight.Bold).width('100%')
          TextInput({ text: this.username, placeholder: '请输入用户名' }).onChange((value: string) => this.username = value).height(45).margin({ top: 7, bottom: 15 }).backgroundColor('#FFFFFF')
          Text('密码').fontSize(11).fontColor(Theme.text).fontWeight(FontWeight.Bold).width('100%')
          TextInput({ text: this.password, placeholder: '请输入密码' }).type(InputType.Password).onChange((value: string) => this.password = value).height(45).margin({ top: 7 }).backgroundColor('#FFFFFF')
          if (this.message.length > 0) {
            Text(this.message).fontSize(10).fontColor(Theme.danger).width('100%').margin({ top: 10 })
          }
          Button(this.loading ? '登录中...' : '登录系统').enabled(!this.loading).onClick(() => void this.signIn()).width('100%').height(44).margin({ top: 18 }).backgroundColor(Theme.blue).borderRadius(3)
          Row() {
            Button('注册只读账号').type(ButtonType.Normal).fontColor(Theme.blue).backgroundColor(Color.Transparent).onClick(() => router.pushUrl({ url: 'pages/Register' }))
            Blank()
            Button('进入本地演示').type(ButtonType.Normal).fontColor(Theme.warning).backgroundColor(Color.Transparent).onClick(() => this.enterDemo())
          }.width('100%').margin({ top: 8 })
          Text('本地演示不会向设备发送控制命令。').fontSize(9).fontColor(Theme.muted).width('100%').padding(10).border({ width: { left: 3 }, color: Theme.warning }).backgroundColor('#FFF8EA').margin({ top: 14 })
        }.alignItems(HorizontalAlign.Start).width('100%').padding(32)
      }.width('42%').height('100%').backgroundColor(Theme.page)
    }.width('100%').height('100%')
  }
}
