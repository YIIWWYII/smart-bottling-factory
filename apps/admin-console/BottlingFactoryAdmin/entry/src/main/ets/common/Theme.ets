export interface ThemeConfig {
  navy: string
  blue: string
  accent: string
  page: string
  panel: string
  panelSoft: string
  line: string
  text: string
  muted: string
  success: string
  warning: string
  danger: string
  neutral: string
}

export const Theme: ThemeConfig = {
  navy: '#12344D',
  blue: '#006FAE',
  accent: '#2E6F95',
  page: '#F0F2F4',
  panel: '#FFFFFF',
  panelSoft: '#F7F8F9',
  line: '#D7DDE2',
  text: '#172B3A',
  muted: '#5D6B76',
  success: '#2B805F',
  warning: '#A96F00',
  danger: '#B33E4B',
  neutral: '#7A8791'
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
