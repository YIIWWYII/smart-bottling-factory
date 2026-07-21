<template>
	<div class="incident-page">
		<header class="page-header">
			<div><span>EXCEPTION ORCHESTRATION</span><h1>异常处置中心</h1><p>按产品、工位和整线三个范围处理异常，工位之间通过缓冲区保持业务隔离。</p></div>
			<div class="header-actions">
				<el-button icon="el-icon-refresh" @click="load" :loading="loading">刷新</el-button>
				<el-button type="warning" icon="el-icon-warning-outline" :disabled="!canOperate" @click="openReport">上报异常</el-button>
			</div>
		</header>

		<el-alert v-if="!canOperate" title="当前账号为只读用户" description="异常上报、路由调整和恢复操作仅对管理员或产线操作员开放。" type="warning" :closable="false" show-icon />

		<section class="summary-strip" aria-label="异常状态汇总">
			<div><span>开放异常</span><strong class="danger">{{ openIncidents.length }}</strong><small>等待处置或复核</small></div>
			<div><span>隔离工位</span><strong>{{ isolatedStageCount }}</strong><small>STOPPED / BLOCKED</small></div>
			<div><span>MQTT 设备</span><strong class="success">{{ mqttDeviceCount }}</strong><small>5 秒内收到报文</small></div>
			<div><span>模拟兜底设备</span><strong>{{ fallbackDeviceCount }}</strong><small>无 MQTT 或报文超时</small></div>
		</section>

		<section class="process-panel">
			<div class="section-title"><div><h2>工位隔离与缓冲</h2><p>异常工位独立停机，上游先进入缓冲，下游缺料等待；整线急停除外。</p></div><span>{{ formatTime(runtime.generatedAt) }}</span></div>
			<div class="stage-grid">
				<button v-for="(stage, index) in stages" :key="stage.code" type="button" class="stage-cell" :class="stageClass(stage.code)" @click="filterStage = filterStage === stage.code ? '' : stage.code">
					<span>{{ String(index + 1).padStart(2, '0') }}</span><b>{{ stage.name }}</b><i></i>
					<small>{{ stageState(stage.code).state === 'RUNNING' ? '独立运行' : stateLabel(stageState(stage.code).state) }}</small>
					<div class="buffer"><em>缓冲</em><strong>{{ stageState(stage.code).bufferLevel }}/{{ stageState(stage.code).bufferCapacity }}</strong></div>
				</button>
			</div>
		</section>

		<div class="workspace">
			<section class="incident-panel">
				<div class="section-title compact">
					<div><h2>待处置异常</h2><p>优先处理安全与整线异常，再处理设备和单件产品问题。</p></div>
					<el-select v-model="filterStage" clearable placeholder="全部工位" size="small"><el-option v-for="stage in stages" :key="stage.code" :label="stage.name" :value="stage.code" /></el-select>
				</div>
				<div v-if="!filteredOpenIncidents.length" class="empty-state"><i class="el-icon-circle-check"></i><b>当前筛选范围没有开放异常</b></div>
				<div v-for="incident in filteredOpenIncidents" :key="incident.incidentId" class="incident-row" :class="severityClass(incident.strategy)">
					<div class="incident-scope"><span>{{ scopeLabel(incident.strategy) }}</span><b>{{ strategyLabel(incident.strategy) }}</b></div>
					<div class="incident-main"><div><strong>{{ stageLabel(incident.stageCode) }}</strong><code>{{ incident.deviceCode || 'PROCESS' }}</code></div><p>{{ incident.message }}</p><small>{{ incident.traceCode || '未绑定单件产品' }} · {{ formatTime(incident.createdAt) }}</small></div>
					<div class="incident-route"><span>当前目标</span><b>{{ routeLabel(incident.targetStage) }}</b><small>{{ impactText(incident) }}</small></div>
					<el-button type="primary" size="mini" :disabled="!canOperate" @click="openResolution(incident)">处置</el-button>
				</div>
			</section>

			<aside class="policy-panel">
				<div class="section-title compact"><div><h2>处置边界</h2><p>选择最小必要影响范围。</p></div></div>
				<div v-for="policy in policies" :key="policy.strategy" class="policy-row">
					<i :class="policy.level"></i><div><b>{{ policy.name }}</b><span>{{ policy.when }}</span></div><small>{{ policy.impact }}</small>
				</div>
			</aside>
		</div>

		<section class="history-panel">
			<div class="section-title compact"><div><h2>最近处置记录</h2><p>保留原异常、最终动作、目标路线和操作备注。</p></div></div>
			<el-table :data="resolvedIncidents.slice(0, 12)" stripe empty-text="暂无已处置记录">
				<el-table-column label="完成时间" width="155"><template slot-scope="scope">{{ formatTime(scope.row.resolvedAt) }}</template></el-table-column>
				<el-table-column label="工位" width="130"><template slot-scope="scope">{{ stageLabel(scope.row.stageCode) }}</template></el-table-column>
				<el-table-column prop="message" label="异常" min-width="220" show-overflow-tooltip />
				<el-table-column label="处置" width="140"><template slot-scope="scope">{{ actionLabel(scope.row.resolutionAction) }}</template></el-table-column>
				<el-table-column label="目标" min-width="150"><template slot-scope="scope">{{ routeLabel(scope.row.targetStage) }}</template></el-table-column>
			</el-table>
		</section>

		<el-dialog title="上报产线异常" :visible.sync="reportVisible" width="680px" :close-on-click-modal="false">
			<el-form :model="reportForm" label-position="top" class="incident-form">
				<div class="form-grid"><el-form-item label="发生工位" required><el-select v-model="reportForm.stageCode" @change="syncReportTarget"><el-option v-for="stage in stages" :key="stage.code" :label="stage.name" :value="stage.code" /></el-select></el-form-item><el-form-item label="设备编号"><el-input v-model.trim="reportForm.deviceCode" placeholder="没有具体设备可留空" /></el-form-item></div>
				<div class="form-grid"><el-form-item label="异常类型" required><el-select v-model="reportForm.incidentType"><el-option v-for="type in incidentTypes" :key="type.value" :label="type.label" :value="type.value" /></el-select></el-form-item><el-form-item label="影响范围 / 初始策略" required><el-select v-model="reportForm.strategy" @change="syncReportTarget"><el-option v-for="option in strategyOptions" :key="option.value" :label="option.label" :value="option.value" /></el-select></el-form-item></div>
				<div class="form-grid"><el-form-item label="产品追踪号"><el-input v-model.trim="reportForm.traceCode" placeholder="单件缺陷、回退或返工时填写" /></el-form-item><el-form-item label="目标路线"><el-input v-model.trim="reportForm.targetStage" /></el-form-item></div>
				<el-form-item label="异常说明" required><el-input type="textarea" :rows="3" v-model.trim="reportForm.message" placeholder="填写现象、检测值和需要隔离的对象" /></el-form-item>
			</el-form>
			<div class="strategy-impact"><b>{{ strategyLabel(reportForm.strategy) }}</b><span>{{ selectedStrategyDescription }}</span></div>
			<span slot="footer"><el-button @click="reportVisible=false">取消</el-button><el-button type="warning" :loading="submitting" @click="submitIncident">确认上报</el-button></span>
		</el-dialog>

		<el-dialog title="异常处置" :visible.sync="resolutionVisible" width="680px" :close-on-click-modal="false">
			<div v-if="selectedIncident" class="resolution-dialog">
				<div class="resolution-summary"><span>{{ stageLabel(selectedIncident.stageCode) }}</span><b>{{ selectedIncident.message }}</b><small>{{ selectedIncident.traceCode || '未绑定产品' }}</small></div>
				<el-form label-position="top"><el-form-item label="最终处理动作"><el-radio-group v-model="resolutionForm.action" class="action-grid" @change="syncResolutionTarget"><el-radio-button v-for="action in resolutionActions" :key="action.value" :label="action.value">{{ action.label }}</el-radio-button></el-radio-group></el-form-item><el-form-item label="目标路线"><el-input v-model.trim="resolutionForm.targetStage" :disabled="resolutionForm.action === 'RESUME'" /></el-form-item><el-form-item label="处理记录"><el-input type="textarea" :rows="3" v-model.trim="resolutionForm.note" placeholder="填写复检、维修、清场或人工确认结果" /></el-form-item></el-form>
				<div class="strategy-impact"><b>{{ actionLabel(resolutionForm.action) }}</b><span>{{ selectedActionDescription }}</span></div>
			</div>
			<span slot="footer"><el-button @click="resolutionVisible=false">取消</el-button><el-button type="primary" :loading="submitting" @click="submitResolution">执行并关闭异常</el-button></span>
		</el-dialog>
	</div>
</template>

<script>
import auth from '@/store/auth.js'
import { getFactoryIncidents, getFactoryRuntime, reportFactoryIncident, resolveFactoryIncident } from '@/api/OperationsService.js'

const STAGES = [
	{ code: 'PRETREATMENT', name: '预处理' }, { code: 'GAS_INSPECTION', name: '气体检测' },
	{ code: 'APPEARANCE_INSPECTION', name: '外观检测' }, { code: 'BEVERAGE_READY', name: '饮料准备' },
	{ code: 'FILLING', name: '灌装' }, { code: 'SECONDARY_INSPECTION', name: '二次检测' },
	{ code: 'PACKING', name: '机械臂装箱' }, { code: 'AGV_TRANSPORT', name: 'AGV 运输' },
	{ code: 'WAREHOUSE_INBOUND', name: '仓储入库' }
]

const STRATEGIES = [
	{ value: 'REJECT_PRODUCT', label: '剔除当前产品', description: '只改变当前产品状态，工位和其他产品继续运行。' },
	{ value: 'STOP_STAGE', label: '仅停当前工位', description: '隔离当前工位，上游进入缓冲，下游缺料等待。' },
	{ value: 'RETURN_PREVIOUS', label: '返回上一工位', description: '当前产品回到上一工位复检，不影响其他产品。' },
	{ value: 'ROUTE_REWORK', label: '进入返工流程', description: '创建返工辅助路线，完成后返回原工位。' },
	{ value: 'BUFFER_AND_STOP', label: '进入缓冲并停工', description: '产品进入工位缓冲，当前工位停机等待维修。' },
	{ value: 'STOP_LINE', label: '整线急停', description: '仅用于火灾、人员或设备重大安全风险。' },
	{ value: 'MANUAL_HOLD', label: '人工确认', description: '冻结当前产品，等待人工复核后再决定路线。' }
]

export default {
	data() {
		return {
			stages: STAGES, loading: false, submitting: false, timer: null, filterStage: '',
			runtime: { generatedAt: null, devices: [], stages: [], incidents: [] }, incidents: [],
			reportVisible: false, resolutionVisible: false, selectedIncident: null,
			reportForm: {}, resolutionForm: { action: 'RESUME', targetStage: '', note: '' },
			strategyOptions: STRATEGIES,
			incidentTypes: [
				{ value: 'PRODUCT_DEFECT', label: '产品缺陷' }, { value: 'QUALITY_RECHECK', label: '质量复检' },
				{ value: 'EQUIPMENT_FAILURE', label: '设备故障' }, { value: 'PROCESS_EXCEPTION', label: '工艺异常' },
				{ value: 'SAFETY_RISK', label: '安全风险' }, { value: 'MATERIAL_BLOCKED', label: '物料堵塞' }
			],
			resolutionActions: [
				{ value: 'RESUME', label: '恢复原工位', description: '解除隔离，产品从原工位继续。' },
				{ value: 'REJECT_PRODUCT', label: '剔除产品', description: '产品转为已剔除，其他产品继续运行。' },
				{ value: 'RETURN_PREVIOUS', label: '返回上一工位', description: '产品回到上一工位重新检查。' },
				{ value: 'ROUTE_REWORK', label: '进入返工', description: '产品进入动态返工流程，完成后回到原工位。' },
				{ value: 'BUFFER_AND_STOP', label: '转入缓冲', description: '产品进入缓冲路线，维修完成后再恢复工位。' }
			],
			policies: [
				{ strategy: 'REJECT_PRODUCT', name: '单件剔除 / 回退', when: '外观、液位、瓶盖等单件质量问题', impact: '仅当前产品', level: 'normal' },
				{ strategy: 'BUFFER_AND_STOP', name: '工位隔离 + 缓冲', when: '设备故障、堵料、需要维修', impact: '当前工位和相邻物流', level: 'warning' },
				{ strategy: 'STOP_LINE', name: '整线急停', when: '火灾、人员风险、重大失控', impact: '全部工位', level: 'danger' }
			]
		}
	},
	computed: {
		canOperate() { return auth.canOperate },
		openIncidents() { return this.incidents.filter(item => item.status === 'OPEN') },
		resolvedIncidents() { return this.incidents.filter(item => item.status === 'RESOLVED').sort((a, b) => String(b.resolvedAt).localeCompare(String(a.resolvedAt))) },
		filteredOpenIncidents() { return this.openIncidents.filter(item => !this.filterStage || item.stageCode === this.filterStage) },
		isolatedStageCount() { return this.runtime.stages.filter(item => item.state !== 'RUNNING').length },
		mqttDeviceCount() { return this.runtime.devices.filter(item => item.source === 'MQTT' && !item.fallback).length },
		fallbackDeviceCount() { return this.runtime.devices.filter(item => item.fallback).length },
		selectedStrategyDescription() { const item = STRATEGIES.find(option => option.value === this.reportForm.strategy); return item ? item.description : '' },
		selectedActionDescription() { const item = this.resolutionActions.find(option => option.value === this.resolutionForm.action); return item ? item.description : '' }
	},
	mounted() { this.resetReport(); this.load(); this.timer = window.setInterval(this.load, 3000) },
	beforeDestroy() { window.clearInterval(this.timer) },
	methods: {
		async load() { this.loading = true; try { const result = await Promise.all([getFactoryRuntime(), getFactoryIncidents()]); this.runtime = result[0] || this.runtime; this.incidents = result[1] || [] } finally { this.loading = false } },
		resetReport() { this.reportForm = { stageCode: 'APPEARANCE_INSPECTION', deviceCode: '', incidentType: 'PRODUCT_DEFECT', strategy: 'REJECT_PRODUCT', traceCode: '', targetStage: 'REJECT_LANE_APPEARANCE_INSPECTION', message: '' } },
		openReport() { this.resetReport(); this.reportVisible = true },
		openResolution(incident) { const defaults = { REJECT_PRODUCT: 'REJECT_PRODUCT', RETURN_PREVIOUS: 'RETURN_PREVIOUS', ROUTE_REWORK: 'ROUTE_REWORK', BUFFER_AND_STOP: 'BUFFER_AND_STOP' }; this.selectedIncident = incident; this.resolutionForm = { action: defaults[incident.strategy] || 'RESUME', targetStage: incident.targetStage || incident.stageCode, note: '' }; this.syncResolutionTarget(this.resolutionForm.action); this.resolutionVisible = true },
		async submitIncident() {
			if (!this.reportForm.stageCode || !this.reportForm.incidentType || !this.reportForm.strategy || !this.reportForm.message) return this.$message.warning('请填写工位、异常类型、策略和异常说明')
			if (this.reportForm.strategy === 'STOP_LINE') { try { await this.$confirm('整线急停会停止全部工位，确认当前存在重大安全风险？', '整线急停确认', { type: 'error', confirmButtonText: '确认急停', cancelButtonText: '取消' }) } catch (error) { return } }
			this.submitting = true
			try { await reportFactoryIncident(this.reportForm); this.reportVisible = false; this.$message.success('异常已上报，运行中枢已执行隔离策略'); await this.load() } finally { this.submitting = false }
		},
		async submitResolution() {
			if (!this.selectedIncident) return
			this.submitting = true
			try { await resolveFactoryIncident(this.selectedIncident.incidentId, this.resolutionForm); this.resolutionVisible = false; this.$message.success('处置完成，产品路线和工位状态已更新'); await this.load() } finally { this.submitting = false }
		},
		syncReportTarget() { const code = this.reportForm.stageCode; const index = STAGES.findIndex(item => item.code === code); const strategy = this.reportForm.strategy; if (strategy === 'RETURN_PREVIOUS') this.reportForm.targetStage = index > 0 ? STAGES[index - 1].code : code; else if (strategy === 'ROUTE_REWORK') this.reportForm.targetStage = `REWORK_${code}`; else if (strategy === 'BUFFER_AND_STOP') this.reportForm.targetStage = `BUFFER_${code}`; else if (strategy === 'REJECT_PRODUCT') this.reportForm.targetStage = `REJECT_LANE_${code}`; else this.reportForm.targetStage = code },
		syncResolutionTarget(action) { if (!this.selectedIncident) return; const code = this.selectedIncident.stageCode; const index = STAGES.findIndex(item => item.code === code); if (action === 'RESUME') this.resolutionForm.targetStage = code; else if (action === 'RETURN_PREVIOUS') this.resolutionForm.targetStage = index > 0 ? STAGES[index - 1].code : code; else if (action === 'ROUTE_REWORK') this.resolutionForm.targetStage = `REWORK_${code}`; else if (action === 'BUFFER_AND_STOP') this.resolutionForm.targetStage = `BUFFER_${code}`; else if (action === 'REJECT_PRODUCT') this.resolutionForm.targetStage = `REJECT_LANE_${code}` },
		stageState(code) { return this.runtime.stages.find(item => item.stageCode === code) || { state: 'UNKNOWN', bufferLevel: 0, bufferCapacity: 6 } },
		stageClass(code) { const value = this.stageState(code).state; return { selected: this.filterStage === code, stopped: value === 'STOPPED', blocked: value === 'BLOCKED', running: value === 'RUNNING' } },
		stateLabel(value) { return { RUNNING: '运行中', STOPPED: '已隔离', BLOCKED: '缓冲已满', STANDBY: '待机' }[value] || value },
		stageLabel(code) { const item = STAGES.find(stage => stage.code === code); return item ? item.name : code },
		strategyLabel(value) { const item = STRATEGIES.find(option => option.value === value); return item ? item.label : value },
		actionLabel(value) { const item = this.resolutionActions.find(option => option.value === value); return item ? item.label : this.strategyLabel(value) },
		scopeLabel(strategy) { return strategy === 'STOP_LINE' ? '整线' : ['STOP_STAGE', 'BUFFER_AND_STOP'].includes(strategy) ? '工位' : '产品' },
		severityClass(strategy) { return strategy === 'STOP_LINE' ? 'critical' : ['STOP_STAGE', 'BUFFER_AND_STOP'].includes(strategy) ? 'warning' : 'product' },
		impactText(incident) { return incident.strategy === 'STOP_LINE' ? '全部工位停止' : ['STOP_STAGE', 'BUFFER_AND_STOP'].includes(incident.strategy) ? '上游缓冲，下游等待' : '其他产品继续运行' },
		routeLabel(value) { if (!value) return '原工位'; if (value.startsWith('REWORK_')) return `返工 · ${this.stageLabel(value.slice(7))}`; if (value.startsWith('BUFFER_')) return `缓冲 · ${this.stageLabel(value.slice(7))}`; if (value.startsWith('REJECT_LANE_')) return '不合格品剔除通道'; return this.stageLabel(value) },
		formatTime(value) { return value ? String(value).replace('T', ' ').slice(0, 19) : '等待同步' }
	}
}
</script>

<style scoped>
.incident-page { min-height: 100%; padding: 24px 28px 44px; color: #263136; background: #edf0f1; }
.page-header, .section-title, .header-actions { display: flex; align-items: center; }.page-header { justify-content: space-between; gap: 20px; margin-bottom: 17px; }.page-header span { color: #8b6816; font: 700 10px Consolas, monospace; }.page-header h1 { margin: 5px 0 4px; font-size: 27px; letter-spacing: 0; }.page-header p, .section-title p { margin: 0; color: #768186; font-size: 11px; }.header-actions { gap: 8px; }
.summary-strip { display: grid; grid-template-columns: repeat(4, 1fr); margin-top: 12px; border: 1px solid #bdc5c8; background: #fafafa; }.summary-strip > div { min-height: 91px; padding: 13px 15px; border-left: 1px solid #d3d8da; }.summary-strip > div:first-child { border-left: 0; }.summary-strip span, .summary-strip strong, .summary-strip small { display: block; }.summary-strip span, .summary-strip small { color: #778287; }.summary-strip span { font-size: 9px; }.summary-strip strong { margin: 6px 0 2px; color: #273337; font-size: 25px; }.summary-strip small { font-size: 8px; }.danger { color: #c64740 !important; }.success { color: #27844c !important; }
.process-panel, .incident-panel, .policy-panel, .history-panel { margin-top: 12px; padding: 16px; border: 1px solid #c2c9cb; background: #fafafa; }.section-title { justify-content: space-between; gap: 12px; margin-bottom: 13px; }.section-title h2 { margin: 0 0 4px; font-size: 16px; }.section-title > span { color: #7b8589; font: 9px Consolas, monospace; }.section-title.compact { align-items: flex-start; }
.stage-grid { display: grid; grid-template-columns: repeat(9, minmax(88px, 1fr)); border: 1px solid #cbd1d3; }.stage-cell { position: relative; min-width: 0; min-height: 112px; padding: 11px 9px; color: #3a4549; border: 0; border-right: 1px solid #cbd1d3; background: #f5f6f6; cursor: pointer; text-align: left; }.stage-cell:last-child { border-right: 0; }.stage-cell:hover, .stage-cell.selected { background: #fff6df; }.stage-cell > span { color: #9a741d; font: 700 10px Consolas, monospace; }.stage-cell > b { display: block; min-height: 31px; margin-top: 7px; font-size: 11px; line-height: 1.35; }.stage-cell > i { display: inline-block; width: 7px; height: 7px; margin-right: 5px; border-radius: 50%; background: #46a865; }.stage-cell > small { color: #697579; font-size: 8px; }.stage-cell.stopped > i { background: #d04d45; }.stage-cell.blocked > i { background: #e3a72b; }.buffer { display: flex; justify-content: space-between; margin-top: 10px; padding-top: 7px; border-top: 1px solid #d8dcdd; }.buffer em { color: #899397; font-size: 8px; font-style: normal; }.buffer strong { color: #566267; font: 9px Consolas, monospace; }
.workspace { display: grid; grid-template-columns: minmax(0, 1.9fr) minmax(260px, .75fr); gap: 12px; }.incident-panel, .policy-panel { min-width: 0; }.section-title .el-select { width: 145px; }.empty-state { display: grid; place-items: center; min-height: 185px; color: #7b878b; }.empty-state i { color: #3da464; font-size: 28px; }.empty-state b { margin-top: -42px; font-size: 11px; }.incident-row { display: grid; grid-template-columns: 88px minmax(0, 1.5fr) minmax(160px, .8fr) 58px; gap: 12px; align-items: center; min-height: 92px; padding: 11px 0; border-top: 1px solid #d9ddde; }.incident-row:first-of-type { border-top: 0; }.incident-scope { align-self: stretch; padding: 10px; border-left: 3px solid #66818e; background: #eef1f2; }.incident-scope span, .incident-scope b { display: block; }.incident-scope span { color: #77858a; font-size: 8px; }.incident-scope b { margin-top: 7px; font-size: 10px; line-height: 1.4; }.incident-row.warning .incident-scope { border-left-color: #d39b24; background: #fbf5e6; }.incident-row.critical .incident-scope { border-left-color: #c94c44; background: #fbefee; }.incident-main > div { display: flex; align-items: center; gap: 8px; }.incident-main code { color: #737f84; font-size: 9px; }.incident-main p { margin: 6px 0; color: #4d595e; font-size: 10px; line-height: 1.5; }.incident-main small { color: #8b9599; font: 8px Consolas, monospace; }.incident-route span, .incident-route b, .incident-route small { display: block; }.incident-route span { color: #899397; font-size: 8px; }.incident-route b { margin: 5px 0; font-size: 10px; }.incident-route small { color: #7a8589; font-size: 8px; }
.policy-row { display: grid; grid-template-columns: 8px 1fr; gap: 4px 9px; padding: 12px 0; border-top: 1px solid #d8ddde; }.policy-row > i { width: 8px; height: 8px; margin-top: 3px; border-radius: 50%; background: #5a8c70; }.policy-row > i.warning { background: #d39b24; }.policy-row > i.danger { background: #c94c44; }.policy-row b, .policy-row span { display: block; }.policy-row b { font-size: 10px; }.policy-row span, .policy-row small { color: #7a858a; font-size: 8px; line-height: 1.55; }.policy-row small { grid-column: 2; }
.history-panel { overflow: hidden; }.incident-form .el-select { width: 100%; }.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }.strategy-impact { padding: 11px 13px; border-left: 3px solid #d79d23; background: #f6f2e8; }.strategy-impact b, .strategy-impact span { display: block; }.strategy-impact b { color: #76580f; font-size: 11px; }.strategy-impact span { margin-top: 4px; color: #776d55; font-size: 9px; }.resolution-summary { margin-bottom: 15px; padding: 13px; border: 1px solid #cdd3d5; background: #f4f6f6; }.resolution-summary span, .resolution-summary b, .resolution-summary small { display: block; }.resolution-summary span { color: #9a741d; font-size: 9px; }.resolution-summary b { margin: 6px 0; font-size: 12px; }.resolution-summary small { color: #798488; font: 9px Consolas, monospace; }.action-grid { display: flex; flex-wrap: wrap; }.action-grid :deep(.el-radio-button__inner) { border-radius: 0; }
@media (max-width: 1180px) { .stage-grid { grid-template-columns: repeat(3, 1fr); }.stage-cell { border-bottom: 1px solid #cbd1d3; }.workspace { grid-template-columns: 1fr; } }
@media (max-width: 720px) { .incident-page { padding: 17px 12px 32px; }.page-header { align-items: flex-start; flex-direction: column; }.summary-strip { grid-template-columns: 1fr 1fr; }.summary-strip > div:nth-child(3) { border-top: 1px solid #d3d8da; }.stage-grid { grid-template-columns: 1fr 1fr; }.incident-row { grid-template-columns: 72px minmax(0, 1fr); }.incident-route { grid-column: 2; }.incident-row > .el-button { grid-column: 2; justify-self: start; }.form-grid { grid-template-columns: 1fr; gap: 0; }.section-title { align-items: flex-start; flex-direction: column; }.section-title .el-select { width: 100%; }.incident-page :deep(.el-dialog) { width: 92% !important; } }
</style>
