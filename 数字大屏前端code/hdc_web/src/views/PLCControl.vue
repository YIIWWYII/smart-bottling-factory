<template>
	<div class="user-root">
		<div style="text-align: left; width: 100%;">
			<br />
			<span style="font-size: 20px; color:#545454; margin-left: 5%;">PLC测试实验台</span>
			<span>&emsp;</span>
			<br />
			<br />
			<div class="line" style="margin-left: 5%; margin-right: 5%;" />
			<span v-show="true" style="font-size: 20px; color:#545454; margin-left: 10%; margin-right: 15%;">D|1</span>
			<span v-show="false" style="font-size: 20px; color:#545454; margin-left: 20%;">D|0</span>
			<br />
			<br />
			<div>
				<span v-show="true"
					style="font-size: 20px; color:#545454; margin-left: 7.5%; vertical-align:middle;">0</span>
				<el-switch v-show="true" :disabled="canClickSwitch ? false : true"
					style="margin-left: 1%; vertical-align:middle;" v-model="dValue[0]" active-value="1"
					inactive-value="0" active-color="#13ce66" inactive-color="#CCCCCC"></el-switch>
				<img v-show="true" style="margin-left: 20px; vertical-align:middle;" width="22px" height="26px"
					:src="require('@/assets/' + imgSrc[dValue[0]])" />
				<span v-show="false"
					style="font-size: 20px; color:#545454; margin-left: 18%; vertical-align:middle;">0</span>
				<el-switch v-show="false" :disabled="canClickSwitch ? false : true"
					style="margin-left: 1%; vertical-align:middle;" v-model="dValue[8]" active-value="1"
					inactive-value="0" active-color="#13ce66" inactive-color="#CCCCCC"></el-switch>
				<img v-show="false" style="margin-left: 20px; vertical-align:middle;" width="22px" height="26px"
					:src="require('@/assets/' + imgSrc[dValue[8]])" />
				<br />
				<br />
				<span v-show="true"
					style="font-size: 20px; color:#545454; margin-left: 7.5%; vertical-align:middle;">1</span>
				<el-switch v-show="true" :disabled="canClickSwitch ? false : true"
					style="margin-left: 1%; vertical-align:middle;" v-model="dValue[1]" active-value="1"
					inactive-value="0" active-color="#13ce66" inactive-color="#CCCCCC"></el-switch>
				<img v-show="true" style="margin-left: 20px; vertical-align:middle;" width="22px" height="26px"
					:src="require('@/assets/' + imgSrc[dValue[1]])" />
				<span v-show="false"
					style="font-size: 20px; color:#545454; margin-left: 18%; vertical-align:middle;">1</span>
				<el-switch v-show="false" :disabled="canClickSwitch ? false : true"
					style="margin-left: 1%; vertical-align:middle;" v-model="dValue[9]" active-value="1"
					inactive-value="0" active-color="#13ce66" inactive-color="#CCCCCC"></el-switch>
				<img v-show="false" style="margin-left: 20px; vertical-align:middle;" width="22px" height="26px"
					:src="require('@/assets/' + imgSrc[dValue[9]])" />
				<br />
				<br />
				<span v-show="true"
					style="font-size: 20px; color:#545454; margin-left: 7.5%; vertical-align:middle;">2</span>
				<el-switch v-show="true" :disabled="canClickSwitch ? false : true"
					style="margin-left: 1%; vertical-align:middle;" v-model="dValue[2]" active-value="1"
					inactive-value="0" active-color="#13ce66" inactive-color="#CCCCCC"></el-switch>
				<img v-show="true" style="margin-left: 20px; vertical-align:middle;" width="22px" height="26px"
					:src="require('@/assets/' + imgSrc[dValue[2]])" />
				<span v-show="false"
					style="font-size: 20px; color:#545454; margin-left: 18%; vertical-align:middle;">2</span>
				<el-switch v-show="false" :disabled="canClickSwitch ? false : true"
					style="margin-left: 1%; vertical-align:middle;" v-model="dValue[10]" active-value="1"
					inactive-value="0" active-color="#13ce66" inactive-color="#CCCCCC"></el-switch>
				<img v-show="false" style="margin-left: 20px; vertical-align:middle;" width="22px" height="26px"
					:src="require('@/assets/' + imgSrc[dValue[10]])" />
				<br />
				<br />
				<span v-show="true"
					style="font-size: 20px; color:#545454; margin-left: 7.5%; vertical-align:middle;">3</span>
				<el-switch v-show="true" :disabled="canClickSwitch ? false : true"
					style="margin-left: 1%; vertical-align:middle;" v-model="dValue[3]" active-value="1"
					inactive-value="0" active-color="#13ce66" inactive-color="#CCCCCC"></el-switch>
				<img v-show="true" style="margin-left: 20px; vertical-align:middle;" width="22px" height="26px"
					:src="require('@/assets/' + imgSrc[dValue[3]])" />
				<span v-show="false"
					style="font-size: 20px; color:#545454; margin-left: 18%; vertical-align:middle;">3</span>
				<el-switch v-show="false" :disabled="canClickSwitch ? false : true"
					style="margin-left: 1%; vertical-align:middle;" v-model="dValue[11]" active-value="1"
					inactive-value="0" active-color="#13ce66" inactive-color="#CCCCCC"></el-switch>
				<img v-show="false" style="margin-left: 20px; vertical-align:middle;" width="22px" height="26px"
					:src="require('@/assets/' + imgSrc[dValue[11]])" />
				<br />
				<br />
				<span v-show="true"
					style="font-size: 20px; color:#545454; margin-left: 7.5%; vertical-align:middle;">4</span>
				<el-switch v-show="true" :disabled="canClickSwitch ? false : true"
					style="margin-left: 1%; vertical-align:middle;" v-model="dValue[4]" active-value="1"
					inactive-value="0" active-color="#13ce66" inactive-color="#CCCCCC"></el-switch>
				<img v-show="true" style="margin-left: 20px; vertical-align:middle;" width="22px" height="26px"
					:src="require('@/assets/' + imgSrc[dValue[4]])" />
				<span v-show="false"
					style="font-size: 20px; color:#545454; margin-left: 18%; vertical-align:middle;">4</span>
				<el-switch v-show="false" :disabled="canClickSwitch ? false : true"
					style="margin-left: 1%; vertical-align:middle;" v-model="dValue[12]" active-value="1"
					inactive-value="0" active-color="#13ce66" inactive-color="#CCCCCC"></el-switch>
				<img v-show="false" style="margin-left: 20px; vertical-align:middle;" width="22px" height="26px"
					:src="require('@/assets/' + imgSrc[dValue[12]])" />
				<br />
				<br />
				<span v-show="true"
					style="font-size: 20px; color:#545454; margin-left: 7.5%; vertical-align:middle;">5</span>
				<el-switch v-show="true" :disabled="canClickSwitch ? false : true"
					style="margin-left: 1%; vertical-align:middle;" v-model="dValue[5]" active-value="1"
					inactive-value="0" active-color="#13ce66" inactive-color="#CCCCCC"></el-switch>
				<img v-show="true" style="margin-left: 20px; vertical-align:middle;" width="22px" height="26px"
					:src="require('@/assets/' + imgSrc[dValue[5]])" />
				<span v-show="false"
					style="font-size: 20px; color:#545454; margin-left: 18%; vertical-align:middle;">5</span>
				<el-switch v-show="false" :disabled="canClickSwitch ? false : true"
					style="margin-left: 1%; vertical-align:middle;" v-model="dValue[13]" active-value="1"
					inactive-value="0" active-color="#13ce66" inactive-color="#CCCCCC"></el-switch>
				<img v-show="false" style="margin-left: 20px; vertical-align:middle;" width="22px" height="26px"
					:src="require('@/assets/' + imgSrc[dValue[13]])" />
				<br />
				<br />
				<span v-show="true"
					style="font-size: 20px; color:#545454; margin-left: 7.5%; vertical-align:middle;">6</span>
				<el-switch v-show="true" :disabled="canClickSwitch ? false : true"
					style="margin-left: 1%; vertical-align:middle;" v-model="dValue[6]" active-value="1"
					inactive-value="0" active-color="#13ce66" inactive-color="#CCCCCC"></el-switch>
				<img v-show="true" style="margin-left: 20px; vertical-align:middle;" width="22px" height="26px"
					:src="require('@/assets/' + imgSrc[dValue[6]])" />
				<span v-show="false"
					style="font-size: 20px; color:#545454; margin-left: 18%; vertical-align:middle;">6</span>
				<el-switch v-show="false" :disabled="canClickSwitch ? false : true"
					style="margin-left: 1%; vertical-align:middle;" v-model="dValue[14]" active-value="1"
					inactive-value="0" active-color="#13ce66" inactive-color="#CCCCCC"></el-switch>
				<img v-show="false" style="margin-left: 20px; vertical-align:middle;" width="22px" height="26px"
					:src="require('@/assets/' + imgSrc[dValue[14]])" />
				<br />
				<br />
				<span v-show="true"
					style="font-size: 20px; color:#545454; margin-left: 7.5%; vertical-align:middle;">7</span>
				<el-switch v-show="true" :disabled="canClickSwitch ? false : true"
					style="margin-left: 1%; vertical-align:middle;" v-model="dValue[7]" active-value="1"
					inactive-value="0" active-color="#13ce66" inactive-color="#CCCCCC"></el-switch>
				<img v-show="true" style="margin-left: 20px; vertical-align:middle;" width="22px" height="26px"
					:src="require('@/assets/' + imgSrc[dValue[7]])" />
				<span v-show="false"
					style="font-size: 20px; color:#545454; margin-left: 18%; vertical-align:middle;">7</span>
				<el-switch v-show="false" :disabled="canClickSwitch ? false : true"
					style="margin-left: 1%; vertical-align:middle;" v-model="dValue[15]" active-value="1"
					inactive-value="0" active-color="#13ce66" inactive-color="#CCCCCC"></el-switch>
				<img v-show="false" style="margin-left: 20px; vertical-align:middle;" width="22px" height="26px"
					:src="require('@/assets/' + imgSrc[dValue[15]])" />
				<br />
				<br />
			</div>

			<br />
			<span>&emsp;</span>
			<br />
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
	export default {
		methods: {
			handleClick(row) {
				console.log(row);
			},

			changeLampsState(pAction, pIndex) {
				this.canClickSwitch = false;
				Service({
					url: '/api/web/changeLampsState',
					data: {
						groupId: Local.getId(),
						action: pAction,
						index: pIndex
					}
				}).then(
					res => {
						console.log('changeLampsState访问成功', res);
						this.canClickSwitch = true;
						console.log('dValue->', this.dValue);
					},
					err => {
						console.log('changeLampsState err->', err);
						this.dValue[parseInt(pIndex)] = pAction.toString() == '0' ? '1' : '0';
						this.dValueOld = [].concat(this.dValue);
						this.dValue.push();
						this.canClickSwitch = true;
						console.log('dValue->', this.dValue);
					}
				);
			}
		},

		created() {
			Service({
				url: '/api/web/lamps',
				data: {
					groupId: Local.getId()
				}
			}).then(res => {
				console.log('lamps访问成功', res);
				// res.list = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];

				for (let i = 0; i <= 15; i++) {
					if (res.list != null) {
						this.dValue[i] = res.list[i] + '';
					} else {
						this.dValue[i] = 0
					}
				}
				this.dValueOld = [].concat(this.dValue);
				this.dValue.push();
				console.log('dValue->', this.dValue);
			});
		},

		data() {
			return {
				canClickSwitch: true,
				dValueOld: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
				dValue: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
				imgSrc: {
					'0': 'ic_light_off.png',
					'1': 'ic_light_on.png'
				}
			};
		},
		watch: {
			// 如果 `value1` 发生改变，这个函数就会运行
			dValue: function(newQuestion, oldQuestion) {
				let needRefreshOld = false;
				console.log('dValue\n new = ' + newQuestion + '\n old = ' + this.dValueOld);
				for (let i = 0; i <= 15; i++) {
					if (newQuestion[i] != this.dValueOld[i]) {
						console.log('dValue Change index = ' + i + ' value = ' + newQuestion[i]);
						this.changeLampsState(newQuestion[i], i);
						needRefreshOld = true;
					}
				}
				if (needRefreshOld) {
					this.dValueOld = [].concat(this.dValue);
					this.dValue.push();
				}
			}
		}
	};
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
</style>
