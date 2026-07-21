<template>
	<div class="user-root">
		<div style="text-align: left; width: 100%;">
			<br />
			<span>&emsp;</span>
			<el-input style="width: 160px;" v-model="inputID" placeholder="请输入条码编号" />
			<span style="color: #686868;">&emsp;产品类型&emsp;</span>
			<el-select v-model="selectedEquipmentType" clearable placeholder="全部">
				<el-option v-for="item in selectEquipmentType" :key="item.code" :label="item.label" :value="item.value">
				</el-option>
			</el-select>
			<span style="color: #686868;">&emsp;录入日期&emsp;</span>
			<el-date-picker v-model="dateValue" type="date" placeholder="选择日期"></el-date-picker>
			<span>&emsp;</span>
			<el-button type="primary" icon="el-icon-search" @click="searchBtn(true,true)">搜索</el-button>
			<br />
			<span>&emsp;</span>
			<el-table :data="tableData" border stripe style="width: 98%; margin-left:1%; margin-bottom:15%;"
				:header-cell-style="tableStyle">
				<el-table-column prop="barCode" label="条码编号" minWidth="150" fixed></el-table-column>
				<el-table-column prop="typeName" label="类型" minWidth="120" fixed></el-table-column>
				<el-table-column prop="modelName" label="型号" minWidth="120" fixed></el-table-column>
				<el-table-column prop="createAt" label="录入日期" minWidth="150" fixed></el-table-column>
				<el-table-column prop="img" label="产品图片" minWidth="150" fixed>
					<template v-slot:default="scope">
						<div v-if="scope.row.createAt">
							<el-image :src="scope.row.image" />
						</div>
					</template>
				</el-table-column>
				<el-table-column prop="tag" label="标签" minWidth="70" fixed>
					<template slot-scope="scope">
						<div v-if="scope.row.createAt">
							<el-popover placement="right" width="300" trigger="click">
								<el-descriptions class="margin-top" :column="1" border>
									<el-descriptions-item>
										<template slot="label">
											<i></i>
											产品名称
										</template>
									 ARCHERMIND{{scope.row.typeName}}
									</el-descriptions-item>
									<el-descriptions-item>
										<template slot="label">
											<i></i>
											产品型号
										</template>
										{{scope.row.modelName}}
									</el-descriptions-item>
									<el-descriptions-item>
										<template slot="label">
											<i></i>
											数量
										</template>
										1
									</el-descriptions-item>
									<el-descriptions-item>
										<template slot="label">
											<i></i>
											生产日期
										</template>
										{{
										getDate(scope.row.createAt.split(' ')[0])
									}}
									</el-descriptions-item>
								</el-descriptions>
								<div style="text-align: center; margin-top: 20px;">
									<!-- {{barCodeGenerate = scope.row.barCode}}
								<img id="barcode1" /> -->


									<svg class="barcode1" jsbarcode-format="CODE128"
								  :jsbarcode-value="scope.row.barCode" jsbarcode-textmargin="0"
										jsbarcode-fontoptions="bold">
									</svg>
									<br />
								</div>
								<el-button slot="reference" type="primary" size="mini"
									@click="handlePreview(scope.$index, scope.row)">预览</el-button>
							</el-popover>
						</div>
					</template>
				</el-table-column>
			</el-table>
			<br />
			<el-card class="footer">
				<div>
					<el-pagination style="margin-left:15px; margin-bottom:15px;" @size-change="handleSizeChange"
						@current-change="handleCurrentChange" :page-sizes="[15, 30]" :page-size="pageSize"
						:current-page="currentPage" layout="total, sizes, prev, pager, next, jumper" :total="pageTotal">
					</el-pagination>
				</div>
			</el-card>
		</div>
	</div>
</template>

<script>
	//配料区产品展示
	import {
		Service
	} from '@/api/Service.js';
	import router from '@/router';
	import JsBarcode from 'jsbarcode';
	import DataParseUtils from '../utils/DataParseUtils.ts';
	import Local from '@/store/localSave.js'
	export default {
		created() {
			console.log('created');
			this.initDeviceTypes();
			this.searchBtn(true, true)
		},

		methods: {
			getDate(str) {
				let reg = /(\d{4})\-(\d{2})\-(\d{2})/;
				return str.replace(reg, "$1年$2月$3日");
			},
			add0(m) {
				return m < 10 ? '0' + m : m;
			},
			/**
			 * @param {Object} needResetPage 是否需要从第一页开始检索
			 * @param {Object} needRefeshCondition 是否需要刷新搜索条件
			 */
			searchBtn(needResetPage, needRefeshCondition) {
				if (needResetPage) {
					this.currentPage = 1;
				}

				if (this.dateValue) {
					let startDate = new Date(this.dateValue.getTime());
					let startYear = startDate.getFullYear();
					let startMonth = startDate.getMonth() + 1;
					let startDay = startDate.getDate();
					this.startDateParam = startYear + '-' + this.add0(startMonth) + '-' + this.add0(startDay) +
					' 00:00:00';
				} else {
					this.startDateParam = '';
				}
				if (this.dateValue) {
					let endDate = new Date(this.dateValue.getTime() + 8.64e7);
					let endYear = endDate.getFullYear();
					let endMonth = endDate.getMonth() + 1;
					let endDay = endDate.getDate();
					this.endDateParam = endYear + '-' + this.add0(endMonth) + '-' + this.add0(endDay) + ' 00:00:00';;
				} else {
					this.endDateParam = '';
				}
				console.log('searchBtn->datevalue->>Date', this.startDateParam, '--', this.endDateParam);

				if (needRefeshCondition) {
					this.inputIDForSearch = this.inputID;
					this.selectedEquipmentTypeForSearch = this.selectedEquipmentType;
					this.startDateParamForSearch = this.startDateParam;
					this.endDateParamForSearch = this.endDateParam;
				}

				console.log('click->searchBtn', this.inputID, '--', this.selectedEquipmentType, '--', this
					.selectedEquipmentTypeForSearch, '--', this.selectEquipmentType);
				this.getDeviceData();
				window.clearInterval(this.interval);
				this.interval = window.setInterval(() => {
					this.getDeviceData();
				}, 1000);

			},
			getDeviceData() {
				Service({
					url: '/api/web/findProducts',
					data: {
						barCode: !this.inputIDForSearch ? "" : this.inputIDForSearch,
						endTime: !this.endDateParamForSearch ? "" : this.endDateParam,
						currentPage: this.currentPage,
						groupId: Local.getId(),
						// page: this.currentPage,
						pageSize: this.pageSize,
						startTime: !this.startDateParamForSearch ? "" : this.startDateParam,
						// typeCode: this.selectedEquipmentTypeForSearch == '' ? null : this.selectEquipmentType[this.selectedEquipmentTypeForSearch].value,
						typeCode: this.selectedEquipmentTypeForSearch == '' ? "" : this
							.selectedEquipmentTypeForSearch,
					}
				}).then(res => {
					console.log('访问成功', res);
					this.tableData.splice(0);
					for (let i = 0; i < res.records.length; i++) {
						this.tableData.push({
							barCode: res.records[i].barCode,
							typeName: res.records[i].typeName,
							modelName: res.records[i].modelName,
							createAt: res.records[i].createAt,
							image: res.records[i].image,
						});
					}
					this.pageTotal = res.total;
				});
			},
			initDeviceTypes() {
				Service({
					url: '/api/pad/findProductTypes', //todo
					data: {
						groupId: Local.getId()
					}
				}).then(res => {
					console.log('访问成功', res);
					this.selectEquipmentType.splice(0);
					for (let i = 0; i < res.list.length; i++) {
						this.selectEquipmentType.push({
							value: res.list[i].code,
							label: res.list[i].name
						});
					}
					console.log('设备类型：', this.selectEquipmentType);
				});
			},
			handlePreview(index, row) {
				console.log('handlePreview');
				console.log(index, row);
				// let barCode1 = this.info.marIdCode;
				// let barheight = this.imgHeight;
				// JsBarcode('#barcode1', this.barCodeGenerate, {
				// 	format: 'CODE128', //条形码的格式
				// 	width: 1, //线宽
				// 	height: 50, //条码高度
				// 	lineColor: '#000', //线条颜色
				// 	displayValue: true, //是否显示文字
				// 	margin: 2 //设置条形码周围的空白区域
				// });
				JsBarcode(".barcode1").init();
			},
			handleClick(row) {
				console.log(row);
			},

			handleSizeChange(param) {
				console.log('handleSizeChange->', param);
				this.pageSize = param;
				if (this.tableData.length > 0) {
					this.searchBtn(false, false);
				}
			},
			handleCurrentChange(param) {
				console.log('handleCurrentChange>', param);
				this.currentPage = param;
				this.searchBtn(false, false);
			},
			tableStyle() {
				return 'background-color: #cee0ff; color: black';
			},
		},
		destroyed() {
			console.log('destroyed() this.interval=' + this.interval);
			if (this.interval != null) {
				window.clearInterval(this.interval);
			}
		},
		data() {
			return {
				barCodeGenerate: 0,
				pageSize: 15,
				pageTotal: 0,
				currentPage: 1,
				inputID: '',
				inputIDForSearch: '',
				selectedEquipmentType: '',
				selectedEquipmentTypeForSearch: '',
				selectEquipmentType: [{
						value: '1',
						label: '类型1'
					},
					{
						value: '2',
						label: '类型2'
					},
					{
						value: '3',
						label: '类型3'
					}
				],
				value: '',
				value2: true,
				tableData: [{
					createTime: '111',
					snPub: '王小虎',
					snSub: 'X50',
					date: '2023-6-17 15:21:17',
					img: 'https://p3.itc.cn/q_70/images03/20211117/1270baf1c2f84fa19a99ef82c52d454c.png',
					tag: ''
				}],
				dateValue: '',
				interval: 0,
			};
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

	.footer {
		z-index: 500;
		position: fixed;
		bottom: 0;
		width: 100%;
		line-height: var(--footer-height);
		color: #fff;
	}
</style>
