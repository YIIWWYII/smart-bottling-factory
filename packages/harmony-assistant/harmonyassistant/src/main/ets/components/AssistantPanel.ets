import { AssistantController } from '../controller/AssistantController'
import { AssistantCitation, AssistantMessageView, AssistantUiStatus } from '../model/AssistantModels'

const PANEL_BACKGROUND: string = '#F5F8FC'
const PANEL_SURFACE: string = '#FFFFFF'
const PANEL_BORDER: string = '#B6C5D7'
const PANEL_TEXT: string = '#17293D'
const PANEL_MUTED: string = '#65778B'
const PANEL_BLUE: string = '#1769AA'
const PANEL_DANGER: string = '#B3261E'

@Component
struct AssistantMessageCard {
  @Prop message: AssistantMessageView = {
    messageId: '',
    role: 'ASSISTANT',
    content: '',
    status: AssistantUiStatus.COMPLETED,
    citations: [],
    createdAt: ''
  }
  // Keep streamed text as a primitive prop so List item reuse cannot retain an older object field.
  @Prop content: string = ''

  build() {
    Column({ space: 7 }) {
      Row() {
        Text(this.message.role === 'USER' ? '用户' : '产线助手')
          .fontSize(11)
          .fontWeight(FontWeight.Bold)
          .fontColor(this.message.role === 'USER' ? PANEL_MUTED : PANEL_BLUE)
        Blank()
        if (this.message.stateVersion !== undefined) {
          Text('v' + this.message.stateVersion.toString()).fontSize(9).fontColor(PANEL_MUTED)
        }
      }.width('100%')
      Text(this.content)
        .width('100%')
        .fontSize(13)
        .fontColor(PANEL_TEXT)
        .lineHeight(20)
        .maxLines(100)
      if (this.message.dataGeneratedAt !== undefined || this.message.knowledgeVersion !== undefined) {
        Row({ space: 8 }) {
          if (this.message.dataGeneratedAt !== undefined) {
            Text('数据 ' + this.message.dataGeneratedAt).fontSize(9).fontColor(PANEL_MUTED)
          }
          if (this.message.knowledgeVersion !== undefined) {
            Text('知识 ' + this.message.knowledgeVersion).fontSize(9).fontColor(PANEL_MUTED)
          }
        }.width('100%')
      }
      if (this.message.citations !== undefined && this.message.citations.length > 0) {
        Column({ space: 5 }) {
          ForEach(this.message.citations, (citation: AssistantCitation) => {
            Text(citation.title + ' · ' + citation.version)
              .width('100%')
              .fontSize(10)
              .fontColor(PANEL_BLUE)
              .maxLines(2)
          }, (citation: AssistantCitation) => citation.citationId)
        }.width('100%').alignItems(HorizontalAlign.Start)
      }
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
    .padding(12)
    .backgroundColor(this.message.role === 'USER' ? '#EAF1F8' : PANEL_SURFACE)
    .border({ width: 1, color: PANEL_BORDER })
    .borderRadius(4)
  }
}

@Component
export struct AssistantPanel {
  @ObjectLink controller: AssistantController
  @Prop panelWidth: number = 410
  @Prop panelHeight: number = 620

  build() {
    Column() {
      Row({ space: 10 }) {
        Column() {
          Text('产线上下文助手').fontSize(17).fontWeight(FontWeight.Bold).fontColor(PANEL_TEXT)
          Text(this.controller.adapter.sourceApp).fontSize(9).fontColor(PANEL_MUTED).margin({ top: 2 })
        }.alignItems(HorizontalAlign.Start).layoutWeight(1)
        Button('关闭')
          .fontSize(11)
          .height(34)
          .backgroundColor('#DCE7F2')
          .fontColor(PANEL_TEXT)
          .borderRadius(3)
          .onClick(() => this.controller.close())
      }
      .width('100%')
      .padding(12)
      .border({ width: { bottom: 1 }, color: PANEL_BORDER })

      if (this.controller.activeSelection !== undefined) {
        Row({ space: 8 }) {
          Column() {
            Text('当前选择').fontSize(9).fontColor(PANEL_MUTED)
            Text(this.controller.activeSelection.displayText)
              .fontSize(11)
              .fontWeight(FontWeight.Bold)
              .fontColor(PANEL_TEXT)
              .maxLines(2)
          }.alignItems(HorizontalAlign.Start).layoutWeight(1)
          Button('定位').height(30).fontSize(10).borderRadius(3)
            .onClick(() => { void this.controller.navigateToSelection() })
          Button('清除').height(30).fontSize(10).borderRadius(3)
            .onClick(() => this.controller.clearSelection())
        }
        .width('100%')
        .padding(10)
        .backgroundColor('#EAF1F8')
        .border({ width: { bottom: 1 }, color: PANEL_BORDER })
      }

      List({ space: 8 }) {
        ForEach(this.controller.messages, (message: AssistantMessageView) => {
          ListItem() {
            AssistantMessageCard({ message: message, content: message.content })
          }
        }, (message: AssistantMessageView) => message.messageId + ':' + message.content.length.toString())
        if (this.controller.status === AssistantUiStatus.SENDING || this.controller.status === AssistantUiStatus.STREAMING) {
          ListItem() {
            Row({ space: 8 }) {
              LoadingProgress().width(18).height(18).color(PANEL_BLUE)
              Text('正在查询产线事实与知识库').fontSize(11).fontColor(PANEL_MUTED)
            }.width('100%').padding(10)
          }
        }
      }
      .layoutWeight(1)
      .width('100%')
      .padding(10)

      if (this.controller.errorMessage.length > 0) {
        Text(this.controller.errorMessage)
          .width('100%')
          .padding({ left: 12, right: 12, top: 8, bottom: 8 })
          .fontSize(11)
          .fontColor(this.controller.status === AssistantUiStatus.FAILED ? PANEL_DANGER : PANEL_MUTED)
          .backgroundColor('#FFF1F0')
      }

      TextArea({ text: this.controller.draft, placeholder: '询问当前页面、设备、产品或知识资料' })
        .width('100%')
        .height(86)
        .fontSize(13)
        .backgroundColor(PANEL_SURFACE)
        .border({ width: 1, color: PANEL_BORDER })
        .borderRadius(3)
        .onChange((value: string) => this.controller.setDraft(value))
        .margin({ left: 10, right: 10, bottom: 8 })

      Row({ space: 8 }) {
        if (this.controller.status === AssistantUiStatus.SENDING || this.controller.status === AssistantUiStatus.STREAMING) {
          Button('停止')
            .layoutWeight(1)
            .height(38)
            .backgroundColor(PANEL_DANGER)
            .borderRadius(3)
            .onClick(() => this.controller.stop())
        } else {
          if (this.controller.status === AssistantUiStatus.FAILED ||
            this.controller.status === AssistantUiStatus.STOPPED) {
            Button('重试')
              .height(38)
              .backgroundColor('#DCE7F2')
              .fontColor(PANEL_TEXT)
              .borderRadius(3)
              .onClick(() => { void this.controller.retry() })
          }
          Button(this.controller.activeSelection === undefined ? '发送问题' : '询问所选内容')
            .layoutWeight(1)
            .height(38)
            .backgroundColor(PANEL_BLUE)
            .borderRadius(3)
            .onClick(() => { void this.controller.sendQuestion() })
        }
      }.width('100%').padding({ left: 10, right: 10, bottom: 10 })
    }
    .width(this.panelWidth)
    .height(this.panelHeight)
    .backgroundColor(PANEL_BACKGROUND)
    .border({ width: 2, color: PANEL_BORDER })
    .borderRadius(4)
  }
}

@Component
export struct AssistantDock {
  @ObjectLink controller: AssistantController
  @Prop panelWidth: number = 410
  @Prop panelHeight: number = 620

  build() {
    Column() {
      if (this.controller.visible) {
        AssistantPanel({
          controller: this.controller,
          panelWidth: this.panelWidth,
          panelHeight: this.panelHeight
        })
      } else {
        Button('AI')
          .width(52)
          .height(52)
          .fontSize(14)
          .fontWeight(FontWeight.Bold)
          .fontColor('#FFFFFF')
          .backgroundColor(PANEL_BLUE)
          .border({ width: 2, color: '#FFFFFF' })
          .borderRadius(3)
          .onClick(() => this.controller.open())
      }
    }
    .width(this.controller.visible ? this.panelWidth : 52)
    .height(this.controller.visible ? this.panelHeight : 52)
  }
}
