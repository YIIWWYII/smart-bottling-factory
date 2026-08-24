import { picker } from '@kit.CoreFileKit'
import { promptAction } from '@kit.ArkUI'
import { Theme } from '../common/Theme'
import { SectionTitle, StateBadge } from './IndustrialComponents'
import {
  KnowledgeConflict,
  KnowledgePreviewBlock,
  KnowledgeReview,
  KnowledgeSubmission,
  KnowledgeUploadMetadata,
  RagDocument,
  RagStatus
} from '../model/AiCenterModels'
import { aiCenterClient } from '../service/AiCenterClient'
import { AiCenterConfig } from '../service/AiCenterConfig'
import { SessionStore } from '../service/SessionStore'
import {
  PERMISSION_KNOWLEDGE_REVIEW,
  PERMISSION_KNOWLEDGE_SUBMIT,
  hasPermission,
  permissionLabel
} from '../service/AdminAccessPolicy'
import {
  adminAssistantSelectionBus,
  assistantField,
  createAdminSelection
} from '../service/AdminAssistantSelection'

@Component
export struct KnowledgeGovernance {
  @Prop query: string = ''
  @Prop filter: string = 'ALL'
  @Prop stateVersion: number = 0
  @State submissions: Array<KnowledgeSubmission> = []
  @State reviews: Array<KnowledgeReview> = []
  @State ragDocuments: Array<RagDocument> = []
  @State ragStatus: RagStatus | undefined = undefined
  @State selectedReview: KnowledgeReview | undefined = undefined
  @State loading: boolean = false
  @State serviceAvailable: boolean = false
  @State errorMessage: string = ''
  @State actionMessage: string = ''
  @State fileUri: string = ''
  @State fileName: string = ''
  @State contentType: string = 'application/octet-stream'
  @State title: string = ''
  @State sourceOrganization: string = ''
  @State author: string = ''
  @State publishedAt: string = ''
  @State sourceVersion: string = ''
  @State description: string = ''
  @State category: string = 'UNCLASSIFIED'
  @State scopeAppsText: string = 'ALL'
  @State tagsText: string = ''
  @State lineId: string = 'LINE-01'
  @State stageCode: string = ''
  @State deviceCode: string = ''
  @State bottleTypeCode: string = ''
  @State reviewComment: string = ''

  aboutToAppear(): void {
    if (SessionStore.isDemo) {
      this.errorMessage = '本地演示模式不访问 AI 中枢知识治理接口。'
      return
    }
    void this.refresh()
  }

  private currentRole(): string {
    return SessionStore.user === undefined ? '' : SessionStore.user.role
  }

  private currentUsername(): string {
    return SessionStore.user === undefined ? '' : SessionStore.user.username
  }

  private canSubmit(): boolean {
    return hasPermission(this.currentRole(), PERMISSION_KNOWLEDGE_SUBMIT) && !SessionStore.isDemo
  }

  private canReview(review: KnowledgeReview): boolean {
    return hasPermission(this.currentRole(), PERMISSION_KNOWLEDGE_REVIEW) &&
      !SessionStore.isDemo && review.submission.submittedBy !== this.currentUsername()
  }

  private canRevoke(review: KnowledgeReview): boolean {
    return this.canReview(review) && (review.submission.status === 'INDEXED' || review.submission.status === 'APPROVED')
  }

  private async refresh(): Promise<void> {
    if (SessionStore.isDemo) {
      this.submissions = []
      this.reviews = []
      this.ragDocuments = []
      this.ragStatus = undefined
      this.serviceAvailable = false
      this.errorMessage = '本地演示模式不访问 AI 中枢知识治理接口。'
      return
    }
    this.loading = true
    this.errorMessage = ''
    try {
      const submissionResult: Array<KnowledgeSubmission> = await aiCenterClient.listKnowledgeSubmissions()
      const reviewResult: Array<KnowledgeReview> = await aiCenterClient.listKnowledgeReviews()
      const ragStatusResult: RagStatus = await aiCenterClient.getRagStatus()
      const ragDocumentResult: Array<RagDocument> = await aiCenterClient.listRagDocuments()
      this.submissions = submissionResult
      this.reviews = reviewResult
      this.ragStatus = ragStatusResult
      this.ragDocuments = ragDocumentResult
      this.serviceAvailable = true
    } catch (error) {
      this.submissions = []
      this.reviews = []
      this.ragDocuments = []
      this.ragStatus = undefined
      this.serviceAvailable = false
      this.errorMessage = error instanceof Error ? error.message : 'AI 中枢知识治理接口不可用'
    } finally {
      this.loading = false
    }
  }

  private async chooseFile(): Promise<void> {
    if (!this.canSubmit()) {
      this.actionMessage = SessionStore.isDemo ? '演示账号只读，不能上传资料。' : '需要 ' + permissionLabel(PERMISSION_KNOWLEDGE_SUBMIT) + '。'
      return
    }
    try {
      const filePicker = new picker.DocumentViewPicker()
      const result: Array<string> = await filePicker.select()
      if (result.length === 0) return
      this.fileUri = result[0]
      this.fileName = this.nameFromUri(this.fileUri)
      this.contentType = this.contentTypeForName(this.fileName)
      if (this.title.length === 0) this.title = this.fileName
      this.actionMessage = '已选择：' + this.fileName
    } catch (error) {
      this.actionMessage = '选择文件失败：' + (error instanceof Error ? error.message : '系统文件选择器异常')
    }
  }

  private async upload(): Promise<void> {
    if (!this.canSubmit()) {
      this.actionMessage = SessionStore.isDemo ? '演示账号只读，不能上传资料。' : '需要 ' + permissionLabel(PERMISSION_KNOWLEDGE_SUBMIT) + '。'
      return
    }
    if (this.fileUri.length === 0 || this.title.trim().length === 0 || this.sourceOrganization.trim().length === 0 || this.sourceVersion.trim().length === 0) {
      this.actionMessage = '请选择文件，并填写标题、来源单位和原始版本。'
      return
    }
    const metadata: KnowledgeUploadMetadata = {
      title: this.title.trim(),
      sourceOrganization: this.sourceOrganization.trim(),
      author: this.author.trim(),
      publishedAt: this.publishedAt.trim(),
      sourceVersion: this.sourceVersion.trim(),
      description: this.description.trim(),
      category: this.category.trim().length === 0 ? 'UNCLASSIFIED' : this.category.trim(),
      scopeApps: this.parseScopeApps(),
      tags: this.parseTags(),
      lineId: this.lineId.trim(),
      stageCode: this.stageCode.trim(),
      deviceCode: this.deviceCode.trim(),
      bottleTypeCode: this.bottleTypeCode.trim()
    }
    this.loading = true
    try {
      const result: KnowledgeSubmission = await aiCenterClient.uploadKnowledge(this.fileUri, this.fileName, this.contentType, metadata)
      this.actionMessage = '资料已提交隔离区，审核单：' + (result.reviewId || '--') + '，状态：' + result.status
      promptAction.showToast({ message: '资料已提交，等待解析与审核' })
      this.clearUploadForm()
      await this.refresh()
    } catch (error) {
      this.actionMessage = '上传失败：' + (error instanceof Error ? error.message : 'AI 中枢请求失败')
    } finally {
      this.loading = false
    }
  }

  private async openReview(review: KnowledgeReview): Promise<void> {
    if (SessionStore.isDemo) {
      this.actionMessage = '演示账号只读，不能读取 AI 中枢审核详情。'
      return
    }
    this.loading = true
    try {
      this.selectedReview = await aiCenterClient.getKnowledgeReview(review.reviewId)
      this.publishKnowledgeSelection(this.selectedReview as KnowledgeReview)
    } catch (error) {
      this.actionMessage = '加载解析预览失败：' + (error instanceof Error ? error.message : 'AI 中枢请求失败')
    } finally {
      this.loading = false
    }
  }

  private reviewAction(review: KnowledgeReview, action: string): void {
    if (!this.canReview(review)) {
      this.actionMessage = review.submission.submittedBy === this.currentUsername()
        ? '提交人不能审核自己提交的资料。'
        : '需要 ' + permissionLabel(PERMISSION_KNOWLEDGE_REVIEW) + '。'
      return
    }
    if (this.reviewComment.trim().length < 3) {
      this.actionMessage = '请填写至少 3 个字符的审核意见。'
      return
    }
    const actionLabel: string = action === 'approve' ? '批准' : action === 'reject' ? '拒绝' : '撤销'
    AlertDialog.show({
      title: '确认' + actionLabel + '知识资料',
      message: action === 'approve'
        ? '批准后由 AI 中枢生成不可变版本并启动索引，只有 INDEXED 后才能参与 RAG。'
        : action === 'revoke'
          ? '撤销后历史审计保留，但该版本必须立即停止参与检索。'
          : '拒绝后资料不会进入正式知识库或向量索引。',
      primaryButton: { value: '确认' + actionLabel, action: () => void this.executeReviewAction(review, action) },
      secondaryButton: { value: '取消', action: () => {} }
    })
  }

  private async executeReviewAction(review: KnowledgeReview, action: string): Promise<void> {
    if (SessionStore.isDemo) {
      this.actionMessage = '演示账号只读，不能提交 AI 中枢审核操作。'
      return
    }
    this.loading = true
    try {
      let result: KnowledgeSubmission
      if (action === 'approve') result = await aiCenterClient.approveKnowledge(review.reviewId, this.reviewComment.trim())
      else if (action === 'reject') result = await aiCenterClient.rejectKnowledge(review.reviewId, this.reviewComment.trim())
      else result = await aiCenterClient.revokeKnowledge(review.reviewId, this.reviewComment.trim())
      this.actionMessage = 'AI 中枢已受理，审核单：' + result.reviewId + '，事实状态：' + result.status
      this.reviewComment = ''
      await this.refresh()
    } catch (error) {
      this.actionMessage = '审核操作失败：' + (error instanceof Error ? error.message : 'AI 中枢请求失败')
    } finally {
      this.loading = false
    }
  }

  private async reindexAll(): Promise<void> {
    if (SessionStore.isDemo) {
      this.actionMessage = '演示账号只读，不能触发 AI 中枢索引命令。'
      return
    }
    this.loading = true
    try {
      this.ragDocuments = await aiCenterClient.reindexRagDocuments()
      this.actionMessage = 'AI 中枢已重新触发索引，当前文档数：' + this.ragDocuments.length.toString()
      await this.refresh()
    } catch (error) {
      this.actionMessage = '重建索引失败：' + (error instanceof Error ? error.message : 'AI 中枢请求失败')
    } finally {
      this.loading = false
    }
  }

  private publishKnowledgeSelection(review: KnowledgeReview): void {
    const selection = createAdminSelection(
      'KNOWLEDGE_SUBMISSION',
      review.submission.submissionId,
      review.submission.title + ' · ' + review.submission.status,
      'AdminConsole/KNOWLEDGE',
      this.stateVersion,
      [
        assistantField('title', review.submission.title),
        assistantField('status', review.submission.status),
        assistantField('category', review.submission.category || 'UNCLASSIFIED'),
        assistantField('scopeApps', this.scopeLabel(review.submission.scopeApps)),
        assistantField('version', review.submission.publishedVersion || review.submission.sourceVersion),
        assistantField('source', review.submission.sourceOrganization),
        assistantField('occurredAt', review.submission.submittedAt)
      ]
    )
    adminAssistantSelectionBus.publish(selection)
  }

  private filteredReviews(): Array<KnowledgeReview> {
    const keyword: string = this.query.trim().toLowerCase()
    return this.reviews.filter((review: KnowledgeReview) => {
      const submission: KnowledgeSubmission = review.submission
      const content: string = (review.reviewId + ' ' + submission.submissionId + ' ' + submission.title + ' ' + submission.fileName + ' ' + submission.submittedBy).toLowerCase()
      const statusMatch: boolean = this.filter === 'ALL' || submission.status === this.filter
      return statusMatch && (keyword.length === 0 || content.indexOf(keyword) >= 0)
    })
  }

  private clearUploadForm(): void {
    this.fileUri = ''
    this.fileName = ''
    this.title = ''
    this.sourceOrganization = ''
    this.author = ''
    this.publishedAt = ''
    this.sourceVersion = ''
    this.description = ''
    this.category = 'UNCLASSIFIED'
    this.scopeAppsText = 'ALL'
    this.tagsText = ''
    this.stageCode = ''
    this.deviceCode = ''
    this.bottleTypeCode = ''
  }

  private nameFromUri(uri: string): string {
    const clean: string = uri.split('?')[0]
    const parts: Array<string> = clean.split('/')
    return decodeURIComponent(parts[parts.length - 1] || 'knowledge-file')
  }

  private contentTypeForName(name: string): string {
    const lower: string = name.toLowerCase()
    if (lower.endsWith('.pdf')) return 'application/pdf'
    if (lower.endsWith('.txt') || lower.endsWith('.md')) return 'text/plain'
    if (lower.endsWith('.doc')) return 'application/msword'
    if (lower.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.\u0064ocument'
    return 'application/octet-stream'
  }

  private ragReadableLabel(submission: KnowledgeSubmission): string {
    if (submission.status === 'INDEXED') return '已进入 RAG'
    if (submission.status === 'REVOKED') return '已撤销停用'
    if (submission.status === 'REJECTED') return '已拒绝'
    if (submission.status === 'FAILED') return '索引失败'
    return '未进入 RAG'
  }

  private ragReadableStatus(submission: KnowledgeSubmission): string {
    if (submission.status === 'INDEXED') return 'PASS'
    if (submission.status === 'REJECTED' || submission.status === 'FAILED' || submission.status === 'REVOKED') return 'FAILED'
    return 'WAIT'
  }

  private parseScopeApps(): Array<string> {
    const normalized: string = this.scopeAppsText.trim().length === 0 ? 'ALL' : this.scopeAppsText
    const result: Array<string> = []
    normalized.replace(/;/g, ',').split(',').forEach((item: string) => {
      const value: string = item.trim().toUpperCase()
      if ((value === 'ALL' || value === 'DISPLAY' || value === 'WORKSTATION' || value === 'ADMIN' || value === 'AI_CENTER') &&
        result.indexOf(value) < 0) {
        result.push(value)
      }
    })
    return result.length > 0 ? result : ['ALL']
  }

  private parseTags(): Array<string> {
    const result: Array<string> = []
    this.tagsText.replace(/;/g, ',').split(',').forEach((item: string) => {
      const value: string = item.trim()
      if (value.length > 0 && result.indexOf(value) < 0) result.push(value)
    })
    return result
  }

  private scopeLabel(scopeApps?: Array<string>): string {
    const values: Array<string> = scopeApps === undefined || scopeApps.length === 0 ? ['ALL'] : scopeApps
    if (values.indexOf('ALL') >= 0) return '全部端可读'
    return values.join(',')
  }

  build() {
    Column({ space: 14 }) {
      SectionTitle({ code: 'KNOWLEDGE GOVERNANCE', title: '知识资料与审核', description: '资料只写入独立 AI 中枢；批准并完成索引后才允许参与 RAG。' })
      this.serviceState()
      this.uploadPanel()
      this.reviewQueue()
      this.previewPanel()
      if (this.actionMessage.length > 0) {
        Text(this.actionMessage).fontSize(10).fontColor(Theme.warning).width('100%').padding(10).backgroundColor(Theme.warningSoft)
      }
    }.width('100%').alignItems(HorizontalAlign.Start).padding(16).backgroundColor(Theme.panel).border({ width: { top: 3, left: 1, right: 1, bottom: 1 }, color: Theme.line })
  }

  @Builder
  serviceState() {
    Row({ space: 10 }) {
      StateBadge({ status: this.serviceAvailable ? 'PASS' : 'FAILED', label: this.serviceAvailable ? 'AI 中枢在线' : 'AI 中枢不可用' })
      Text(AiCenterConfig.API_BASE).fontSize(9).fontColor(Theme.muted).layoutWeight(1)
      if (this.ragStatus !== undefined) {
        StateBadge({ status: (this.ragStatus as RagStatus).status, label: 'RAG ' + (this.ragStatus as RagStatus).status })
        Text('文档 ' + (this.ragStatus as RagStatus).documentCount.toString() + ' / 已索引 ' + (this.ragStatus as RagStatus).indexedCount.toString()).fontSize(9).fontColor(Theme.muted)
      }
      Button('重建索引').enabled(this.canSubmit() && !this.loading).height(34).backgroundColor(this.canSubmit() ? Theme.warning : Theme.neutral).fontColor('#FFFFFF').onClick(() => void this.reindexAll())
      Button('刷新').height(34).backgroundColor(Theme.blue).fontColor('#FFFFFF').onClick(() => void this.refresh())
    }.width('100%')
    if (this.loading) {
      Row({ space: 8 }) {
        LoadingProgress().width(18).height(18).color(Theme.blue)
        Text('正在读取 AI 中枢事实状态...').fontSize(10).fontColor(Theme.muted)
      }.width('100%').padding(8).backgroundColor(Theme.panelSoft)
    }
    if (this.errorMessage.length > 0) {
      Text('接口阻塞：' + this.errorMessage + '。页面不会以本地数据伪造审核或索引成功。').fontSize(10).fontColor(Theme.danger).width('100%').padding(10).backgroundColor(Theme.dangerSoft)
    }
  }

  @Builder
  uploadPanel() {
    Column({ space: 8 }) {
      Text('提交知识资料').fontSize(14).fontColor(Theme.text).fontWeight(FontWeight.Bold)
      Row({ space: 8 }) {
        Button('选择文件').enabled(this.canSubmit()).height(36).backgroundColor(this.canSubmit() ? Theme.blue : Theme.neutral).fontColor('#FFFFFF').onClick(() => void this.chooseFile())
        Text(this.fileName.length > 0 ? this.fileName : '支持 PDF、Word、TXT、Markdown；文件先进入隔离区。').fontSize(10).fontColor(Theme.muted).layoutWeight(1).maxLines(2)
      }.width('100%')
      Row({ space: 8 }) {
        TextInput({ text: this.title, placeholder: '资料标题 *' }).layoutWeight(1).onChange((value: string) => this.title = value)
        TextInput({ text: this.sourceOrganization, placeholder: '来源单位 *' }).layoutWeight(1).onChange((value: string) => this.sourceOrganization = value)
        TextInput({ text: this.sourceVersion, placeholder: '原始版本 *' }).layoutWeight(1).onChange((value: string) => this.sourceVersion = value)
      }.width('100%')
      Row({ space: 8 }) {
        TextInput({ text: this.author, placeholder: '作者/发布方' }).layoutWeight(1).onChange((value: string) => this.author = value)
        TextInput({ text: this.publishedAt, placeholder: '发布日期 YYYY-MM-DD' }).layoutWeight(1).onChange((value: string) => this.publishedAt = value)
        TextInput({ text: this.lineId, placeholder: '适用产线' }).layoutWeight(1).onChange((value: string) => this.lineId = value)
      }.width('100%')
      Row({ space: 8 }) {
        TextInput({ text: this.stageCode, placeholder: '适用工位代码' }).layoutWeight(1).onChange((value: string) => this.stageCode = value)
        TextInput({ text: this.deviceCode, placeholder: '适用设备代码' }).layoutWeight(1).onChange((value: string) => this.deviceCode = value)
        TextInput({ text: this.bottleTypeCode, placeholder: '适用瓶型代码' }).layoutWeight(1).onChange((value: string) => this.bottleTypeCode = value)
      }.width('100%')
      Row({ space: 8 }) {
        TextInput({ text: this.category, placeholder: '分类：UNCLASSIFIED / PROCESS_SAFETY / QUALITY_INSPECTION' }).layoutWeight(1).onChange((value: string) => this.category = value)
        TextInput({ text: this.scopeAppsText, placeholder: '适用端：ALL 或 DISPLAY,WORKSTATION,ADMIN,AI_CENTER' }).layoutWeight(1).onChange((value: string) => this.scopeAppsText = value)
        TextInput({ text: this.tagsText, placeholder: '标签：PLA,VOC,灌装' }).layoutWeight(1).onChange((value: string) => this.tagsText = value)
      }.width('100%')
      Text('不分类时 category=UNCLASSIFIED，scopeApps 默认 ALL，表示展板端、工位端、后台管理端和 AI 决策中枢都可以检索。').fontSize(9).fontColor(Theme.warning)
      TextArea({ text: this.description, placeholder: '资料说明、适用范围和版权声明' }).height(70).width('100%').onChange((value: string) => this.description = value)
      Row({ space: 10 }) {
        Button('提交到隔离区').enabled(this.canSubmit() && !this.loading).backgroundColor(this.canSubmit() ? Theme.blue : Theme.neutral).fontColor('#FFFFFF').onClick(() => AlertDialog.show({
          title: '确认提交知识资料',
          message: '提交后只进入 AI 中枢隔离区和审核队列，不会立即参与 RAG，也不会写入生产后端数据库。',
          primaryButton: { value: '确认提交', action: () => void this.upload() },
          secondaryButton: { value: '取消', action: () => {} }
        }))
        Text(this.canSubmit() ? '具备 KNOWLEDGE_SUBMIT 权限' : '上传需要 ' + permissionLabel(PERMISSION_KNOWLEDGE_SUBMIT)).fontSize(10).fontColor(this.canSubmit() ? Theme.success : Theme.warning)
      }.width('100%')
    }.width('100%').padding(12).backgroundColor(Theme.panelSoft).border({ width: 1, color: Theme.line })
  }

  @Builder
  reviewQueue() {
    Column() {
      Text('审核队列与索引进度').fontSize(14).fontColor(Theme.text).fontWeight(FontWeight.Bold).margin({ bottom: 8 })
      if (this.filteredReviews().length === 0) {
        Text(this.serviceAvailable ? '没有匹配的审核任务。' : 'AI 中枢不可用，无法取得审核队列。').fontSize(11).fontColor(Theme.muted).padding(20).width('100%').textAlign(TextAlign.Center)
      } else {
        ForEach(this.filteredReviews(), (review: KnowledgeReview) => {
          Row({ space: 10 }) {
            Column() {
              Text(review.submission.title).fontSize(11).fontColor(Theme.text).fontWeight(FontWeight.Bold)
              Text(review.reviewId + ' · 提交人 ' + review.submission.submittedBy + ' · ' + review.submission.submittedAt).fontSize(9).fontColor(Theme.muted).margin({ top: 4 })
              Text('分类：' + (review.submission.category || 'UNCLASSIFIED') + ' · 适用端：' + this.scopeLabel(review.submission.scopeApps) + ' · 标签：' + ((review.submission.tags || []).join(',') || '--')).fontSize(9).fontColor(Theme.blue).margin({ top: 4 })
              Text('知识版本：' + (review.submission.publishedVersion || '--') + ' · 索引时间：' + (review.submission.indexedAt || '--') + ' · 原因：' + (review.submission.statusReason || '--')).fontSize(9).fontColor(Theme.muted).margin({ top: 4 })
            }.alignItems(HorizontalAlign.Start).layoutWeight(1)
            StateBadge({ status: review.submission.status, label: review.submission.status })
            StateBadge({ status: this.ragReadableStatus(review.submission), label: this.ragReadableLabel(review.submission) })
            Text(review.conflicts.length.toString() + ' 个冲突').fontSize(10).fontColor(review.conflicts.length > 0 ? Theme.danger : Theme.muted).width(80)
            Button('解析预览').type(ButtonType.Normal).fontColor(Theme.blue).backgroundColor(Color.Transparent).onClick(() => void this.openReview(review))
          }.width('100%').padding(10).border({ width: { bottom: 1 }, color: Theme.line })
        }, (review: KnowledgeReview) => review.reviewId)
      }
    }.width('100%')
  }

  @Builder
  previewPanel() {
    Column({ space: 8 }) {
      Text('解析预览与审核').fontSize(14).fontColor(Theme.text).fontWeight(FontWeight.Bold)
      if (this.selectedReview === undefined) {
        Text('请选择审核任务查看原文解析、来源、适用范围、冲突和版权检查。').fontSize(10).fontColor(Theme.muted).padding(18).width('100%')
      } else {
        Text(this.selectedReview?.submission.title || '--').fontSize(12).fontColor(Theme.text).fontWeight(FontWeight.Bold)
        Text('来源：' + (this.selectedReview?.submission.sourceOrganization || '--') + ' · 版本：' + (this.selectedReview?.submission.sourceVersion || '--')).fontSize(10).fontColor(Theme.muted)
        Text('分类：' + ((this.selectedReview as KnowledgeReview).submission.category || 'UNCLASSIFIED') +
          ' · 适用端：' + this.scopeLabel((this.selectedReview as KnowledgeReview).submission.scopeApps) +
          ' · 标签：' + (((this.selectedReview as KnowledgeReview).submission.tags || []).join(',') || '--')).fontSize(10).fontColor(Theme.blue)
        Row({ space: 8 }) {
          StateBadge({ status: this.ragReadableStatus((this.selectedReview as KnowledgeReview).submission), label: this.ragReadableLabel((this.selectedReview as KnowledgeReview).submission) })
          Text('发布版本：' + ((this.selectedReview as KnowledgeReview).submission.publishedVersion || '--')).fontSize(10).fontColor(Theme.muted)
          Text('索引时间：' + ((this.selectedReview as KnowledgeReview).submission.indexedAt || '--')).fontSize(10).fontColor(Theme.muted)
          Text('失败/拒绝原因：' + ((this.selectedReview as KnowledgeReview).submission.statusReason || '--')).fontSize(10).fontColor(Theme.muted).layoutWeight(1)
        }.width('100%')
        Row({ space: 8 }) {
          this.checkBadge('来源', this.selectedReview?.sourceVerified || false)
          this.checkBadge('单位', this.selectedReview?.unitsVerified || false)
          this.checkBadge('范围', this.selectedReview?.scopeVerified || false)
          this.checkBadge('版权', this.selectedReview?.copyrightConfirmed || false)
        }.width('100%')
        ForEach(this.selectedReview?.conflicts || [], (conflict: KnowledgeConflict) => {
          Text(conflict.severity + ' · ' + conflict.field + '：' + conflict.message).fontSize(10).fontColor(Theme.danger).width('100%').padding(8).backgroundColor(Theme.dangerSoft)
        }, (conflict: KnowledgeConflict) => conflict.conflictId)
        ForEach(this.selectedReview?.preview || [], (block: KnowledgePreviewBlock) => {
          Column() {
            Text((block.heading || '解析内容') + ' · 第 ' + block.pageNumber.toString() + ' 页').fontSize(10).fontColor(Theme.blue).fontWeight(FontWeight.Bold)
            Text(block.content).fontSize(10).fontColor(Theme.text).maxLines(6).margin({ top: 4 })
          }.width('100%').alignItems(HorizontalAlign.Start).padding(10).backgroundColor(Theme.panelSoft)
        }, (block: KnowledgePreviewBlock) => block.blockId)
        TextArea({ text: this.reviewComment, placeholder: '审核意见（批准、拒绝或撤销均必填）' }).height(72).width('100%').onChange((value: string) => this.reviewComment = value)
        Row({ space: 8 }) {
          Button('批准并索引').enabled(this.canReview(this.selectedReview as KnowledgeReview)).backgroundColor(this.canReview(this.selectedReview as KnowledgeReview) ? Theme.success : Theme.neutral).fontColor('#FFFFFF').onClick(() => this.reviewAction(this.selectedReview as KnowledgeReview, 'approve'))
          Button('拒绝').enabled(this.canReview(this.selectedReview as KnowledgeReview)).backgroundColor(this.canReview(this.selectedReview as KnowledgeReview) ? Theme.danger : Theme.neutral).fontColor('#FFFFFF').onClick(() => this.reviewAction(this.selectedReview as KnowledgeReview, 'reject'))
          Button('撤销版本').enabled(this.canRevoke(this.selectedReview as KnowledgeReview)).backgroundColor(this.canRevoke(this.selectedReview as KnowledgeReview) ? Theme.warning : Theme.neutral).fontColor('#FFFFFF').onClick(() => this.reviewAction(this.selectedReview as KnowledgeReview, 'revoke'))
          Text(this.selectedReview?.submission.submittedBy === this.currentUsername() ? '提交人不可自审' : '服务端将再次校验 KNOWLEDGE_REVIEW').fontSize(9).fontColor(Theme.muted).layoutWeight(1)
        }.width('100%')
      }
    }.width('100%').padding(12).backgroundColor(Theme.panelSoft).border({ width: 1, color: Theme.line })
  }

  @Builder
  checkBadge(label: string, passed: boolean) {
    Text(label + ' ' + (passed ? '已核验' : '待核验')).fontSize(9).fontColor(passed ? Theme.success : Theme.warning).padding({ left: 8, right: 8, top: 5, bottom: 5 }).border({ width: 1, color: passed ? Theme.success : Theme.warning })
  }
}
