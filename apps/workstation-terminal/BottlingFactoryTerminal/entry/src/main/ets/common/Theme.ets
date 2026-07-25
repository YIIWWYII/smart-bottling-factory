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
  navy: '#123A5B',
  blue: '#145DA0',
  accent: '#1F7ACB',
  page: '#E8F0F5',
  panel: '#FFFFFF',
  panelSoft: '#F4F8FB',
  line: '#C5D6E2',
  text: '#16324A',
  muted: '#61788B',
  success: '#238B5A',
  warning: '#D89016',
  danger: '#C83F49',
  neutral: '#8397A6'
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
