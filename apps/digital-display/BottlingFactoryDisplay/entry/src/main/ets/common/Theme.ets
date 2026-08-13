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
  navy: '#123247',
  steel: '#D7E6EB',
  blue: '#116B95',
  accent: '#129CBF',
  page: '#EAF2F4',
  panel: '#FFFFFF',
  panelSoft: '#F4F8F9',
  panelStrong: '#D7E6EB',
  line: '#C7D9DF',
  lineStrong: '#8EAAB5',
  text: '#17303B',
  muted: '#5D7480',
  onDark: '#F5FAFB',
  onDarkMuted: '#B6C9CF',
  success: '#198866',
  successSoft: '#DDF2EB',
  warning: '#C97816',
  warningSoft: '#FFF0D9',
  danger: '#C84B54',
  dangerSoft: '#F9E1E3',
  neutral: '#718A94'
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
