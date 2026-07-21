<template>
	<div class="root">
		<el-container>
			<el-header style="padding: 0px; margin: 0px;">
				<div
					style="margin: 0px; backgroundColor: #001525; text-align: left;vertical-align:middle; width: 100%; height: 100%; display: flex; align-items: center;">
					<img style="margin-left: 20px;" width="30px" height="30px" src="../assets/hdc_demo.png" />
					<span style="font-size: 20px">&emsp;集控中心</span>
					<el-button style="margin-left: 30px;" type="text" @click="SetClick()">{{cityValue}}</el-button>
				</div>
			</el-header>
		</el-container>
		<div class="content">
			<div class="aside">
				<el-menu background-color="#0E2A40" active-text-color="#fff" text-color="#fff"
					default-active="/home/PLCControl" class="el-menu-vertical-demo" @open="handleOpen"
					@close="handleClose" :collapse="isCollapse" @select="handleSelect">
					<el-menu-item index="/home/PLCControl"><span slot="title">PLC实验台控制</span></el-menu-item>
					<el-menu-item index="/home/PLCControlCabinet"><span slot="title">PLC控制柜控制</span></el-menu-item>
					<el-menu-item index="/home/ProductDisplay"><span slot="title">配料区产品展示</span></el-menu-item>
					<el-menu-item index="/home/ScanningRecord"><span slot="title">库房区扫码记录</span></el-menu-item>
					<el-menu-item index="/factory"><span slot="title">装瓶产线演示</span></el-menu-item>
					<!-- <el-menu-item index="/home/PrintReportPreview"><span slot="title">打印报表预览</span></el-menu-item> -->
				</el-menu>
			</div>
			<div class="main">
				<router-view style="width: 100%;"></router-view>
			</div>
		</div>
	</div>
</template>

<script>
	import Local from '@/store/localSave.js';
	import {
		Service
	} from '@/api/Service.js';

	export default {
		data() {
			return {
				isCollapse: false,
				cityValue: '',
			};
		},
		onLoad() {},
		created: function() {
			document.title = '集控中心';
		},

		mounted() {
			console.log('Local.getId()=' + Local.getId())
			if (Local.getId() !== null) {
				this.cityValue = Local.getCity() + "  " + Local.getRegion()
			} else {
				this.cityValue = '请设置展区'
			}
		},

		methods: {
			handleOpen(key, keyPath) {
				console.log(key, keyPath);
			},
			handleClose(key, keyPath) {
				console.log(key, keyPath);
			},
			handleSelect(index, path) {
				console.log('jojo', index, 'path:', path);
				this.$router.push({
					path: index
				});
			},
			exit() {
				this.$router.push({
					name: 'Home'
				});
			},
			// 配置
			SetClick() {
				console.log('SetClick')
				this.$router.push({
					path: '/setting',
				});
			}
		}
	};
</script>

<style>
	.el-row {
		margin-bottom: 50px;

		&:last-child {
			margin-bottom: 0;
		}
	}

	.el-menu-vertical-demo:not(.el-menu--collapse) {
		width: 200px;
		min-height: 100%;
	}

	.el-menu-item.is-active {
		background-color: #3878D1 !important;
	}

	.root {
		height: 100%;
		width: 100%;
		display: flex;
		flex-direction: column;
	}

	.content {
		display: flex;
		flex-direction: row;
		height: 100%;
		width: 100%;
	}

	.aside {
		height: 100%;
		display: flex;
		flex-direction: column;
	}

	.main {
		width: 100%;
		height: 100%;
		background-color: white;
		flex-grow: 1;
		overflow: auto;
	}
</style>
