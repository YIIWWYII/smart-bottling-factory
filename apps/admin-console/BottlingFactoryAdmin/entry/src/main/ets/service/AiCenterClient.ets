import { http } from '@kit.NetworkKit'
import { fileIo } from '@kit.CoreFileKit'
import { util } from '@kit.ArkTS'
import { SessionStore } from './SessionStore'
import { AiCenterConfig } from './AiCenterConfig'
import {
  AiApiEnvelope,
  AiConnectionTestRequest,
  AiConnectionTestResult,
  AiDecisionRecord,
  AiModelConfig,
  AiModelConfigUpdate,
  KnowledgeReview,
  KnowledgeReviewAction,
  KnowledgeSubmission,
  KnowledgeUploadMetadata
} from '../model/AiCenterModels'

interface AiRequestHeaders {
  'Content-Type': string
  Authorization?: string
}

export class AiCenterError extends Error {
  code: number

  constructor(message: string, code: number = -1) {
    super(message)
    this.code = code
  }
}

export class AiCenterClient {
  async request<T>(path: string, method: http.RequestMethod = http.RequestMethod.GET, body?: string): Promise<T> {
    const client = http.createHttp()
    const headers: AiRequestHeaders = this.headers('application/json;charset=UTF-8')
    try {
      const response = await client.request(AiCenterConfig.API_BASE + path, {
        method: method,
        header: headers,
        extraData: body,
        expectDataType: http.HttpDataType.STRING,
        connectTimeout: AiCenterConfig.requestTimeoutMs,
        readTimeout: AiCenterConfig.requestTimeoutMs
      })
      return this.unwrap<T>(response.responseCode, response.result as string)
    } finally {
      client.destroy()
    }
  }

  async listKnowledgeSubmissions(): Promise<Array<KnowledgeSubmission>> {
    return await this.request<Array<KnowledgeSubmission>>('/knowledge/submissions')
  }

  async getKnowledgeSubmission(submissionId: string): Promise<KnowledgeSubmission> {
    return await this.request<KnowledgeSubmission>('/knowledge/submissions/' + encodeURIComponent(submissionId))
  }

  async listKnowledgeReviews(): Promise<Array<KnowledgeReview>> {
    return await this.request<Array<KnowledgeReview>>('/admin/knowledge/reviews')
  }

  async getKnowledgeReview(reviewId: string): Promise<KnowledgeReview> {
    return await this.request<KnowledgeReview>('/admin/knowledge/reviews/' + encodeURIComponent(reviewId))
  }

  async approveKnowledge(reviewId: string, comment: string): Promise<KnowledgeSubmission> {
    return await this.reviewAction(reviewId, 'approve', comment)
  }

  async rejectKnowledge(reviewId: string, comment: string): Promise<KnowledgeSubmission> {
    return await this.reviewAction(reviewId, 'reject', comment)
  }

  async revokeKnowledge(reviewId: string, comment: string): Promise<KnowledgeSubmission> {
    return await this.reviewAction(reviewId, 'revoke', comment)
  }

  async listDecisions(): Promise<Array<AiDecisionRecord>> {
    return await this.request<Array<AiDecisionRecord>>('/decisions')
  }

  async getModelConfig(): Promise<AiModelConfig> {
    return await this.request<AiModelConfig>('/admin/config/model')
  }

  async updateModelConfig(payload: AiModelConfigUpdate): Promise<AiModelConfig> {
    return await this.request<AiModelConfig>('/admin/config/model', http.RequestMethod.POST, JSON.stringify(payload))
  }

  async testConnection(payload: AiConnectionTestRequest): Promise<AiConnectionTestResult> {
    return await this.request<AiConnectionTestResult>('/admin/config/model/test', http.RequestMethod.POST, JSON.stringify(payload))
  }

  async uploadKnowledge(fileUri: string, fileName: string, contentType: string, metadata: KnowledgeUploadMetadata): Promise<KnowledgeSubmission> {
    const boundary: string = '----BottlingKnowledge' + new Date().getTime().toString()
    const body: ArrayBuffer = this.buildMultipartBody(boundary, fileUri, fileName, contentType, metadata)
    const client = http.createHttp()
    const headers: AiRequestHeaders = this.headers('multipart/form-data; boundary=' + boundary)
    try {
      const response = await client.request(AiCenterConfig.API_BASE + '/knowledge/submissions', {
        method: http.RequestMethod.POST,
        header: headers,
        extraData: body,
        expectDataType: http.HttpDataType.STRING,
        connectTimeout: AiCenterConfig.requestTimeoutMs,
        readTimeout: AiCenterConfig.requestTimeoutMs
      })
      return this.unwrap<KnowledgeSubmission>(response.responseCode, response.result as string)
    } finally {
      client.destroy()
    }
  }

  private async reviewAction(reviewId: string, action: string, comment: string): Promise<KnowledgeSubmission> {
    const payload: KnowledgeReviewAction = {
      comment: comment,
      clientRequestId: 'admin-' + new Date().getTime().toString()
    }
    return await this.request<KnowledgeSubmission>(
      '/admin/knowledge/reviews/' + encodeURIComponent(reviewId) + '/' + action,
      http.RequestMethod.POST,
      JSON.stringify(payload)
    )
  }

  private headers(contentType: string): AiRequestHeaders {
    return SessionStore.token.length > 0
      ? { 'Content-Type': contentType, 'Authorization': SessionStore.token }
      : { 'Content-Type': contentType }
  }

  private unwrap<T>(responseCode: number, raw: string): T {
    if (responseCode < 200 || responseCode >= 300) {
      if (responseCode === 401) SessionStore.clear()
      if (responseCode === 401) throw new AiCenterError('AI 中枢鉴权已过期，请重新登录', responseCode)
      if (responseCode === 403) throw new AiCenterError('AI 中枢拒绝当前操作，请检查知识治理权限', responseCode)
      if (responseCode === 404) throw new AiCenterError('AI 中枢配置接口未就绪，请先完成 /admin/config/model 契约实现', responseCode)
      if (responseCode === 408) throw new AiCenterError('AI 中枢请求超时，请检查模型超时时间和网络链路', responseCode)
      if (responseCode === 429) throw new AiCenterError('模型供应商触发速率限制，请稍后重试或更换 Key/模型', responseCode)
      if (responseCode === 503) throw new AiCenterError('模型或 RAG 服务不可用，请检查模型地址、向量库和索引状态', responseCode)
      throw new AiCenterError('AI 中枢 HTTP ' + responseCode.toString(), responseCode)
    }
    const envelope: AiApiEnvelope<T> = JSON.parse(raw) as AiApiEnvelope<T>
    if ((envelope.code !== 0 && envelope.code !== 1) || envelope.success === false) {
      throw new AiCenterError(envelope.message || 'AI 中枢返回业务错误', envelope.code)
    }
    return envelope.data
  }

  private buildMultipartBody(
    boundary: string,
    fileUri: string,
    fileName: string,
    contentType: string,
    metadata: KnowledgeUploadMetadata
  ): ArrayBuffer {
    const encoder = new util.TextEncoder()
    const metadataPart: Uint8Array = encoder.encode(
      '--' + boundary + '\r\n' +
      'Content-Disposition: form-data; name="metadata"\r\n' +
      'Content-Type: application/json;charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) + '\r\n' +
      '--' + boundary + '\r\n' +
      'Content-Disposition: form-data; name="file"; filename="' + fileName.replace(/"/g, '') + '"\r\n' +
      'Content-Type: ' + contentType + '\r\n\r\n'
    )
    const ending: Uint8Array = encoder.encode('\r\n--' + boundary + '--\r\n')
    const file = fileIo.openSync(fileUri, fileIo.OpenMode.READ_ONLY)
    try {
      const stat = fileIo.statSync(file.fd)
      const fileBuffer: ArrayBuffer = new ArrayBuffer(stat.size)
      fileIo.readSync(file.fd, fileBuffer)
      const output: Uint8Array = new Uint8Array(metadataPart.byteLength + fileBuffer.byteLength + ending.byteLength)
      output.set(metadataPart, 0)
      output.set(new Uint8Array(fileBuffer), metadataPart.byteLength)
      output.set(ending, metadataPart.byteLength + fileBuffer.byteLength)
      return output.buffer
    } finally {
      fileIo.closeSync(file)
    }
  }
}

export const aiCenterClient = new AiCenterClient()
