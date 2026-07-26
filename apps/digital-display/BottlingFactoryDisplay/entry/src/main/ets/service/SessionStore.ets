import { AuthUser } from '../model/FactoryModels'
import { common } from '@kit.AbilityKit'
import { preferences } from '@kit.ArkData'

class SessionStoreImpl {
  token: string = ''
  user: AuthUser | undefined = undefined
  private store: preferences.Preferences | undefined

  initialize(context: common.UIAbilityContext): void {
    try {
      this.store = preferences.getPreferencesSync(context, { name: 'factory_session' })
      const tokenValue = this.store.getSync('token', '')
      const userValue = this.store.getSync('user', '')
      if (typeof tokenValue === 'string' && tokenValue.length > 0 && typeof userValue === 'string' && userValue.length > 0) {
        this.token = tokenValue
        this.user = JSON.parse(userValue) as AuthUser
      }
    } catch (error) {
      console.error('[BottlingFactory] session restore failed')
    }
  }

  get isAuthenticated(): boolean {
    return this.token.length > 0 && this.user !== undefined
  }

  get canOperate(): boolean {
    return this.user !== undefined && (this.user.role === 'ADMIN' || this.user.role === 'OPERATOR')
  }

  get isAdmin(): boolean {
    return this.user !== undefined && this.user.role === 'ADMIN'
  }

  setSession(token: string, user: AuthUser): void {
    this.token = token
    this.user = user
    if (this.store !== undefined) {
      this.store.putSync('token', token)
      this.store.putSync('user', JSON.stringify(user))
      void this.store.flush()
    }
  }

  clear(): void {
    this.token = ''
    this.user = undefined
    if (this.store !== undefined) {
      this.store.deleteSync('token')
      this.store.deleteSync('user')
      void this.store.flush()
    }
  }
}

export const SessionStore = new SessionStoreImpl()
