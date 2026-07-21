import Vue from 'vue'
import Local from './localSave.js'
import * as AuthApi from '@/api/AuthService.js'

const state = Vue.observable({
	user: Local.getAuthUser(),
	verified: false
})

export default {
	state,
	get token() { return Local.getToken() },
	get isAuthenticated() { return Boolean(Local.getToken() && state.user) },
	get isAdmin() { return state.user && state.user.role === 'ADMIN' },
	get canOperate() { return state.user && ['ADMIN', 'OPERATOR'].includes(state.user.role) },
	async signIn(form) {
		const result = await AuthApi.login(form)
		if (!result || !result.token) throw new Error('登录响应缺少令牌')
		Local.saveToken(result.token)
		Local.saveAuthUser(result.user)
		state.user = result.user
		state.verified = true
		return result.user
	},
	async restore() {
		if (!Local.getToken()) throw new Error('未登录')
		if (state.verified && state.user) return state.user
		const user = await AuthApi.getCurrentUser()
		Local.saveAuthUser(user)
		state.user = user
		state.verified = true
		return user
	},
	async signOut() {
		try { if (Local.getToken()) await AuthApi.logout() } catch (error) { /* local logout still proceeds */ }
		Local.clearAuth()
		state.user = null
		state.verified = false
	},
	clear() {
		Local.clearAuth()
		state.user = null
		state.verified = false
	}
}
