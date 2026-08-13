import { promptAction, router } from '@kit.ArkUI'
import { Theme } from '../common/Theme'
import { apiClient } from '../service/ApiClient'

@Entry
@Component
struct Register {
  @State username: string = ''
  @State displayName: string = ''
  @State password: string = ''
  @State confirmPassword: string = ''
  @State loading: boolean = false
  @State message: string = ''

  async submit(): Promise<void> {
    if (!/^[A-Za-z0-9_]{3,32}$/.test(this.username)) { this.message = '用户名需为 3-32 位字母、数字或下划线'; return }
    if (this.displayName.trim().length === 0) { this.message = '请输入姓名'; return }
    if (this.password.length < 8 || this.password.length > 72) { this.message = '密码长度需为 8-72 位'; return }
    if (this.password !== this.confirmPassword) { this.message = '两次密码不一致'; return }
    this.loading = true
    try {
      await apiClient.register(this.username, this.displayName, this.password)
      promptAction.showToast({ message: '只读账号已创建' })
      router.replaceUrl({ url: 'pages/Login' })
    } catch (error) {
      this.message = error instanceof Error ? error.message : '注册失败'
    } finally {
      this.loading = false
    }
  }

  build() {
    Scroll() {
      Column() {
        Button('返回登录').type(ButtonType.Normal).fontColor(Theme.blue).backgroundColor(Color.Transparent).alignSelf(ItemAlign.Start).onClick(() => router.back())
        Text('ACCOUNT APPLICATION').fontSize(10).fontColor(Theme.accent).fontWeight(FontWeight.Bold).margin({ top: 20 })
        Text('申请只读账号').fontSize(26).fontColor(Theme.navy).fontWeight(FontWeight.Bold).margin({ top: 7 })
        Text('公开注册不会授予产线控制、报警确认或用户管理权限。').fontSize(11).fontColor(Theme.muted).margin({ top: 6, bottom: 18 })
        TextInput({ text: this.username, placeholder: '用户名：3-32 位字母、数字或下划线' }).onChange((value: string) => this.username = value).margin({ bottom: 12 })
        TextInput({ text: this.displayName, placeholder: '姓名' }).onChange((value: string) => this.displayName = value).margin({ bottom: 12 })
        TextInput({ text: this.password, placeholder: '密码：至少 8 位' }).type(InputType.Password).onChange((value: string) => this.password = value).margin({ bottom: 12 })
        TextInput({ text: this.confirmPassword, placeholder: '确认密码' }).type(InputType.Password).onChange((value: string) => this.confirmPassword = value)
        if (this.message.length > 0) { Text(this.message).fontSize(10).fontColor(Theme.danger).width('100%').margin({ top: 10 }) }
        Button(this.loading ? '提交中...' : '提交注册').enabled(!this.loading).width('100%').height(44).margin({ top: 18 }).backgroundColor(Theme.blue).borderRadius(3).onClick(() => void this.submit())
      }.width('100%').constraintSize({ maxWidth: 560 }).alignItems(HorizontalAlign.Start).padding(30).backgroundColor(Theme.panel).border({ width: { top: 5, left: 1, right: 1, bottom: 2 }, color: Theme.blue })
    }.width('100%').height('100%').padding(24).backgroundColor(Theme.page)
  }
}
