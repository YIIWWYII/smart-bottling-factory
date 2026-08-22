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
  navy: '#12344D',
  steel: '#315A73',
  blue: '#006FAE',
  accent: '#2E6F95',
  page: '#F0F2F4',
  panel: '#FFFFFF',
  panelSoft: '#F7F8F9',
  panelStrong: '#E7ECEF',
  line: '#D7DDE2',
  lineStrong: '#ADB9C1',
  text: '#172B3A',
  muted: '#5D6B76',
  success: '#2B805F',
  successSoft: '#E6F2EC',
  warning: '#A96F00',
  warningSoft: '#FFF4DC',
  danger: '#B33E4B',
  dangerSoft: '#FBE8EB',
  neutral: '#7A8791'
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
