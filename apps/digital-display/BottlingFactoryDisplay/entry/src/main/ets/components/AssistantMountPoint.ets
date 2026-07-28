import { Theme } from '../common/Theme'

@Component
export struct AssistantMountPoint {
  @Prop sourceApp: string = 'DISPLAY'
  @Prop pageRoute: string = ''
  @Prop lineId: string = 'LINE-1'
  @Prop stageCode: string = ''
  @Prop deviceCode: string = ''
  @Prop traceCode: string = ''
  @Prop stateVersion: string = ''
  @Prop selectionType: string = ''
  @Prop selectionId: string = ''
  @Prop selectionLabel: string = ''
  @Prop selectedText: string = ''
  @Prop aiBase: string = ''
  @Prop unavailableReason: string = ''

  build() {
    Column() {
      Row() {
        Column() {
          Text('ASSISTANT HOST').fontSize(9).fontColor(Theme.accent).fontWeight(FontWeight.Bold)
          Text('上下文助手挂载点').fontSize(18).fontColor(Theme.navy).fontWeight(FontWeight.Bold).margin({ top: 4 })
          Text('展板端只提供只读上下文、稳定实体 ID 和实体跳转，不提供设备控制。').fontSize(10).fontColor(Theme.muted).margin({ top: 5 })
        }.alignItems(HorizontalAlign.Start).layoutWeight(1)
        Text('READ ONLY').fontSize(9).fontColor(Theme.blue).fontWeight(FontWeight.Bold).padding({ left: 8, right: 8, top: 5, bottom: 5 }).border({ width: 1, color: Theme.blue })
      }.width('100%')

      Column() {
        Text('共享助手暂不可用').fontSize(13).fontColor(Theme.warning).fontWeight(FontWeight.Bold)
        Text(this.unavailableReason).fontSize(10).fontColor(Theme.muted).lineHeight(15).margin({ top: 6 })
      }.width('100%').alignItems(HorizontalAlign.Start).padding(12).margin({ top: 12 }).backgroundColor('#FFF7E8').border({ width: 1, color: '#E6B45C' })

      Row({ space: 8 }) {
        this.contextItem('sourceApp', this.sourceApp)
        this.contextItem('lineId', this.lineId)
        this.contextItem('stateVersion', this.stateVersion)
      }.width('100%').margin({ top: 12 })

      Row({ space: 8 }) {
        this.contextItem('pageRoute', this.pageRoute)
        this.contextItem('stageCode', this.stageCode.length > 0 ? this.stageCode : '--')
        this.contextItem('AI 服务', this.aiBase)
      }.width('100%').margin({ top: 8 })

      if (this.selectionId.length > 0) {
        Column() {
          Text('当前 AssistantSelection').fontSize(10).fontColor(Theme.muted).fontWeight(FontWeight.Bold)
          Text(this.selectionType + ' · ' + this.selectionId).fontSize(13).fontColor(Theme.navy).fontWeight(FontWeight.Bold).margin({ top: 6 })
          Text(this.selectionLabel).fontSize(10).fontColor(Theme.text).margin({ top: 5 })
          if (this.selectedText.length > 0) {
            Text(this.selectedText).fontSize(9).fontColor(Theme.muted).lineHeight(14).margin({ top: 6 })
          }
        }.width('100%').alignItems(HorizontalAlign.Start).padding(12).margin({ top: 12 }).backgroundColor('#EDF5FA').border({ width: 1, color: Theme.line })
      } else {
        Text('尚未选择业务实体。可从工位、KPI、报警、产品、文字说明或 2D/3D 设备/物料触发选择。').fontSize(10).fontColor(Theme.muted).margin({ top: 12 })
      }
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
    .padding(16)
    .backgroundColor(Theme.panel)
    .border({ width: { top: 3, left: 1, right: 1, bottom: 2 }, color: Theme.accent })
    .borderRadius(3)
  }

  @Builder
  contextItem(label: string, value: string) {
    Column() {
      Text(label).fontSize(8).fontColor(Theme.muted)
      Text(value.length > 0 ? value : '--').fontSize(10).fontColor(Theme.text).fontWeight(FontWeight.Bold).maxLines(2).margin({ top: 4 })
    }.alignItems(HorizontalAlign.Start).layoutWeight(1).padding(9).backgroundColor(Theme.panelSoft).border({ width: 1, color: Theme.line })
  }
}
