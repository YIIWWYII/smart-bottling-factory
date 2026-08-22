import { promptAction, router } from '@kit.ArkUI'
import { Theme } from '../common/Theme'
import { apiClient } from '../service/ApiClient'
import { SessionStore } from '../service/SessionStore'
import { ROLE_ADMIN, ROLE_ENGINEER, ROLE_OPERATOR, ROLE_VIEWER, roleLabel } from '../service/AdminAccessPolicy'

@Entry
@Component
struct Login {
  @State username: string = 'admin'
  @State password: string = ''
  @State loading: boolean = false
  @State message: string = ''
  @State demoRole: string = ROLE_VIEWER

  async signIn(): Promise<void> {
    if (this.username.trim().length === 0 || this.password.length === 0) {
      this.message = '请输入用户名和密码'
      return
    }
    this.loading = true
    this.message = ''
    try {
      const result = await apiClient.login(this.username.trim(), this.password)
      SessionStore.setSession(result.token, result.user, result.expiresAt || '')
      promptAction.showToast({ message: '登录成功' })
      router.replaceUrl({ url: 'pages/AdminConsole' })
    } catch (error) {
      this.message = error instanceof Error ? error.message : '登录失败'
    } finally {
      this.loading = false
    }
  }

  enterDemo(): void {
    SessionStore.setDemoSession({ id: 0, username: 'demo-' + this.demoRole.toLowerCase(), displayName: '只读验收账号', role: this.demoRole, status: 'ACTIVE' })
    router.replaceUrl({ url: 'pages/AdminConsole' })
  }

  build() {
    Row() {
      Column() {
        Text('BOTTLING / CONTROL').fontSize(11).fontColor('#A9CDE6').fontWeight(FontWeight.Bold)
        Text('生产运营控制台').fontSize(30).fontColor('#FFFFFF').fontWeight(FontWeight.Bold).margin({ top: 14 })
        Text('异常处置 · 设备资产 · AI 治理 · 操作审计').fontSize(13).fontColor('#C9D9E4').margin({ top: 10 })
        Blank()
        Text('系统通道').fontSize(10).fontColor('#A9CDE6').fontWeight(FontWeight.Bold).margin({ bottom: 10 })
        Row({ space: 24 }) {
          Column() { Text('业务接口').fontSize(9).fontColor('#A9CDE6'); Text('HTTP 8088').fontSize(15).fontColor('#FFFFFF').fontWeight(FontWeight.Bold) }
          Column() { Text('实时状态').fontSize(9).fontColor('#A9CDE6'); Text('WebSocket').fontSize(15).fontColor('#FFFFFF').fontWeight(FontWeight.Bold) }
        }.width('100%')
        Text('认证后才能进行受控写操作；演示模式仅用于查看页面和权限边界。').fontSize(10).fontColor('#B8D0DE').margin({ top: 22 })
      }
      .alignItems(HorizontalAlign.Start).padding(34).height('100%').layoutWeight(1).backgroundColor(Theme.navy)

      Scroll() {
        Column() {
          Text('AUTHENTICATION').fontSize(10).fontColor(Theme.accent).fontWeight(FontWeight.Bold)
          Text('登录控制台').fontSize(26).fontColor(Theme.navy).fontWeight(FontWeight.Bold).margin({ top: 8 })
          Text('请输入后端已创建的账号。登录失败时请检查服务地址、账号状态和密码。').fontSize(11).fontColor(Theme.muted).margin({ top: 6, bottom: 24 })
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
          Text('本地只读验收角色').fontSize(10).fontColor(Theme.text).fontWeight(FontWeight.Bold).margin({ top: 14 })
          Row({ space: 6 }) {
            this.demoRoleButton(ROLE_VIEWER)
            this.demoRoleButton(ROLE_OPERATOR)
            this.demoRoleButton(ROLE_ENGINEER)
            this.demoRoleButton(ROLE_ADMIN)
          }.width('100%').margin({ top: 7 })
          Text('当前：' + roleLabel(this.demoRole) + '。本地演示只验证菜单和权限边界，不会发送任何写操作。').fontSize(9).fontColor(Theme.muted).width('100%').padding(10).border({ width: { left: 3 }, color: Theme.warning }).backgroundColor(Theme.warningSoft).margin({ top: 10 })
        }.alignItems(HorizontalAlign.Start).width('100%').padding(32)
      }.width('42%').height('100%').backgroundColor(Theme.page)
    }.width('100%').height('100%')
  }

  @Builder
  demoRoleButton(role: string) {
    Button(role)
      .type(ButtonType.Normal)
      .layoutWeight(1)
      .height(32)
      .fontSize(8)
      .fontColor(this.demoRole === role ? '#FFFFFF' : Theme.blue)
      .backgroundColor(this.demoRole === role ? Theme.blue : Theme.panel)
      .border({ width: 1, color: Theme.blue })
      .onClick(() => this.demoRole = role)
  }
}
