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
  navy: '#0B2A43',
  blue: '#0D5C75',
  accent: '#1B8A9D',
  page: '#EEF1F2',
  panel: '#FFFFFF',
  panelSoft: '#F5F7F8',
  line: '#CBD5DA',
  text: '#1C2E38',
  muted: '#6B7A83',
  success: '#2B8A72',
  warning: '#C28A2C',
  danger: '#B94A4A',
  neutral: '#82929B'
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
