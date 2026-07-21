<template>
	<div class="user-root">
		<div style="text-align: left; width: 100%;">
			<br />
			<span style="font-size: 20px; color:#545454; margin-left: 5%;">PLC测试控制柜</span>
			<span>&emsp;</span>
			<br />
			<br />
			<span class="line" style="margin-left: 5%; margin-right: 5%; margin-bottom: 30px;" />
			<div style="margin-top: 30px;" class="content_1">
				<b>厂家信息</b>
			</div>
			<div class="content_1">
				型号：{{type}}</div>
			<div class="content_1">
				版本：{{version}}</div>
			<div class="content_1">
				厂商：{{manufacturer}}</div>
			<div style="margin-top: 30px;" class="content_1">
				<b>控制</b>
			</div>
			<div>
				<div v-for="(item, index) in items" :key="index" style="margin-bottom: 15px;">
					<span
						style="font-size: 20px; color:#545454; margin-left: 7.5%; vertical-align:middle;">{{ index+1 }}</span>
					<el-switch :disabled="isDisabled" style="margin-left: 1%; vertical-align:middle;"
						v-model="item.value" :active-value="1" :inactive-value="0" active-color="#13ce66"
						inactive-color="#CCCCCC" @change="onchange(item)">
					</el-switch>
					<img style="margin-left: 20px; vertical-align:middle;" width="22px" height="26px"
						:src="item.value == 0 ? require('@/assets/ic_light_off.png'):require('@/assets/ic_light_on.png')" />
				</div>
			</div>
		</div>
	</div>
</template>

<script>
	import {
		Service
	} from '@/api/Service.js';
	import router from '@/router';
	import Local from '@/store/localSave.js'
	import DataParseUtils from '../utils/DataParseUtils.ts';
	import Utils from '../utils/Utils.ts'

	export default {

		data() {
			return {
				isDisabled: false,
				items: [{
					value: 0,
					index: 0,
				}, {
					value: 0,
					index: 1,
				}, {
					value: 0,
					index: 2,
				}, {
					value: 0,
					index: 3,
				}],
				type: '', //型号
				version: '', //版本
				manufacturer: '' //厂商

			}
		},
		methods: {
			async initWebSocket() {
				// 获取id 保存成功，初始化websocket
				console.log('Local.getId() =' + Local.getId())
				console.log('Local.getCity() =' + Local.getCity())
				if (Local.getId() !== null) {
					this.$websocket.initWebSocket();
					// 监听数据
					window.addEventListener("onmessageWS", this.getSocketData);
				} else {
					this.isDisabled = !this.isDisabled
					Utils.showMessage('请设置展区！', 'warning')
				}

			},
			// 接收数据
			getSocketData(res) {
				this.receiveData = res.detail.data
				console.log(`getSocketData: ${res.detail.data}`)
				var data = JSON.parse(res.detail.data)
				let type = data.type
				console.log(`getSocketData type: ${type}`)
				// 更新界面
				if (type == 'lamp') {
					if (data.data != null) {
						this.items[0].value = data.data[0]
						this.items[1].value = data.data[1]
						this.items[2].value = data.data[2]
						this.items[3].value = data.data[3]
					} else {
						this.items[0].value = 0
						this.items[1].value = 0
						this.items[2].value = 0
						this.items[3].value = 0
					}
				} else if (type == 'info') {
					if (data.data != null) {
						this.type = data.data.model
						this.version = data.data.version
						this.manufacturer = data.data.manufacturers
					}
				}

				if (data.code == -1) {
					console.log(`getSocketData err: ${data.msg}`)
					Utils.showMessage(data.msg, 'error')
				}
			},

			onchange(item) {
				console.log(`this.$websocket:${JSON.stringify(this.$websocket)}`)
				if (this.$websocket.getSocket().readyState == 1) {
					console.log(`onchange:${item.value}`)
					// 上报数据
					let params = {
						"groupId": Local.getId(),
						"type": "lamp",
						"index": item.index,
						"action": item.value
					}
					this.$websocket.sendWebsocket(JSON.stringify(params))
				} else {
					this.items[0].value = 0
					this.items[1].value = 0
					this.items[2].value = 0
					this.items[3].value = 0
					Utils.showMessage("服务端连接失败", 'error')
				}
			}
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
	.user-root {
		display: flex;
		flex-direction: column;
		/* width: 100%; */
		/* align-items: center; */
	}

	/* 横线 */
	.line {
		float: right;
		width: 90%;
		height: 1px;
		margin-top: -0.5em;
		background: #e4e4e4;
		position: relative;
		text-align: center;
	}

	.el-switch.is-disabled {
		opacity: 1;
	}

	.content_1 {
		font-size: 18px;
		color: #545454;
		margin-left: 7.5%;
		vertical-align: middle;
		margin-bottom: 20px;
	}
</style>