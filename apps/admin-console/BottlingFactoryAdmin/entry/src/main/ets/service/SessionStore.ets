import { AuthUser } from '../model/FactoryModels'
import { common } from '@kit.AbilityKit'
import { preferences } from '@kit.ArkData'

class SessionStoreImpl {
  token: string = ''
  user: AuthUser | undefined = undefined
  expiresAt: string = ''
  private store: preferences.Preferences | undefined

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
    if (this.token.length === 0 || this.user === undefined || this.user.status !== 'ACTIVE') return false
    if (this.isExpired()) {
      this.clear()
      return false
    }
    return true
  }

  get canOperate(): boolean {
    return this.user !== undefined && (this.user.role === 'ADMIN' || this.user.role === 'OPERATOR')
  }

  get isDemo(): boolean {
    return this.token === 'LOCAL-DEMO'
  }

  get isAdmin(): boolean {
    return this.user !== undefined && this.user.role === 'ADMIN'
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
  }

  private isExpired(): boolean {
    if (this.token === 'LOCAL-DEMO' || this.expiresAt.length === 0) return false
    const expiresAtMs: number = Date.parse(this.expiresAt)
    return !Number.isNaN(expiresAtMs) && expiresAtMs <= Date.now()
  }
}

export const SessionStore = new SessionStoreImpl()
