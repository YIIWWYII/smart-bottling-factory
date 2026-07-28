export enum AssistantSourceApp {
  DISPLAY = 'DISPLAY',
  WORKSTATION = 'WORKSTATION',
  ADMIN = 'ADMIN'
}

export enum AssistantEntityType {
  TEXT = 'TEXT',
  STAGE = 'STAGE',
  KPI = 'KPI',
  SENSOR = 'SENSOR',
  ALARM = 'ALARM',
  DEVICE = 'DEVICE',
  PRODUCT = 'PRODUCT',
  PARAMETER = 'PARAMETER',
  TABLE_ROW = 'TABLE_ROW',
  AUDIT = 'AUDIT',
  CONFIG = 'CONFIG',
  KNOWLEDGE_DOCUMENT = 'KNOWLEDGE_DOCUMENT'
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
  COMPLETE = 'COMPLETE',
  ERROR = 'ERROR',
  STOPPED = 'STOPPED',
  UNAVAILABLE = 'UNAVAILABLE'
}

export interface AssistantSelection {
  entityType: AssistantEntityType
  entityId: string
  displayText: string
  source: string
  pageRoute: string
  stateVersion: number
  selectedAt: string
  selectedText?: string
}

export interface AssistantContext {
  sourceApp: AssistantSourceApp
  pageRoute: string
  lineId: string
  stageCode?: string
  deviceCode?: string
  traceCode?: string
  stateVersion: number
  selectedEntityType?: AssistantEntityType
  selectedEntityId?: string
  selectedText?: string
  userRole: string
  capturedAt: string
}

export interface AssistantCitation {
  citationId: string
  title: string
  source: string
  version: string
  excerpt: string
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
