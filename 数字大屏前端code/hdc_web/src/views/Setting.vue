<template>
	<div class="divroot">
		<div class="content-elpage">
			<el-breadcrumb separator-class="el-icon-arrow-right">
				<el-breadcrumb-item :to="{ path: '/Home/PLCControl' }">集控中心</el-breadcrumb-item>
				<el-breadcrumb-item>配置</el-breadcrumb-item>
			</el-breadcrumb>
		</div>
		<div class="line" />
		<div class="main-title">
			<el-form style="position:absolute; width: 350px;" :model="form" label-position="right" label-width="120px">
				<el-form-item>
					<span style="font-size: 20px;">选择设备所在展区</span>
				</el-form-item>
				<el-form-item>
					<span slot="label" style=" font-size: 16px;">选择地区</span>
					<el-select ref='selectCityLabel' v-model="cityValue" placeholder="请选择地区" @change="getRegion">
						<el-option v-for="item in cityOptions" :key="item.id" :label="item.name"
							:disabled="item.useFlag==0" :value="item.id">
						</el-option>
					</el-select>
				</el-form-item>
				<el-form-item>
					<span slot="label" style="font-size: 16px;">选择展区</span>
					<el-select ref='selectRegionLabel' v-model="regionValue" placeholder="请选择展区">
						<el-option v-for="item in regionOptions" :key="item.id" :label="item.name"
							:disabled="item.useFlag==0" :value="item.id">
						</el-option>
					</el-select>
				</el-form-item>
				<el-form-item>
					<el-button style="width: 200px;margin-top: 20px; font-size: 16px;" type="primary" @click="onSubmit">
						保存并关闭
					</el-button>
				</el-form-item>
			</el-form>
		</div>
	</div>
</template>

<script>
	// 引入组件
	import Utils from '../utils/Utils.ts'
	import {
		Service,
		ServiceGet,
		ServiceDownload,
		ServiceUpload
	} from '@/api/Service.js';
	import Local from '@/store/localSave.js'
	export default {
		components: {},
		methods: {
			// 本地保存并关闭，分组id为了获取页面数据支撑
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
				Local.saveCity(this.$refs.selectCityLabel.selected.currentLabel)
				Local.saveRegion(this.$refs.selectRegionLabel.selected.currentLabel)
				Local.saveId(this.regionValue)
				Utils.showMessage('保存成功！', 'success')
				this.$router.push({
					path: '/Home/PLCControl',
				})
			},
			// 获取城市列表
			getCity() {
				ServiceGet({
					url: '/api/city/listCity',
					// params: {
					// 	id: 1
					// }
				}).then(res => {
					console.log('/api/city/listCity 访问成功', res);
					this.cityOptions = res
				}).catch(e => {
					console.log('/api/city/listCity 访问失败', e);
				})
			},
			// 获取地区列表
			getRegion() {
				ServiceGet({
					url: '/api/group/listGroup',
					params: {
						cityId: this.cityValue
					}
				}).then(res => {
					console.log('/api/group/listGroup 访问成功', res);
					this.regionOptions = res
				}).catch(e => {
					console.log('/api/group/listGroup 访问失败', e);
				})
			},
		},

		mounted() {
			// 获取城市列表
			this.getCity()
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

	.line {
		width: 100%;
		height: 1px;
		background-color: #ebebeb;
	}

	.main-title {
		margin-left: 80px;
		margin-right: 80px;
	}
</style>
