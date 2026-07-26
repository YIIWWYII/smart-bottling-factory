import { AuthUser } from '../model/FactoryModels'
import { common } from '@kit.AbilityKit'
import { preferences } from '@kit.ArkData'
import { roleAllows } from './WorkstationPolicy'

class SessionStoreImpl {
  token: string = ''
  user: AuthUser | undefined = undefined
  expiresAt: string = ''
  private store: preferences.Preferences | undefined
  private listeners: Array<() => void> = []

  initialize(context: common.UIAbilityContext): void {
    try {
      this.store = preferences.getPreferencesSync(context, { name: 'factory_session' })
      const tokenValue = this.store.getSync('token', '')
      const userValue = this.store.getSync('user', '')
      const expiresAtValue = this.store.getSync('expiresAt', '')
      if (typeof tokenValue === 'string' && tokenValue.length > 0 && typeof userValue === 'string' && userValue.length > 0) {
        this.token = tokenValue
        this.user = JSON.parse(userValue) as AuthUser
        this.expiresAt = typeof expiresAtValue === 'string' ? expiresAtValue : ''
        if (this.isExpired()) this.clear()
      }
    } catch (error) {
      console.error('[BottlingFactory] session restore failed')
    }
  }

  get isAuthenticated(): boolean {
    return this.token.length > 0 && this.user !== undefined && !this.isExpired()
  }

  get canOperate(): boolean {
    return this.can('OPERATOR')
  }

  get isAdmin(): boolean {
    return this.can('ADMIN')
  }

  subscribe(listener: () => void): void {
    this.listeners.push(listener)
  }

  unsubscribe(listener: () => void): void {
    this.listeners = this.listeners.filter((item: () => void) => item !== listener)
  }

  can(requiredRole: string): boolean {
    if (!this.isAuthenticated || this.user === undefined || this.user.status !== 'ACTIVE') return false
    return roleAllows(this.user.role, requiredRole)
  }

  setSession(token: string, user: AuthUser, expiresAt: string = ''): void {
    this.token = token
    this.user = user
    this.expiresAt = expiresAt
    if (this.store !== undefined) {
      this.store.putSync('token', token)
      this.store.putSync('user', JSON.stringify(user))
      this.store.putSync('expiresAt', expiresAt)
      void this.store.flush()
    }
    this.notify()
  }

  clear(): void {
    this.token = ''
    this.user = undefined
    this.expiresAt = ''
    if (this.store !== undefined) {
      this.store.deleteSync('token')
      this.store.deleteSync('user')
      this.store.deleteSync('expiresAt')
      void this.store.flush()
    }
    this.notify()
  }

  private isExpired(): boolean {
    if (this.expiresAt.length === 0) return false
    const expires: number = Date.parse(this.expiresAt)
    return !Number.isNaN(expires) && expires <= Date.now()
  }

  private notify(): void {
    this.listeners.forEach((listener: () => void) => listener())
  }
}

export const SessionStore = new SessionStoreImpl()
