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
  success: string
  successSoft: string
  warning: string
  warningSoft: string
  danger: string
  dangerSoft: string
  neutral: string
}

export const Theme: ThemeConfig = {
  navy: '#102A3B',
  steel: '#1C4056',
  blue: '#146A9F',
  accent: '#2E8ABF',
  page: '#E9EFF3',
  panel: '#FFFFFF',
  panelSoft: '#F3F7F9',
  panelStrong: '#DCE7ED',
  line: '#CDD9DF',
  lineStrong: '#9EB2BE',
  text: '#142E3E',
  muted: '#5F7280',
  success: '#1F7A57',
  successSoft: '#E5F2EC',
  warning: '#B66A0A',
  warningSoft: '#FFF1D9',
  danger: '#B23C43',
  dangerSoft: '#FBE8E9',
  neutral: '#70838E'
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
