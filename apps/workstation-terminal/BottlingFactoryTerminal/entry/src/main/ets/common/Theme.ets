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
  navy: '#0B2A43',
  steel: '#16445A',
  blue: '#0D5C75',
  accent: '#1B8A9D',
  page: '#EEF1F2',
  panel: '#FFFFFF',
  panelSoft: '#F5F7F8',
  panelStrong: '#E3EAED',
  line: '#CBD5DA',
  lineStrong: '#AAB9BF',
  text: '#1C2E38',
  muted: '#6B7A83',
  success: '#2B8A72',
  successSoft: '#E5F2EC',
  warning: '#C28A2C',
  warningSoft: '#FFF3D9',
  danger: '#B94A4A',
  dangerSoft: '#FBE8E8',
  neutral: '#82929B'
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
