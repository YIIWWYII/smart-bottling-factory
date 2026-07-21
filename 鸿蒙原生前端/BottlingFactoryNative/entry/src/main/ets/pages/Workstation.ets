import { router } from '@kit.ArkUI'
import { Theme } from '../common/Theme'
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
        Column() { Text('WORKSTATION HMI').fontSize(10).fontColor('#A9CDE6').fontWeight(FontWeight.Bold); Text('工位工作台').fontSize(27).fontColor('#FFFFFF').fontWeight(FontWeight.Bold).margin({ top: 5 }); Text('现场只显示本站必需信息，控制请求仍由后端安全门校验').fontSize(11).fontColor('#C8DCE9').margin({ top: 5 }) }.alignItems(HorizontalAlign.Start).layoutWeight(1)
        Button('返回').type(ButtonType.Normal).fontColor('#FFFFFF').backgroundColor(Color.Transparent).onClick(() => router.back())
      }.width('100%').padding(18).backgroundColor(Theme.navy)
      Scroll() {
        Column() {
          Text('选择工位').fontSize(13).fontColor(Theme.navy).fontWeight(FontWeight.Bold).margin({ top: 16, bottom: 8 }).alignSelf(ItemAlign.Start)
          ForEach(FACTORY_STAGES, (stage: StageDefinition) => {
            Row() { Column() { Text(stage.name).fontSize(14).fontColor(Theme.text).fontWeight(FontWeight.Bold); Text(stage.code).fontSize(8).fontColor(Theme.muted).margin({ top: 3 }) }.alignItems(HorizontalAlign.Start).layoutWeight(1); Text(this.stageState(stage.code)).fontSize(9).fontColor(Theme.success); Text('进入 →').fontSize(10).fontColor(Theme.blue).margin({ left: 12 }) }.width('100%').padding(13).backgroundColor(this.selectedCode === stage.code ? '#E7F1F8' : Theme.panel).border({ width: { bottom: 1 }, color: Theme.line }).onClick(() => { this.selectedCode = stage.code; router.pushUrl({ url: 'pages/StageDetail', params: { stageCode: stage.code } }) })
          }, (stage: StageDefinition) => stage.code)
        }.width('100%').alignItems(HorizontalAlign.Start).padding({ left: 14, right: 14, bottom: 24 })
      }.width('100%').layoutWeight(1).backgroundColor(Theme.page)
    }.width('100%').height('100%')
  }

  private stageState(code: string): string {
    const item = this.bundle.runtime.stages.find(stage => stage.stageCode === code)
    return item === undefined ? 'RUNNING' : item.state
  }
}
