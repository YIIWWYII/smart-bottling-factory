export const ROLE_VIEWER: string = 'VIEWER'
export const ROLE_OPERATOR: string = 'OPERATOR'
export const ROLE_ENGINEER: string = 'ENGINEER'
export const ROLE_ADMIN: string = 'ADMIN'

export const PERMISSION_INCIDENT_DISPOSE: string = 'INCIDENT_DISPOSE'
export const PERMISSION_THRESHOLD_MANAGE: string = 'THRESHOLD_MANAGE'
export const PERMISSION_SYSTEM_MANAGE: string = 'SYSTEM_MANAGE'
export const PERMISSION_USER_MANAGE: string = 'USER_MANAGE'

export function isKnownRole(role: string): boolean {
  return role === ROLE_VIEWER || role === ROLE_OPERATOR || role === ROLE_ENGINEER || role === ROLE_ADMIN
}

export function roleLabel(role: string): string {
  if (role === ROLE_ADMIN) return 'ADMIN 管理员'
  if (role === ROLE_ENGINEER) return 'ENGINEER 工程师'
  if (role === ROLE_OPERATOR) return 'OPERATOR 操作员'
  if (role === ROLE_VIEWER) return 'VIEWER 只读'
  return '未知角色（只读）'
}

export function canAccessAdminPage(role: string, pageCode: string): boolean {
  if (!isKnownRole(role)) return false
  if (pageCode === 'USERS') return role === ROLE_ADMIN
  return true
}

export function hasPermission(role: string, permission: string): boolean {
  if (!isKnownRole(role)) return false
  if (permission === PERMISSION_INCIDENT_DISPOSE) return role === ROLE_OPERATOR || role === ROLE_ADMIN
  if (permission === PERMISSION_THRESHOLD_MANAGE) return role === ROLE_ENGINEER || role === ROLE_ADMIN
  if (permission === PERMISSION_SYSTEM_MANAGE || permission === PERMISSION_USER_MANAGE) return role === ROLE_ADMIN
  return false
}

export function permissionLabel(permission: string): string {
  if (permission === PERMISSION_INCIDENT_DISPOSE) return 'OPERATOR 或 ADMIN'
  if (permission === PERMISSION_THRESHOLD_MANAGE) return 'ENGINEER 或 ADMIN'
  if (permission === PERMISSION_SYSTEM_MANAGE || permission === PERMISSION_USER_MANAGE) return 'ADMIN'
  return '未配置角色'
}
