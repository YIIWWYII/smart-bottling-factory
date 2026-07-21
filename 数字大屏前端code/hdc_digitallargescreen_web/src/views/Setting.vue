<template>
	<div class="divroot">
		<ScaleScreen :width="1920" :height="1137" :selfAdaption="true" :alignTop="false">
			<div class="root">
				<div style="display: flex; flex-direction: column; height:48px;">
					<img style='position:absolute; width:1920px; height:74px;'
						src="../assets/dataOverview/title.png"></img>
					<CrayonClock style="position:absolute; margin-top: 55px; margin-left: 1615px;">
					</CrayonClock>
				</div>
				<div class="content-elpage">
					<el-breadcrumb separator-class="el-icon-arrow-right">
						<el-breadcrumb-item :to="{ path: '/DataOverview' }">鸿志智慧工厂</el-breadcrumb-item>
						<el-breadcrumb-item>配置</el-breadcrumb-item>
					</el-breadcrumb>
				</div>
				<br />
				<div style="position:relative; margin-left: 655px;">
					<img style="position:absolute; width: 610px; margin-top: 60px;"
						src="../assets/dataOverview/plate_3.png"></img>
					<el-form style="position:absolute; width: 610px; margin-top: 120px;" ref=" form" :model="form"
						label-width="100px">
						<el-form-item>
							<span style="color: white;font-size: 20px;">选择设备所在展区</span>
						</el-form-item>
						<el-form-item>
							<span slot="label" style="color: white; font-size: 16px;">选择地区</span>
							<el-select ref='selectCityLabel' v-model="cityValue" placeholder="请选择地区"
								@change="getRegion">
								<el-option v-for="item in cityOptions" :key="item.id" :label="item.name"
									:disabled="item.useFlag==0" :value="item.id">
								</el-option>
							</el-select>
						</el-form-item>
						<el-form-item>
							<span slot="label" style="color: white; font-size: 16px;">选择展区</span>
							<el-select ref='selectRegionLabel' v-model="regionValue" placeholder="请选择展区">
								<el-option v-for="item in regionOptions" :key="item.id" :label="item.name"
									:disabled="item.useFlag==0" :value="item.id">
								</el-option>
							</el-select>
						</el-form-item>
						<el-form-item>
							<el-button style="width: 200px;margin-top: 20px; font-size: 16px;" type="primary"
								@click="onSubmit">保存并关闭
							</el-button>
						</el-form-item>
					</el-form>
				</div>
			</div>
		</ScaleScreen>
	</div>
</template>

<script>
	// 引入组件
	import ScaleScreen from '@/views/scale-screen.vue'
	import Utils from '../utils/Utils.ts'
	import {
		Service,
		ServiceGet,
		ServiceDownload,
		ServiceUpload
	} from '@/api/Service.js';
	import Local from '@/store/localSave.js'
	import CrayonClock from './clock.vue'
	export default {
		components: {
			ScaleScreen,
			CrayonClock,
		},
		methods: {
			// TODO 保存并关闭
			onSubmit() {
				console.log('submit!');
				if (this.cityValue == '') {
					Utils.showMessage('请选择地区！', 'warning')
					return
				}
				if (this.regionValue == '') {
					Utils.showMessage('请选择展区！', 'warning')
					return
				}
				// let dataParams = {
				// 	code: "",
				// 	groupId: this.regionValue,
				// 	sn: "",// TODO
				// 	type: "web"
				// }
				// Service({
				// 	url: '/hdc/api/device/joinGroup',
				// 	data: dataParams
				// }).then(res => {
				// 	console.log('/hdc/api/device/joinGroup 访问成功', JSON.stringify(res))
				Local.saveCity(this.$refs.selectCityLabel.selected.currentLabel)
				Local.saveRegion(this.$refs.selectRegionLabel.selected.currentLabel)
				Local.saveId(this.regionValue)
				Utils.showMessage('保存成功！', 'success')
				this.$router.back()
				// }).catch(e => {
				// 	console.log('/hdc/api/device/joinGroup 访问失败', e);
				// 	// Utils.showMessage('保存失败！', 'error')
				// })
			},
			// 获取城市列表
			getCity() {
				ServiceGet({
					url: '/hdc/api/city/listCity',
					// params: {
					// 	id: 1
					// }
				}).then(res => {
					console.log('/hdc/api/city/listCity 访问成功', res);
					this.cityOptions = res
				}).catch(e => {
					console.log('/hdc/api/city/listCity 访问失败', e);
				})
			},
			// 获取地区列表
			getRegion() {
				ServiceGet({
					url: '/hdc/api/group/listGroup',
					params: {
						cityId: this.cityValue
					}
				}).then(res => {
					console.log('/hdc/api/group/listGroup 访问成功', res);
					this.regionOptions = res
				}).catch(e => {
					console.log('/hdc/api/group/listGroup 访问失败', e);
				})
			},
		},

		mounted() {
			var that = this;
			window.onresize = () => {
				return (() => {
					window.fullHeight = document.documentElement.clientHeight;
					window.fullWidth = document.documentElement.clientWidth;
					that.windowHeight = window.fullHeight; //获取屏幕高度
					that.windowWidth = window.fullWidth; //获取屏幕宽度
					// that.$refs.grid.$forceUpdate();
					that.rowHeight = window.fullWidth
				})
			};

			// 获取城市列表
			this.getCity()
		},

		watch: {
			windowHeight(val) {
				let that = this;
				console.log("实时屏幕高度：", val, that.windowHeight);
			},
			windowWidth(val) {
				let that = this;
				that.
				console.log("实时屏幕宽度：", val, that.windowHeight);
			}
		},

		data() {
			return {
				form: {},
				cityOptions: [],
				cityValue: '',
				regionOptions: [],
				regionValue: ''
			}
		}
	}
</script>

<style lang="less" scoped>
	.root {
		position: relative;
		width: 100%;
		height: 100%;
	}

	.divroot {
		background-color: #05181d;
		width: 100%;
		height: 100%;
	}

	.content-elpage {
		display: flex;
		flex-direction: row;
		align-items: center;
		align-self: center;
		height: 60px;
		margin-left: 15px;
	}

	/deep/ .el-breadcrumb__inner {
		color: white;
	}
</style>
