export function roleLevel(role: string): number {
  if (role === 'ADMIN') return 4
  if (role === 'ENGINEER') return 3
  if (role === 'OPERATOR') return 2
  if (role === 'VIEWER') return 1
  return 0
}

export function roleAllows(userRole: string, requiredRole: string): boolean {
  return roleLevel(userRole) >= roleLevel(requiredRole) && roleLevel(requiredRole) > 0
}

export function isFinalCommandStatus(status: string): boolean {
  return status === 'ACKNOWLEDGED' || status === 'FAILED' || status === 'CANCELLED' || status === 'TIMEOUT'
}

export function shouldApplyStateVersion(currentStage: string, currentVersion: number,
  nextStage: string, nextVersion: number): boolean {
  return currentStage !== nextStage || nextVersion >= currentVersion
}
