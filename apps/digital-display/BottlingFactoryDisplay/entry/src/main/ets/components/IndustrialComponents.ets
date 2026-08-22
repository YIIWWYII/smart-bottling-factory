import { Theme, statusColor, statusSurface } from '../common/Theme'
import { DeviceDefinition, QualityGateView } from '../model/FactoryModels'

@Component
export struct SectionTitle {
  @Prop code: string = 'SECTION'
  @Prop title: string = ''
  @Prop description: string = ''
  @Prop dark: boolean = false

  build() {
    Row({ space: 12 }) {
      Text(this.code)
        .fontSize(8)
        .fontColor(this.dark ? Theme.accent : Theme.blue)
        .fontWeight(FontWeight.Bold)
        .width(104)
      Column() {
        Text(this.title).fontSize(15).fontColor(this.dark ? Theme.onDark : Theme.text).fontWeight(FontWeight.Bold)
        if (this.description.length > 0) {
          Text(this.description).fontSize(9).fontColor(this.dark ? Theme.onDarkMuted : Theme.muted).margin({ top: 4 }).maxLines(1)
        }
      }.alignItems(HorizontalAlign.Start).layoutWeight(1)
    }
    .width('100%')
    .padding({ left: 0, bottom: 10 })
    .border({ width: { bottom: 1 }, color: this.dark ? Theme.lineStrong : Theme.line })
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
      Text(this.label).fontSize(9).fontColor(Theme.muted).fontWeight(FontWeight.Medium)
      Text(this.value).fontSize(24).fontColor(this.tone === 'NORMAL' ? Theme.text : statusColor(this.tone)).fontWeight(FontWeight.Bold).margin({ top: 5, bottom: 3 })
      Text(this.note).fontSize(9).fontColor(Theme.muted).maxLines(2)
    }
    .alignItems(HorizontalAlign.Start)
    .width(174)
    .height(76)
    .padding({ left: 16, right: 12, top: 5, bottom: 5 })
    .backgroundColor(Color.Transparent)
    .border({ width: { left: 1 }, color: this.tone === 'NORMAL' ? Theme.lineStrong : statusColor(this.tone) })
  }
}

@Component
export struct StateBadge {
  @Prop status: string = 'STANDBY'
  @Prop label: string = '待机'

  build() {
    Row({ space: 6 }) {
      Circle().width(7).height(7).fill(statusColor(this.status))
      Text(this.label).fontSize(10).fontColor(statusColor(this.status)).fontWeight(FontWeight.Medium)
    }
    .padding({ left: 9, right: 9, top: 5, bottom: 5 })
    .border({ width: 1, color: statusColor(this.status) })
    .backgroundColor(statusSurface(this.status))
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
    .constraintSize({ minHeight: 62 })
    .padding({ left: 12, right: 12, top: 9, bottom: 9 })
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
    .constraintSize({ minHeight: 64 })
    .padding({ left: 12, right: 12, top: 9, bottom: 9 })
    .border({ width: { bottom: 1 }, color: Theme.line })
  }
}
