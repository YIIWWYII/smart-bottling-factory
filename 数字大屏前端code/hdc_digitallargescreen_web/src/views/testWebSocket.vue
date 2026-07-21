<template>
	<div>{{this.receiveData}}</div>
</template>

<script>
	import Local from '@/store/localSave.js'
	export default {

		data() {
			return {
				receiveData: '1'
			}
		},
		methods: {
			async initWebSocket() {
				// TODO 获取id 保存成功，初始化websocket
				Local.saveId(11)
				this.$websocket.initWebSocket();
				// 监听数据
				window.addEventListener("onmessageWS", this.getSocketData);
			},

			getSocketData(res) {
				this.receiveData = res.detail.data
				console.log(`getSocketData: ${res.detail.data}`)
				// TODO 更新界面
			},
		},

		async mounted() {
			// init
			this.initWebSocket();

		},

		destroyed() {
			// close
			this.$websocket.close();
		}

	}
</script>

<style>
</style>
