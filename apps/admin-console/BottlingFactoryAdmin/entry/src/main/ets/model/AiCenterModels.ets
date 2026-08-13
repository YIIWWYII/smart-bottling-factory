export interface AiApiEnvelope<T> {
  code: number
  message: string
  data: T
  success: boolean
}

export interface AiItemsResponse<T> {
  items: Array<T>
  source?: string
}

export interface AiProviderPreset {
  provider: string
  label: string
  description: string
  baseUrl: string
  models: Array<string>
  requiresApiKey: boolean
  compatible: boolean
}

export interface AiConfigResponse {
  config: AiRuntimeConfig
  source?: string
}

export interface AiRuntimeConfig {
  provider: string
  modelName: string
  baseUrl: string
  apiKey: string
  hasApiKey: boolean
  temperature: number
  maxTokens: number
  requestTimeoutSeconds: number
  retryCount: number
  streamingEnabled: boolean
  embeddingModel: string
  vectorStoreType: string
  vectorStoreUrl: string
  ragTopK: number
  chunkSize: number
  chunkOverlap: number
  knowledgeIndexEnabled: boolean
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
  knowledgeId?: string
  documentId?: string
  reviewId: string
  status: string
  statusReason: string
  fileName: string
  contentType: string
  size: number
  sha256: string
  title: string
  category?: string
  scopeApps?: Array<string>
  scopeLabel?: string
  tags?: Array<string>
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
  indexStatus?: string
  chunkCount?: number
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
  category: string
  scopeApps: Array<string>
  tags: Array<string>
  lineId: string
  stageCode: string
  deviceCode: string
  bottleTypeCode: string
}

export interface RagDocument {
  documentId: string
  submissionId: string
  reviewId: string
  title: string
  fileName: string
  contentType: string
  category: string
  scopeApps: Array<string>
  tags: Array<string>
  status: string
  indexStatus: string
  version: string
  sourceVersion: string
  chunkCount: number
  failureReason: string
  source: string
  updatedAt: string
}

export interface RagStatus {
  status: string
  knowledgeVersion: string
  documentCount: number
  indexedCount: number
  failedCount: number
  pendingCount: number
  vectorStoreType: string
  vectorStoreUrl: string
  embeddingModel: string
  ragTopK: number
  chunkSize: number
  chunkOverlap: number
  knowledgeIndexEnabled: boolean
}

export interface RagClassificationUpdate {
  category: string
  scopeApps: Array<string>
  tags: Array<string>
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
