export interface ThemeConfig {
  navy: string
  steel: string
  blue: string
  accent: string
  page: string
  panel: string
  panelSoft: string
  panelStrong: string
  line: string
  lineStrong: string
  text: string
  muted: string
  onDark: string
  onDarkMuted: string
  success: string
  successSoft: string
  warning: string
  warningSoft: string
  danger: string
  dangerSoft: string
  neutral: string
}

export const Theme: ThemeConfig = {
  navy: '#071422',
  steel: '#102B49',
  blue: '#00A8E8',
  accent: '#00D4AA',
  page: '#0A1628',
  panel: '#0D1E3C',
  panelSoft: '#0B1A36',
  panelStrong: '#12325A',
  line: '#1A3A6A',
  lineStrong: '#2B5F95',
  text: '#F4F8FF',
  muted: '#8899AA',
  onDark: '#FFFFFF',
  onDarkMuted: '#A8B9CA',
  success: '#00C853',
  successSoft: '#0A302D',
  warning: '#FFAB00',
  warningSoft: '#3A2A0B',
  danger: '#FF1744',
  dangerSoft: '#3A1020',
  neutral: '#6C8197'
}

export function statusSurface(status: string): string {
  switch (status) {
    case 'RUNNING':
    case 'PASS':
    case 'PASSED':
      return Theme.successSoft
    case 'HOLD':
    case 'WAIT':
    case 'WARNING':
      return Theme.warningSoft
    case 'ALARM':
    case 'FAIL':
    case 'FAILED':
    case 'REJECTED':
      return Theme.dangerSoft
    default:
      return Theme.panelStrong
  }
}

export function statusColor(status: string): string {
  switch (status) {
    case 'RUNNING':
    case 'PASS':
    case 'PASSED':
      return Theme.success
    case 'HOLD':
    case 'WAIT':
    case 'WARNING':
      return Theme.warning
    case 'ALARM':
    case 'FAIL':
    case 'FAILED':
    case 'REJECTED':
      return Theme.danger
    default:
      return Theme.neutral
  }
}
