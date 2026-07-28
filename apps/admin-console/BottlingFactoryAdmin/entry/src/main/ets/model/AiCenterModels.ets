export interface AiApiEnvelope<T> {
  code: number
  message: string
  data: T
  success: boolean
}

export interface KnowledgeScope {
  lineIds: Array<string>
  stageCodes: Array<string>
  deviceCodes: Array<string>
  bottleTypeCodes: Array<string>
  parameterCodes: Array<string>
}

export interface KnowledgeSubmission {
  submissionId: string
  reviewId: string
  status: string
  statusReason: string
  fileName: string
  contentType: string
  size: number
  sha256: string
  title: string
  sourceOrganization: string
  author: string
  publishedAt: string
  sourceVersion: string
  description: string
  scope: KnowledgeScope
  submittedBy: string
  submittedAt: string
  reviewedBy: string
  reviewedAt: string
  reviewComment: string
  knowledgeSourceId: string
  publishedVersion: string
  indexedAt: string
}

export interface KnowledgeConflict {
  conflictId: string
  severity: string
  field: string
  message: string
  relatedSubmissionId: string
}

export interface KnowledgePreviewBlock {
  blockId: string
  heading: string
  content: string
  pageNumber: number
}

export interface KnowledgeReview {
  reviewId: string
  submission: KnowledgeSubmission
  preview: Array<KnowledgePreviewBlock>
  conflicts: Array<KnowledgeConflict>
  copyrightConfirmed: boolean
  sourceVerified: boolean
  unitsVerified: boolean
  scopeVerified: boolean
}

export interface KnowledgeReviewAction {
  comment: string
  clientRequestId: string
}

export interface KnowledgeUploadMetadata {
  title: string
  sourceOrganization: string
  author: string
  publishedAt: string
  sourceVersion: string
  description: string
  lineId: string
  stageCode: string
  deviceCode: string
  bottleTypeCode: string
}

export interface AiDecisionRecord {
  decisionId: string
  correlationId: string
  lineId: string
  stageCode: string
  deviceCode: string
  traceCode: string
  bottleTypeCode: string
  contextStateVersion: number
  knowledgeVersion: string
  databaseValidationId: string
  validationSummary: string
  status: string
  statusReason: string
  commandIds: Array<string>
  createdAt: string
  completedAt: string
}

export interface AiModelConfig {
  configId: string
  provider: string
  modelName: string
  baseUrl: string
  maskedApiKey: string
  requestTimeoutMs: number
  retryCount: number
  streamEnabled: boolean
  maxTokens: number
  temperature: number
  ragEnabled: boolean
  vectorStore: string
  embeddingModel: string
  knowledgeVersion: string
  status: string
  updatedBy: string
  updatedAt: string
}

export interface AiModelConfigUpdate {
  provider: string
  modelName: string
  baseUrl: string
  apiKey?: string
  requestTimeoutMs: number
  retryCount: number
  streamEnabled: boolean
  maxTokens: number
  temperature: number
  ragEnabled: boolean
  vectorStore: string
  embeddingModel: string
}

export interface AiConnectionTestRequest {
  question: string
  includeRag: boolean
}

export interface AiConnectionTestResult {
  success: boolean
  status: string
  errorType: string
  message: string
  latencyMs: number
  provider: string
  modelName: string
  ragReady: boolean
  knowledgeVersion: string
  occurredAt: string
}
