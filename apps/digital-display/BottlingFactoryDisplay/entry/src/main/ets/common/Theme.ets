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
  navy: '#0E2C46',
  blue: '#155E95',
  accent: '#2A81C5',
  page: '#DDE7EF',
  panel: '#F9FBFD',
  panelSoft: '#EFF5F9',
  line: '#B7C9D6',
  text: '#173247',
  muted: '#5F7486',
  success: '#22845A',
  warning: '#C98618',
  danger: '#B9444D',
  neutral: '#7A8D9B'
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
