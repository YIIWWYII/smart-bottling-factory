import { router } from '@kit.ArkUI'
import { Theme } from '../common/Theme'
import { StateBadge } from '../components/IndustrialComponents'
import { FACTORY_STAGES } from '../config/FactoryStages'
import { FactoryRepository } from '../service/FactoryRepository'
import { FactoryBundle, StageDefinition } from '../model/FactoryModels'

@Entry
@Component
struct Workstation {
  @State bundle: FactoryBundle = FactoryRepository.bundle
  @State selectedCode: string = 'PRETREATMENT'
  private listener: () => void = () => this.bundle = FactoryRepository.bundle

  aboutToAppear(): void {
    FactoryRepository.subscribe(this.listener)
    void FactoryRepository.refresh()
    FactoryRepository.connectRealtime()
  }

  aboutToDisappear(): void {
    FactoryRepository.unsubscribe(this.listener)
    FactoryRepository.closeRealtime()
  }

  build() {
    Column() {
      Row() {
        Column() {
          Text('WORKSTATION / HMI').fontSize(10).fontColor('#9CC9E3').fontWeight(FontWeight.Bold)
          Text('现场工位终端').fontSize(25).fontColor('#FFFFFF').fontWeight(FontWeight.Bold).margin({ top: 6 })
          Text('先选工位，再进入本站的实时画面和控制面板').fontSize(11).fontColor('#C8DCE9').margin({ top: 6 })
        }.alignItems(HorizontalAlign.Start).layoutWeight(1)
        Column() {
          Row({ space: 6 }) {
            Circle().width(7).height(7).fill(FactoryRepository.realtimeOnline ? '#6FD0A4' : '#F0AD42')
            Text(FactoryRepository.realtimeOnline ? '实时在线' : '重连中').fontSize(10).fontColor('#FFFFFF')
          }
          Text('数据来自 WebSocket / 模拟回退').fontSize(8).fontColor('#9EBBC8').margin({ top: 6 })
        }.alignItems(HorizontalAlign.End)
      }.width('100%').padding({ left: 22, right: 22, top: 22, bottom: 20 }).backgroundColor(Theme.navy)
      Scroll() {
        Column() {
          Row() {
            Column() {
              Text('STATION SELECT').fontSize(9).fontColor(Theme.accent).fontWeight(FontWeight.Bold)
              Text('选择当前工位').fontSize(18).fontColor(Theme.text).fontWeight(FontWeight.Bold).margin({ top: 4 })
            }.alignItems(HorizontalAlign.Start)
            Blank()
            Text('共 ' + FACTORY_STAGES.length + ' 个业务工位').fontSize(9).fontColor(Theme.muted)
          }.width('100%').margin({ top: 20, bottom: 12 })
          Text('每个工位独立显示设备、物料、质量门和本站控制，数据实时同步。').fontSize(10).fontColor(Theme.muted).margin({ bottom: 8 }).alignSelf(ItemAlign.Start)
          ForEach(FACTORY_STAGES, (stage: StageDefinition) => {
            Row({ space: 12 }) {
              Column() {
                Text(stage.name).fontSize(14).fontColor(Theme.text).fontWeight(FontWeight.Bold)
                Text(stage.code).fontSize(8).fontColor(Theme.muted).margin({ top: 4 })
                Text(stage.description).fontSize(9).fontColor(Theme.muted).maxLines(1).margin({ top: 6 })
              }.alignItems(HorizontalAlign.Start).layoutWeight(1)
              Column() {
                StateBadge({ status: this.stageState(stage.code), label: this.stageState(stage.code) === 'RUNNING' ? '运行中' : this.stageState(stage.code) })
                Text('进入工位  →').fontSize(10).fontColor(Theme.blue).margin({ top: 9 })
              }.alignItems(HorizontalAlign.End)
            }.width('100%').padding({ left: 14, right: 14, top: 13, bottom: 13 }).backgroundColor(this.selectedCode === stage.code ? Theme.successSoft : Theme.panel).border({ width: { left: this.selectedCode === stage.code ? 4 : 1, top: 1, right: 1, bottom: 1 }, color: this.selectedCode === stage.code ? Theme.success : Theme.line }).borderRadius(4).onClick(() => { this.selectedCode = stage.code; router.pushUrl({ url: 'pages/StageDetail', params: { stageCode: stage.code } }) })
          }, (stage: StageDefinition) => stage.code)
        }.width('100%').alignItems(HorizontalAlign.Start).padding({ left: 18, right: 18, bottom: 28 })
      }.width('100%').layoutWeight(1).backgroundColor(Theme.page)
    }.width('100%').height('100%')
  }

  private stageState(code: string): string {
    const item = this.bundle.runtime.stages.find(stage => stage.stageCode === code)
    return item === undefined ? 'RUNNING' : item.state
  }
}
