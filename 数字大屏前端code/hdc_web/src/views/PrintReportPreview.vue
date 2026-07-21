<template>
	<div class="user-root">
		<div style="text-align: left; width: 100%;">
			<br />
			<el-table :data="tableData" border stripe style="width: 98%;  margin-left:1%; margin-bottom:15%;" :header-cell-style="tableStyle">
				<el-table-column prop="barCode" label="条码编号" minWidth="150" fixed></el-table-column>
				<el-table-column prop="action" label="扫码类型" minWidth="120" fixed></el-table-column>
				<el-table-column prop="date" label="扫码日期" minWidth="150" fixed></el-table-column>
				<el-table-column prop="productType" label="类型" minWidth="120" fixed></el-table-column>
				<el-table-column prop="productModel" label="型号" minWidth="120" fixed></el-table-column>
			</el-table>
			<br />
			<el-card class="footer">
			<div>
			<el-pagination
				style="margin-left:15px; margin-bottom:15px;"
				@size-change="handleSizeChange"
				@current-change="handleCurrentChange"
				:page-sizes="[15, 30]"
				:page-size="pageSize"
				:current-page="currentPage"
				layout="total, sizes, prev, pager, next, jumper"
				:total="pageTotal"
			></el-pagination>
			</div>
			</el-card>
		</div>
	</div>
</template>

<script>
	//打印报表预览
import { Service } from '@/api/Service.js';
import router from '@/router';
import JsBarcode from 'jsbarcode';
import DataParseUtils from '../utils/DataParseUtils.ts';
import Local from '@/store/localSave.js'
export default {
	created() {
		console.log('created');
		this.searchBtn(true)
	},

	methods: {
		add0(m) {
			return m < 10 ? '0' + m : m;
		},
		searchBtn(needZeroPageStart) {
			if (needZeroPageStart) {
				this.currentPage = 1;
			}
			console.log('click->searchBtn');
			Service({
				url: '/api/web/printBar',
				data: {
					page: this.currentPage - 1,
					// page: this.currentPage,
					pageSize: this.pageSize,
					groupId:Local.getId()
				}
			}).then(res => {
				console.log('访问成功', res);
				this.tableData.splice(0);
				for (let i = 0; i < res.list.length; i++) {
					this.tableData.push({
						barCode: res.list[i].barCode,
						action: res.list[i].action == 0 ? '出库' : '入库',
						date: res.list[i].date,
						productType: res.list[i].productType,
						productModel: res.list[i].productModel
					});
				}
				this.pageTotal = res.total;
			});
		},

		handleSizeChange(param) {
			console.log('handleSizeChange->', param);
			this.pageSize = param;
			if (this.tableData.length > 0) {
				this.searchBtn(false);
			}
		},
		handleCurrentChange(param) {
			console.log('handleCurrentChange>', param);
			this.currentPage = param;
			this.searchBtn(false);
		},
		tableStyle(){
			return 'background-color: #cee0ff; color: black';
		}
	},
	data() {
		return {
			pageSize: 15,
			pageTotal: 0,
			currentPage: 1,
			tableData: [],
			dateValue: ''
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
