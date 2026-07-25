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
  navy: '#0E2A45',
  blue: '#235E8F',
  accent: '#3A86B9',
  page: '#EEF3F7',
  panel: '#FFFFFF',
  panelSoft: '#F5F8FB',
  line: '#C8D4DE',
  text: '#1D3447',
  muted: '#5C7284',
  success: '#1E8860',
  warning: '#C98912',
  danger: '#B9444C',
  neutral: '#6E8190'
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
