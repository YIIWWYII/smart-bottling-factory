import Vue from 'vue'
import Element from 'element-ui';
import 'element-ui/lib/theme-chalk/index.css';
import App from './App.vue'
import router from './router'
import websocket from './api/WebSocket.js';

Vue.prototype.$websocket = websocket;
Vue.config.productionTip = false

Vue.use(Element, {
	size: 'small',
	zIndex: 3000
});

new Vue({
	router,
	render: h => h(App),
}).$mount('#app')

//监听窗口关闭事件，当窗口关闭时，主动去关闭websocket连接
window.onbeforeunload = function() {
	websocket.close();
}

var logDebug = false; // 控制台log是否显示，线上环境需要关闭
console.log = (function(oriLogFunc) {
	return function() {
		if (logDebug) {
			oriLogFunc.apply(this, arguments);
		}
	}
})(console.log);

