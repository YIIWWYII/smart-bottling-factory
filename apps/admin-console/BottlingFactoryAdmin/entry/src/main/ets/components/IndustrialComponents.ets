import { Theme, statusColor } from '../common/Theme'
import { DeviceDefinition, QualityGateView } from '../model/FactoryModels'

@Component
export struct SectionTitle {
  @Prop code: string = 'SECTION'
  @Prop title: string = ''
  @Prop description: string = ''

  build() {
    Row() {
      Column() {
        Text(this.code).fontSize(9).fontColor(Theme.accent).fontWeight(FontWeight.Bold).letterSpacing(0.8)
        Text(this.title).fontSize(19).fontColor(Theme.navy).fontWeight(FontWeight.Bold).margin({ top: 4 })
        if (this.description.length > 0) {
          Text(this.description).fontSize(10).fontColor(Theme.muted).margin({ top: 5 })
        }
      }.alignItems(HorizontalAlign.Start).layoutWeight(1)
    }
    .width('100%')
    .padding({ bottom: 14 })
    .border({ width: { bottom: 1 }, color: Theme.line })
  }
}

@Component
export struct MetricTile {
  @Prop label: string = ''
  @Prop value: string = '--'
  @Prop note: string = ''
  @Prop tone: string = 'NORMAL'

  build() {
    Column() {
      Text(this.label).fontSize(10).fontColor(Theme.muted)
      Text(this.value).fontSize(23).fontColor(Theme.navy).fontWeight(FontWeight.Bold).margin({ top: 7, bottom: 4 })
      Text(this.note).fontSize(9).fontColor(Theme.muted).maxLines(2)
    }
    .alignItems(HorizontalAlign.Start)
    .layoutWeight(1)
    .height(86)
    .padding(14)
    .backgroundColor(Theme.panel)
    .border({ width: { right: 1 }, color: Theme.line })
  }
}

@Component
export struct StateBadge {
  @Prop status: string = 'STANDBY'
  @Prop label: string = '待机'

  build() {
    Row({ space: 6 }) {
      Circle().width(8).height(8).fill(statusColor(this.status))
      Text(this.label).fontSize(10).fontColor(Theme.text).fontWeight(FontWeight.Medium)
    }
    .padding({ left: 8, right: 8, top: 4, bottom: 4 })
    .border({ width: { left: 2 }, color: statusColor(this.status) })
    .backgroundColor(Theme.panelSoft)
  }
}

@Component
export struct DeviceStateRow {
  @Prop index: number = 0
  @Prop device: DeviceDefinition = { code: '', name: '', role: '' }
  @Prop state: string = 'STANDBY'
  @Prop source: string = 'SIMULATION'
  @Prop reading: string = '查看参数'

  build() {
    Row({ space: 10 }) {
      Text((this.index + 1).toString().padStart(2, '0')).fontSize(9).fontColor(Theme.accent).width(24)
      Column() {
        Text(this.device.name).fontSize(12).fontColor(Theme.text).fontWeight(FontWeight.Bold)
        Text(this.device.code).fontSize(8).fontColor(Theme.muted).margin({ top: 3 })
      }.alignItems(HorizontalAlign.Start).layoutWeight(1)
      StateBadge({ status: this.state, label: this.state === 'RUNNING' ? '运行' : this.state === 'ALARM' ? '报警' : '待机' })
      Column() {
        Text(this.source).fontSize(9).fontColor(Theme.blue).fontWeight(FontWeight.Bold)
        Text(this.reading).fontSize(8).fontColor(Theme.muted).margin({ top: 3 })
      }.alignItems(HorizontalAlign.End).width(110)
    }
    .width('100%')
    .constraintSize({ minHeight: 58 })
    .padding({ left: 10, right: 10, top: 7, bottom: 7 })
    .border({ width: { bottom: 1 }, color: Theme.line })
    .backgroundColor(Theme.panel)
  }
}

@Component
export struct QualityGateRow {
  @Prop gate: QualityGateView = { label: '', standard: '', actual: '', status: 'WAIT', source: '' }

  build() {
    Row({ space: 10 }) {
      Circle().width(8).height(8).fill(statusColor(this.gate.status))
      Column() {
        Text(this.gate.label).fontSize(11).fontColor(Theme.text).fontWeight(FontWeight.Bold)
        Text('标准：' + this.gate.standard).fontSize(9).fontColor(Theme.muted).margin({ top: 3 })
      }.alignItems(HorizontalAlign.Start).layoutWeight(1)
      Column() {
        Text(this.gate.actual).fontSize(10).fontColor(statusColor(this.gate.status)).fontWeight(FontWeight.Bold)
        Text(this.gate.source).fontSize(8).fontColor(Theme.muted).margin({ top: 3 }).maxLines(1)
      }.alignItems(HorizontalAlign.End).width(150)
    }
    .width('100%')
    .constraintSize({ minHeight: 60 })
    .padding({ left: 10, right: 10, top: 7, bottom: 7 })
    .border({ width: { bottom: 1 }, color: Theme.line })
  }
}
