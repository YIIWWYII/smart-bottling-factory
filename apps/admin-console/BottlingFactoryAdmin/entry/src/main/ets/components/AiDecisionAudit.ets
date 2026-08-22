import { Theme } from '../common/Theme'
import { SectionTitle, StateBadge } from './IndustrialComponents'
import { AiDecisionRecord } from '../model/AiCenterModels'
import { aiCenterClient } from '../service/AiCenterClient'
import { AiCenterConfig } from '../service/AiCenterConfig'
import { SessionStore } from '../service/SessionStore'
import {
  adminAssistantSelectionBus,
  assistantField,
  createAdminSelection
} from '../service/AdminAssistantSelection'

@Component
export struct AiDecisionAuditPanel {
  @Prop query: string = ''
  @Prop filter: string = 'ALL'
  @Prop stateVersion: number = 0
  @State decisions: Array<AiDecisionRecord> = []
  @State selected: AiDecisionRecord | undefined = undefined
  @State loading: boolean = false
  @State errorMessage: string = ''

  aboutToAppear(): void {
    if (SessionStore.isDemo) {
      this.errorMessage = '本地演示模式不访问 AI 中枢决策接口。'
      return
    }
    void this.refresh()
  }

  private async refresh(): Promise<void> {
    if (SessionStore.isDemo) {
      this.decisions = []
      this.errorMessage = '本地演示模式不访问 AI 中枢决策接口。'
      return
    }
    this.loading = true
    this.errorMessage = ''
    try {
      this.decisions = await aiCenterClient.listDecisions()
    } catch (error) {
      this.decisions = []
      this.errorMessage = error instanceof Error ? error.message : 'AI 中枢决策接口不可用'
    } finally {
      this.loading = false
    }
  }

  private filtered(): Array<AiDecisionRecord> {
    const keyword: string = this.query.trim().toLowerCase()
    return this.decisions.filter((decision: AiDecisionRecord) => {
      const content: string = (decision.decisionId + ' ' + decision.traceCode + ' ' + decision.stageCode + ' ' + decision.deviceCode + ' ' + decision.knowledgeVersion + ' ' + decision.status).toLowerCase()
      return (this.filter === 'ALL' || decision.status === this.filter) && (keyword.length === 0 || content.indexOf(keyword) >= 0)
    })
  }

  private selectDecision(decision: AiDecisionRecord): void {
    this.selected = decision
    const selection = createAdminSelection(
      'AI_DECISION',
      decision.decisionId,
      decision.status + ' · ' + (decision.statusReason || decision.validationSummary),
      'AdminConsole/AI_AUDIT',
      decision.contextStateVersion || this.stateVersion,
      [
        assistantField('lineId', decision.lineId),
        assistantField('stageCode', decision.stageCode),
        assistantField('deviceCode', decision.deviceCode),
        assistantField('traceCode', decision.traceCode),
        assistantField('status', decision.status),
        assistantField('version', decision.knowledgeVersion),
        assistantField('occurredAt', decision.createdAt)
      ]
    )
    adminAssistantSelectionBus.publish(selection)
  }

  build() {
    Column({ space: 12 }) {
      SectionTitle({ code: 'AI DECISION AUDIT', title: 'AI 决策审计', description: '读取独立 AI 中枢，核对识别、RAG、数据库校验、字段建议、人工锁和最终回执。' })
      Row({ space: 10 }) {
        Text(AiCenterConfig.API_BASE + '/decisions').fontSize(9).fontColor(Theme.muted).layoutWeight(1)
        Button('刷新').height(34).backgroundColor(Theme.blue).fontColor('#FFFFFF').onClick(() => void this.refresh())
      }.width('100%')
      if (this.loading) {
        Row({ space: 8 }) {
          LoadingProgress().width(18).height(18).color(Theme.blue)
          Text('正在读取 AI 决策事实记录...').fontSize(10).fontColor(Theme.muted)
        }.width('100%').padding(8).backgroundColor(Theme.panelSoft)
      }
      if (this.errorMessage.length > 0) {
        Text('接口阻塞：' + this.errorMessage + '。旧 Spring Boot AI 兼容接口不作为新决策审计数据源。').fontSize(10).fontColor(Theme.danger).width('100%').padding(10).backgroundColor(Theme.dangerSoft)
      }
      if (!this.loading && this.filtered().length === 0) {
        Text(this.errorMessage.length > 0 ? '无法取得 AI 中枢决策记录。' : '没有匹配的 AI 决策记录。').fontSize(11).fontColor(Theme.muted).width('100%').padding(24).textAlign(TextAlign.Center).backgroundColor(Theme.panelSoft)
      } else {
        ForEach(this.filtered(), (decision: AiDecisionRecord) => {
          Row({ space: 10 }) {
            Column() {
              Text(decision.decisionId).fontSize(11).fontColor(Theme.blue).fontWeight(FontWeight.Bold)
              Text((decision.traceCode || '--') + ' · ' + (decision.stageCode || '--') + ' · ' + (decision.deviceCode || '--')).fontSize(9).fontColor(Theme.muted).margin({ top: 4 })
            }.alignItems(HorizontalAlign.Start).width(250)
            StateBadge({ status: decision.status, label: decision.status })
            Text(decision.validationSummary || decision.statusReason || '--').fontSize(10).fontColor(Theme.text).layoutWeight(1).maxLines(2)
            Button('审计详情').type(ButtonType.Normal).fontColor(Theme.blue).backgroundColor(Color.Transparent).onClick(() => this.selectDecision(decision))
          }.width('100%').padding(10).border({ width: { bottom: 1 }, color: Theme.line })
        }, (decision: AiDecisionRecord) => decision.decisionId)
      }
      this.detailPanel()
    }.width('100%').alignItems(HorizontalAlign.Start).padding(16).backgroundColor(Theme.panel).border({ width: { top: 3, left: 1, right: 1, bottom: 1 }, color: Theme.line })
  }

  @Builder
  detailPanel() {
    Column() {
      Text('决策详情').fontSize(13).fontColor(Theme.navy).fontWeight(FontWeight.Bold)
      if (this.selected === undefined) {
        Text('请选择一条 AI 决策记录。').fontSize(10).fontColor(Theme.muted).margin({ top: 8 })
      } else {
        Text('决策号：' + (this.selected?.decisionId || '--') + '\n关联号：' + (this.selected?.correlationId || '--') + '\n上下文版本：' + (this.selected?.contextStateVersion.toString() || '--') + '\n知识版本：' + (this.selected?.knowledgeVersion || '--') + '\n数据库校验：' + (this.selected?.databaseValidationId || '--') + '\n命令：' + ((this.selected?.commandIds || []).join(', ') || '未创建命令') + '\n最终状态：' + (this.selected?.status || '--') + '\n原因：' + (this.selected?.statusReason || '--'))
          .fontSize(10).fontColor(Theme.text).lineHeight(18).margin({ top: 8 }).width('100%')
      }
    }.width('100%').padding(12).backgroundColor(Theme.panelSoft).border({ width: 1, color: Theme.line })
  }
}
