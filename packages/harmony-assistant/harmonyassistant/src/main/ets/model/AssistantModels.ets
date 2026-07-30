export type AssistantSourceApp = 'DISPLAY' | 'WORKSTATION' | 'ADMIN'
export type AssistantSelectionSource = 'ARKUI' | 'THREE_2D' | 'THREE_3D'
export type AssistantVisibility = 'VISIBLE' | 'HIDDEN'
export type AssistantSelectionAction = 'SELECT' | 'CLEAR'

export enum AssistantEntityType {
  LINE = 'LINE',
  STAGE = 'STAGE',
  KPI = 'KPI',
  SENSOR = 'SENSOR',
  ALARM = 'ALARM',
  INCIDENT = 'INCIDENT',
  DEVICE = 'DEVICE',
  PRODUCT = 'PRODUCT',
  PARAMETER = 'PARAMETER',
  TABLE_ROW = 'TABLE_ROW',
  AUDIT = 'AUDIT',
  CONFIG = 'CONFIG',
  KNOWLEDGE_DOCUMENT = 'KNOWLEDGE_DOCUMENT',
  TEXT_FRAGMENT = 'TEXT_FRAGMENT'
}

export enum AssistantQuestionType {
  FREE_TEXT = 'FREE_TEXT',
  SELECTION = 'SELECTION'
}

export enum AssistantAnswerMode {
  REALTIME = 'REALTIME',
  RAG = 'RAG',
  HYBRID = 'HYBRID'
}

export enum AssistantUiStatus {
  IDLE = 'IDLE',
  SENDING = 'SENDING',
  STREAMING = 'STREAMING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  STOPPED = 'STOPPED',
  UNAVAILABLE = 'UNAVAILABLE'
}

export interface AssistantServiceEndpoint {
  httpBaseUrl: string
  wsBaseUrl: string
}

export interface AssistantDisplayField {
  code: string
  label: string
  displayValue: string
  unit?: string
}

export interface AssistantEntityRef {
  entityType: string
  entityId: string
  lineId?: string
  stageCode?: string
  pageRoute?: string
}

export interface AssistantSelection {
  action: AssistantSelectionAction
  entityType: string
  entityId: string
  displayText: string
  source: AssistantSelectionSource
  pageRoute: string
  stateVersion?: number
  selectedAt: string
  fields: AssistantDisplayField[]
}

export interface AssistantContext {
  contextVersion: number
  sourceApp: AssistantSourceApp
  pageRoute: string
  capturedAt: string
  lineId?: string
  stageCode?: string
  deviceCode?: string
  traceCode?: string
  stateVersion?: number
  dataGeneratedAt?: string
  userRoleHint?: string
  selection?: AssistantSelection
}

export interface AssistantNavigationResult {
  handled: boolean
  reason?: string
}

export interface AssistantSubscription {
  unsubscribe(): void
}

export interface AssistantPanelOptions {
  defaultVisible?: boolean
  panelWidth?: number
  panelHeight?: number
  theme?: string
}

export interface AssistantCitation {
  citationId: string
  title: string
  source: string
  version: string
  excerpt: string
  entity?: AssistantEntityRef
}

export interface AssistantMessageView {
  messageId: string
  role: string
  content: string
  status: AssistantUiStatus
  answerMode?: AssistantAnswerMode
  dataGeneratedAt?: string
  stateVersion?: number
  knowledgeVersion?: string
  citations: AssistantCitation[]
  createdAt: string
}

export interface AssistantCreateConversationPayload {
  context: AssistantContext
}

export interface AssistantConversationResult {
  conversationId: string
  title: string
  createdAt: string
}

export interface AssistantSendMessagePayload {
  question: string
  questionType: AssistantQuestionType
  context: AssistantContext
}

export interface AssistantMessageResult {
  messageId: string
  content: string
  answerMode: AssistantAnswerMode
  status?: AssistantUiStatus
  dataGeneratedAt?: string
  stateVersion?: number
  knowledgeVersion?: string
  citations: AssistantCitation[]
  createdAt: string
}

export interface AssistantApiEnvelope<T> {
  code: number
  message: string
  data: T
  success: boolean
}
