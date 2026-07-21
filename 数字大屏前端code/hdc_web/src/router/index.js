import Vue from 'vue'
import VueRouter from 'vue-router'
import auth from '@/store/auth.js'

const originalPush = VueRouter.prototype.push
VueRouter.prototype.push = function push(location) { return originalPush.call(this, location).catch(err => err) }
Vue.use(VueRouter)

const routes = [
	{ path: '/login', name: 'Login', component: () => import('../views/auth/Login.vue'), meta: { title: '登录', public: true } },
	{ path: '/register', name: 'Register', component: () => import('../views/auth/Register.vue'), meta: { title: '注册', public: true } },
	{
		path: '/', component: () => import('../views/layout/AdminLayout.vue'), redirect: '/dashboard', meta: { requiresAuth: true },
		children: [
			{ path: 'dashboard', name: 'Dashboard', component: () => import('../views/Dashboard.vue'), meta: { title: '运营首页', group: '工作台' } },
			{ path: 'factory', name: 'FactoryLine', component: () => import('../views/FactoryLine.vue'), meta: { title: '产线控制中心', group: '生产运营' } },
			{ path: 'incidents', name: 'IncidentCenter', component: () => import('../views/IncidentCenter.vue'), meta: { title: '异常处置中心', group: '生产运营' } },
			{ path: 'plc-control', name: 'PLCControl', component: () => import('../views/PLCControl.vue'), meta: { title: 'PLC 实验台', group: '设备管理' } },
			{ path: 'plc-cabinet', name: 'PLCControlCabinet', component: () => import('../views/PLCControlCabinet.vue'), meta: { title: 'PLC 控制柜', group: '设备管理' } },
			{ path: 'products', name: 'ProductDisplay', component: () => import('../views/ProductDisplay.vue'), meta: { title: '物料与产品', group: '物料仓储' } },
			{ path: 'warehouse-records', name: 'ScanningRecord', component: () => import('../views/ScanningRecord.vue'), meta: { title: '仓储扫码记录', group: '物料仓储' } },
			{ path: 'reports', name: 'PrintReportPreview', component: () => import('../views/PrintReportPreview.vue'), meta: { title: '生产报表', group: '报表中心' } },
			{ path: 'users', name: 'UserManagement', component: () => import('../views/UserManagement.vue'), meta: { title: '用户与权限', group: '系统管理', roles: ['ADMIN'] } },
			{ path: 'setting', name: 'Setting', component: () => import('../views/Setting.vue'), meta: { title: '系统配置', group: '系统管理' } }
		]
	},
	{ path: '/home/plcControl', redirect: '/plc-control' },
	{ path: '/home/plcControlCabinet', redirect: '/plc-cabinet' },
	{ path: '/home/productDisplay', redirect: '/products' },
	{ path: '/home/scanningRecord', redirect: '/warehouse-records' },
	{ path: '/home/printReportPreview', redirect: '/reports' },
	{ path: '*', redirect: '/dashboard' }
]

const router = new VueRouter({ routes })

router.beforeEach(async (to, from, next) => {
	document.title = `${to.meta.title || '管理端'} - 智慧装瓶产线`
	if (to.meta.public) {
		if (auth.isAuthenticated) return next('/dashboard')
		return next()
	}
	if (!auth.token) return next({ path: '/login', query: { redirect: to.fullPath } })
	try {
		const user = await auth.restore()
		if (to.meta.roles && !to.meta.roles.includes(user.role)) return next('/dashboard')
		return next()
	} catch (error) {
		auth.clear()
		return next({ path: '/login', query: { redirect: to.fullPath } })
	}
})

export default router
