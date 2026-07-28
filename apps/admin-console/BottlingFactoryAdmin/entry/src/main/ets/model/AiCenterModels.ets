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

