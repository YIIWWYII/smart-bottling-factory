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
  navy: '#062C4B',
  steel: '#D5E1E9',
  blue: '#0B66B2',
  accent: '#1686D7',
  page: '#EEF3F7',
  panel: '#FFFFFF',
  panelSoft: '#F6F8FA',
  panelStrong: '#DCE6EE',
  line: '#C8D5E0',
  lineStrong: '#829BAD',
  text: '#102D45',
  muted: '#60778A',
  onDark: '#F7FBFF',
  onDarkMuted: '#B4C7D6',
  success: '#1E9B60',
  successSoft: '#E3F5EA',
  warning: '#D28A00',
  warningSoft: '#FFF3D2',
  danger: '#D43D45',
  dangerSoft: '#FCE4E5',
  neutral: '#71879A'
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
