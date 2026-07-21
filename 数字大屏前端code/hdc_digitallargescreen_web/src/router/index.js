import Vue from 'vue'
import VueRouter from 'vue-router'

//Vue-router在3.1之后把$router.push()方法改为了Promise。所以假如没有回调函数，错误信息就会交给全局的路由错误处理，因此就会报上述的错误。
//解决方案：禁止全局路由错误处理打印，这个也是vue-router开发者给出的解决方案
const originalPush = VueRouter.prototype.push
VueRouter.prototype.push = function push(location) {
	return originalPush.call(this, location).catch(err => err)
}
Vue.use(VueRouter)

const routes = [{
		path: '/',
		redirect: '/factoryOverview'
	},
	{
		path: '/factoryOverview',
		name: 'FactoryOverview',
		component: () => import('../views/FactoryOverview.vue'),
		meta: { title: '装瓶产线总览' }
	},
	{
		path: '/factoryStage/:stageCode',
		name: 'FactoryStage',
		component: () => import('../views/FactoryStage.vue'),
		meta: { title: '产线环节详情' }
	},
	{
		path: '/dataOverview',
		name: "DataOverview",
		component: () => import('../views/DataOverview.vue'),
		meta: {
			title: "数字大屏"
		}
	},
	{
		path: '/setting',
			name: "Setting",
			component: () => import('../views/Setting.vue'),
			meta: {
				title: "配置"
			}
	},
	{
		path: '*',
		redirect: '/factoryOverview'
	}
	// {
	// 	path: '/testWebSocket',
	// 	name: "testWebSocket",
	// 	component: () => import('../views/testWebSocket.vue'),
	// 	meta: {
	// 		title: "testWebSocket"
	// 	}
	// }
]

const router = new VueRouter({
	routes
})

export default router
