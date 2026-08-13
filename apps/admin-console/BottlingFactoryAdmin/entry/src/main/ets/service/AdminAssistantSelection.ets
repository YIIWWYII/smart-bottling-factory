import {
  AssistantDisplayField,
  AssistantEntityType,
  AssistantSelection,
  AssistantSelectionPublisher,
  createSelection
} from '@bottling/harmony-assistant'

const ALLOWED_ENTITY_TYPES: Array<string> = [
  AssistantEntityType.ALARM,
  AssistantEntityType.AUDIT,
  AssistantEntityType.CONFIG,
  AssistantEntityType.DEVICE,
  AssistantEntityType.INCIDENT,
  AssistantEntityType.KNOWLEDGE_DOCUMENT,
  AssistantEntityType.PRODUCT,
  AssistantEntityType.TABLE_ROW
]

const ALLOWED_FIELD_CODES: Array<string> = [
  'status',
  'stageCode',
  'deviceCode',
  'traceCode',
  'lineId',
  'version',
  'source',
  'result',
  'occurredAt',
  'updatedAt',
  'title',
  'scope'
]

function isAllowed(value: string, allowlist: Array<string>): boolean {
  return allowlist.indexOf(value) >= 0
}

function sanitizeText(value: string, maxLength: number): string {
  const normalized: string = value.replace(/\r/g, ' ').replace(/\n/g, ' ').replace(/\t/g, ' ').trim()
  return normalized.length > maxLength ? normalized.substring(0, maxLength) : normalized
}

function labelForField(code: string): string {
  if (code === 'status') return '状态'
  if (code === 'stageCode') return '工位'
  if (code === 'deviceCode') return '设备'
  if (code === 'traceCode') return '追踪号'
  if (code === 'lineId') return '产线'
  if (code === 'version') return '版本'
  if (code === 'source') return '来源'
  if (code === 'result') return '结果'
  if (code === 'occurredAt') return '发生时间'
  if (code === 'updatedAt') return '更新时间'
  if (code === 'title') return '标题'
  if (code === 'scope') return '范围'
  return code
}

function mapEntityType(entityType: string): string {
  if (entityType === 'ALARM') return AssistantEntityType.ALARM
  if (entityType === 'DEVICE') return AssistantEntityType.DEVICE
  if (entityType === 'PRODUCT') return AssistantEntityType.PRODUCT
  if (entityType === 'CONFIGURATION') return AssistantEntityType.CONFIG
  if (entityType === 'KNOWLEDGE_SUBMISSION') return AssistantEntityType.KNOWLEDGE_DOCUMENT
  if (entityType === 'INCIDENT') return AssistantEntityType.INCIDENT
  if (entityType === 'AI_DECISION' || entityType === 'AUDIT_RECORD') return AssistantEntityType.AUDIT
  return AssistantEntityType.TABLE_ROW
}

export function assistantField(code: string, value: string, unit?: string): AssistantDisplayField | undefined {
  if (!isAllowed(code, ALLOWED_FIELD_CODES)) return undefined
  const safeValue: string = sanitizeText(value, 160)
  if (safeValue.length === 0) return undefined
  return unit === undefined
    ? { code: code, label: labelForField(code), displayValue: safeValue }
    : { code: code, label: labelForField(code), displayValue: safeValue, unit: unit }
}

export function createAdminSelection(
  entityType: string,
  entityId: string,
  displayText: string,
  pageRoute: string,
  stateVersion: number,
  candidateFields: Array<AssistantDisplayField | undefined>
): AssistantSelection | undefined {
  const mappedType: string = mapEntityType(entityType)
  if (!isAllowed(mappedType, ALLOWED_ENTITY_TYPES)) return undefined
  const safeId: string = sanitizeText(entityId, 128)
  if (safeId.length === 0) return undefined
  const fields: Array<AssistantDisplayField> = []
  candidateFields.forEach((field: AssistantDisplayField | undefined) => {
    if (field !== undefined && isAllowed(field.code, ALLOWED_FIELD_CODES)) fields.push(field)
  })
  return createSelection(
    mappedType,
    safeId,
    sanitizeText(displayText, 320),
    'ARKUI',
    sanitizeText(pageRoute, 96),
    stateVersion < 0 ? 0 : stateVersion,
    fields
  )
}

export const adminAssistantSelectionPublisher = new AssistantSelectionPublisher()

class AdminAssistantSelectionBus {
  private pageRoute: string = ''

  setPageRoute(pageRoute: string): void {
    this.pageRoute = pageRoute
  }

  publish(selection: AssistantSelection | undefined): void {
    if (selection === undefined) {
      adminAssistantSelectionPublisher.clear(this.pageRoute, 'ARKUI')
    } else {
      adminAssistantSelectionPublisher.publish(selection)
    }
  }
}

export const adminAssistantSelectionBus = new AdminAssistantSelectionBus()
