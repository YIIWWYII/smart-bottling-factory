<template>
	<div class="factory-page">
		<header class="page-header">
			<div>
				<div class="eyebrow">FACTORY CONTROL CENTER / SIMULATION</div>
				<h1>装瓶产线控制中心</h1>
				<p>这里用于发起演示、确认报警、查看批次详情。大屏端只负责监控。</p>
			</div>
			<div class="header-status">
				<span class="status-dot" :class="{ online: realtimeOnline }"></span>
				{{ realtimeOnline ? '实时数据已连接' : '实时数据重连中' }}
			</div>
		</header>
		<el-alert v-if="!canOperate" class="permission-alert" title="当前账号为只读用户" description="可以查看全部生产数据，但不能运行场景、确认报警或下发参数。" type="warning" :closable="false" show-icon></el-alert>

		<section class="guide-panel">
			<div class="section-heading">
				<div>
					<h2>怎么操作</h2>
					<p>先选一个演示场景，系统会自动推进产线状态；再从批次表中点击“查看详情”。</p>
				</div>
				<el-button plain icon="el-icon-refresh" @click="loadAll">刷新数据</el-button>
			</div>
			<div class="guide-steps">
				<div><b>01</b><span>选择场景</span><small>生成一条新的追踪批次</small></div>
				<div><b>02</b><span>观察结果</span><small>查看通过、待处理或剔除状态</small></div>
				<div><b>03</b><span>处理报警</span><small>确认报警并检查设备反馈</small></div>
			</div>
		</section>

		<section class="control-panel">
			<div class="section-heading">
				<div>
					<h2>演示场景</h2>
					<p>以下按钮会真实调用后端状态机，不是静态展示。</p>
				</div>
			</div>
			<div class="scenario-grid">
				<div class="scenario normal">
					<div class="scenario-index">场景 01</div>
					<h3>正常瓶</h3>
					<p>完整走完气体检测、外观检测、灌装、二检、装箱、AGV 和入库。</p>
					<el-button type="success" icon="el-icon-video-play" :loading="loading" :disabled="!canOperate" @click="runScenario('NORMAL')">运行正常流程</el-button>
				</div>
				<div class="scenario warning">
					<div class="scenario-index">场景 02</div>
					<h3>气体超限</h3>
					<p>模拟 VOC 超过安全阈值，批次会停在气体检测并生成报警。</p>
					<el-button type="warning" icon="el-icon-warning" :loading="loading" :disabled="!canOperate" @click="runScenario('GAS_ALARM')">运行气体报警</el-button>
				</div>
				<div class="scenario danger">
					<div class="scenario-index">场景 03</div>
					<h3>外观缺陷</h3>
					<p>模拟瓶身缺陷，批次会在外观检测处剔除，不会继续装箱。</p>
					<el-button type="danger" icon="el-icon-remove-outline" :loading="loading" :disabled="!canOperate" @click="runScenario('APPEARANCE_DEFECT')">运行缺陷流程</el-button>
				</div>
			</div>
		</section>

		<section class="metric-grid" aria-label="产线统计">
			<div class="metric"><span>总批次</span><strong>{{ dashboard.total }}</strong><small>已创建的追踪批次</small></div>
			<div class="metric blue"><span>运行中</span><strong>{{ dashboard.running }}</strong><small>仍在状态机中</small></div>
			<div class="metric green"><span>已入库</span><strong>{{ dashboard.completed }}</strong><small>完整走完流程</small></div>
			<div class="metric amber"><span>待处理</span><strong>{{ dashboard.holding }}</strong><small>需要人工确认</small></div>
			<div class="metric red"><span>已剔除</span><strong>{{ dashboard.rejected }}</strong><small>检测不合格</small></div>
		</section>

		<section class="workspace-grid">
			<div class="main-column">
				<section class="content-panel">
					<div class="section-heading compact">
						<div><h2>批次追踪</h2><p>点击任意一行或“查看详情”，查看这瓶产品经过的全部工序。</p></div>
					</div>
					<el-table :data="dashboard.runs" stripe class="runs-table" v-loading="loading" @row-click="selectRun">
						<el-table-column prop="traceCode" label="追踪编号" min-width="190"></el-table-column>
						<el-table-column prop="bottleType" label="瓶型" width="110"></el-table-column>
						<el-table-column label="当前工序" min-width="160">
							<template slot-scope="scope">{{ stageLabel(scope.row.currentStage) }}</template>
						</el-table-column>
						<el-table-column label="状态" width="110">
							<template slot-scope="scope"><el-tag :type="tagType(scope.row.status)">{{ statusLabel(scope.row.status) }}</el-tag></template>
						</el-table-column>
						<el-table-column label="操作" width="120" fixed="right">
							<template slot-scope="scope"><el-button type="text" @click.stop="selectRun(scope.row)">查看详情</el-button></template>
						</el-table-column>
					</el-table>
				</section>
			</div>

			<aside class="side-column">
				<section class="content-panel alarm-panel">
					<div class="section-heading compact"><div><h2>安全报警</h2><p>确认后会从待处理列表移除，但历史记录仍保留。</p></div><span class="count-badge">{{ openAlarms.length }}</span></div>
					<div v-if="!openAlarms.length" class="empty">当前没有未确认报警</div>
					<div v-for="alarm in openAlarms.slice(0, 5)" :key="alarm.alarmId" class="alarm-row">
						<div><b>{{ alarmTypeLabel(alarm.alarmType) }}</b><span>{{ alarm.message }}</span><small>{{ alarm.deviceCode }} · 当前值 {{ alarm.value }}</small></div>
						<el-button size="mini" type="warning" :disabled="!canOperate" @click="ackAlarm(alarm.alarmId)">确认</el-button>
					</div>
				</section>

				<section class="content-panel status-panel">
					<div class="section-heading compact"><div><h2>设备与仓储</h2><p>这些是监控状态，不是直接控制按钮。</p></div></div>
					<div class="status-list">
						<div><span>传感器读数</span><strong>{{ operations.latestReadings.length }} 条</strong></div>
						<div><span>AGV任务</span><strong>{{ logistics.tasks.length }} 个</strong></div>
						<div><span>库存箱</span><strong>{{ logistics.stock.length }} 箱</strong></div>
						<div><span>仓区状态</span><strong :class="warehouseAlarm ? 'danger-text' : 'success-text'">{{ warehouseAlarm ? '有报警' : '安全' }}</strong></div>
					</div>
				</section>
			</aside>
		</section>

		<section class="secondary-grid">
			<section class="content-panel">
				<div class="section-heading compact"><div><h2>最新传感器</h2><p>显示最近收到的设备读数，SIMULATION 表示模拟数据。</p></div></div>
				<div v-if="!operations.latestReadings.length" class="empty">暂无传感器数据</div>
				<div v-for="reading in operations.latestReadings.slice(0, 6)" :key="reading.readingId" class="data-row"><span>{{ reading.deviceCode }} / {{ sensorLabel(reading.sensorType) }}</span><strong>{{ reading.value }} {{ reading.unit }}</strong><el-tag size="mini" :type="reading.mode === 'REAL' ? 'success' : 'info'">{{ reading.mode }}</el-tag></div>
			</section>
			<section class="content-panel">
				<div class="section-heading compact"><div><h2>AI决策审计</h2><p>记录 AI 建议、知识版本和后端最终校验结果。</p></div></div>
				<div v-if="!operations.aiAudits.length" class="empty">暂无 AI 审计记录</div>
				<div v-for="audit in operations.aiAudits.slice(0, 4)" :key="audit.auditId" class="data-row clickable" @click="showAudit(audit)"><span>{{ audit.traceCode }} / {{ audit.bottleType }}</span><strong>{{ decisionLabel(audit.decision) }}</strong><el-tag size="mini" :type="audit.validationStatus === 'PASSED' ? 'success' : 'danger'">{{ audit.validationStatus === 'PASSED' ? '已通过' : '需人工复核' }}</el-tag></div>
			</section>
		</section>

		<el-alert v-if="errorMessage" :title="errorMessage" type="error" show-icon closable @close="errorMessage = ''"></el-alert>

		<el-dialog title="批次详情" :visible.sync="runDialogVisible" width="720px">
			<div v-if="selectedRun" class="detail-dialog">
				<div class="detail-summary"><div><small>追踪编号</small><b>{{ selectedRun.traceCode }}</b></div><div><small>当前状态</small><b>{{ statusLabel(selectedRun.status) }}</b></div><div><small>瓶型</small><b>{{ selectedRun.bottleType }}</b></div></div>
				<h3>工序事件</h3>
				<div v-for="event in selectedRun.events" :key="event.eventId" class="event-row"><span>{{ stageLabel(event.stage) }}</span><b :class="event.status">{{ event.status === 'PASSED' ? '通过' : '失败' }}</b><span>{{ event.message }}</span></div>
			</div>
		</el-dialog>
		<el-dialog title="AI决策详情" :visible.sync="auditDialogVisible" width="560px">
			<div v-if="selectedAudit" class="audit-detail"><p><b>追踪编号：</b>{{ selectedAudit.traceCode }}</p><p><b>瓶型：</b>{{ selectedAudit.bottleType }}</p><p><b>知识版本：</b>{{ selectedAudit.knowledgeVersion }}</p><p><b>决策：</b>{{ decisionLabel(selectedAudit.decision) }}</p><p><b>校验说明：</b>{{ selectedAudit.reason }}</p></div>
		</el-dialog>
	</div>
</template>

<script>
import { getFactoryDashboard, runFactoryScenario } from '@/api/FactoryService.js'
import { acknowledgeAlarm, getLogisticsOverview, getOperationsOverview, requestAiRecipe } from '@/api/OperationsService.js'
import { closeFactoryRealtime, connectFactoryRealtime } from '@/api/FactoryRealtime.js'
import auth from '@/store/auth.js'

const STAGE_LABELS = {
	PRETREATMENT: '预处理', GAS_INSPECTION: '气体检测', APPEARANCE_INSPECTION: '外观检测',
	BEVERAGE_READY: '饮料准备', FILLING: '灌装', SECONDARY_INSPECTION: '二次检测',
	PACKING: '机械臂装箱', AGV_TRANSPORT: 'AGV运输', WAREHOUSE_INBOUND: '仓储入库', COMPLETED: '已完成'
}

export default {
	data() {
		return {
			loading: false, errorMessage: '', timer: null, realtimeOnline: false,
			runDialogVisible: false, auditDialogVisible: false, selectedRun: null, selectedAudit: null,
			operations: { latestReadings: [], alarms: [], commands: [], aiAudits: [] },
			logistics: { tasks: [], zones: [], stock: [] },
			dashboard: { total: 0, running: 0, completed: 0, rejected: 0, holding: 0, runs: [] }
		}
	},
	computed: {
		canOperate() { return auth.canOperate },
		openAlarms() { return this.operations.alarms.filter(item => item.status === 'OPEN') },
		warehouseAlarm() { return this.logistics.zones.some(item => item.status === 'ALARM') }
	},
	mounted() { this.loadAll(); this.timer = window.setInterval(this.loadAll, 3000); connectFactoryRealtime(this.loadAll, online => { this.realtimeOnline = online }) },
	beforeDestroy() { window.clearInterval(this.timer); closeFactoryRealtime() },
	methods: {
		async loadAll() { await Promise.all([this.loadDashboard(), this.loadOperations(), this.loadLogistics()]) },
		async loadDashboard() { try { this.dashboard = await getFactoryDashboard() || this.dashboard } catch (error) { this.errorMessage = '无法连接产线后端，请确认 8088 服务已启动' } },
		async loadOperations() { try { this.operations = await getOperationsOverview() || this.operations } catch (error) { this.errorMessage = '运行中心数据加载失败，请检查后端和数据库' } },
		async loadLogistics() { try { this.logistics = await getLogisticsOverview() || this.logistics } catch (error) { this.errorMessage = 'AGV/仓储数据加载失败' } },
		async ackAlarm(alarmId) { if (!this.canOperate) return; try { await acknowledgeAlarm(alarmId); await this.loadOperations() } catch (error) { this.errorMessage = '报警确认失败，请检查后端连接' } },
		async runScenario(scenario) { if (!this.canOperate) return; this.loading = true; this.errorMessage = ''; try { this.selectedRun = await runFactoryScenario(scenario, 'BOT-WEB-' + Date.now()); if (scenario === 'NORMAL') await requestAiRecipe(this.selectedRun.traceCode, this.selectedRun.bottleType, false); this.runDialogVisible = true; await this.loadAll() } catch (error) { this.errorMessage = '场景执行失败，请查看后端日志' } finally { this.loading = false } },
		selectRun(run) { this.selectedRun = run; this.runDialogVisible = true },
		showAudit(audit) { this.selectedAudit = audit; this.auditDialogVisible = true },
		stageLabel(value) { return STAGE_LABELS[value] || value || '未知工序' },
		sensorLabel(value) { return { TEMPERATURE: '温度', HUMIDITY: '湿度', VOC: 'VOC', SMOKE: '烟雾', AGV_DISTANCE: 'AGV距离' }[value] || value },
		statusLabel(value) { return { RUNNING: '运行中', COMPLETED: '已入库', REJECTED: '已剔除', HOLD: '待处理' }[value] || value },
		alarmTypeLabel(value) { return { VOC_LIMIT: 'VOC超限', SMOKE_LIMIT: '烟雾超限', AGV_DISTANCE_LIMIT: 'AGV障碍物' }[value] || value },
		decisionLabel(value) { return { APPLY_RECIPE: '应用配方', MANUAL_REVIEW: '人工复核' }[value] || value },
		tagType(status) { return status === 'COMPLETED' ? 'success' : status === 'REJECTED' ? 'danger' : status === 'HOLD' ? 'warning' : 'info' }
	}
}
</script>

<style scoped>
.factory-page { min-height: 100%; padding: 28px 32px 48px; background: #f3f6fa; color: #182433; }
.permission-alert { margin-bottom: 16px; border-radius: 2px; }
.page-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; margin-bottom: 22px; }
.eyebrow { color: #66809b; font-size: 11px; font-weight: 700; letter-spacing: 2px; }
h1 { margin: 8px 0 8px; font-size: 30px; color: #152437; }.page-header p, .section-heading p { margin: 0; color: #617286; font-size: 13px; line-height: 1.6; }
.header-status { display: flex; align-items: center; gap: 8px; color: #4f6376; font-size: 13px; padding-top: 8px; white-space: nowrap; }.status-dot { width: 9px; height: 9px; border-radius: 50%; background: #c9d2dc; }.status-dot.online { background: #2aa876; box-shadow: 0 0 0 4px rgba(42,168,118,.12); }
.guide-panel, .control-panel, .content-panel { background: #fff; border: 1px solid #dce5ee; border-radius: 6px; box-shadow: 0 3px 12px rgba(31,52,73,.05); }.guide-panel, .control-panel { padding: 22px; margin-bottom: 16px; }
.section-heading { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }.section-heading.compact { align-items: center; }.section-heading h2 { margin: 0 0 5px; color: #1a2a3d; font-size: 18px; }.section-heading.compact h2 { font-size: 16px; }
.guide-steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 18px; }.guide-steps > div { display: grid; grid-template-columns: 38px 1fr; column-gap: 10px; padding: 13px; background: #f6f9fc; border-left: 3px solid #3b82b8; }.guide-steps b { grid-row: span 2; color: #3b82b8; font-size: 18px; }.guide-steps span { font-weight: 700; font-size: 14px; }.guide-steps small { color: #687c90; margin-top: 3px; }
.scenario-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 16px; }.scenario { min-height: 190px; padding: 18px; border: 1px solid #dce5ee; border-top: 3px solid #3b82b8; border-radius: 5px; }.scenario.warning { border-top-color: #d99a2b; }.scenario.danger { border-top-color: #d75252; }.scenario-index { color: #71859a; font-size: 11px; letter-spacing: 1px; }.scenario h3 { margin: 8px 0 6px; font-size: 18px; }.scenario p { min-height: 48px; margin: 0 0 16px; color: #617286; font-size: 13px; line-height: 1.55; }
.metric-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 16px; }.metric { padding: 15px 17px; background: #fff; border: 1px solid #dce5ee; border-left: 4px solid #8aa4bd; border-radius: 5px; }.metric.blue { border-left-color: #3b82b8; }.metric.green { border-left-color: #2aa876; }.metric.amber { border-left-color: #d99a2b; }.metric.red { border-left-color: #d75252; }.metric span, .metric small { display: block; color: #718397; }.metric strong { display: block; margin: 6px 0 3px; font-size: 28px; color: #17283a; }.metric small { font-size: 11px; }
.workspace-grid { display: grid; grid-template-columns: minmax(0, 1.7fr) minmax(320px, .8fr); gap: 16px; }.content-panel { padding: 18px; margin-bottom: 16px; }.runs-table { margin-top: 16px; cursor: pointer; }.count-badge { display: inline-flex; align-items: center; justify-content: center; min-width: 24px; height: 24px; padding: 0 7px; border-radius: 12px; color: #fff; background: #d75252; font-size: 12px; }.alarm-panel { border-top: 3px solid #d99a2b; }.alarm-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 12px 0; border-top: 1px solid #edf1f5; }.alarm-row div { min-width: 0; }.alarm-row b, .alarm-row span, .alarm-row small { display: block; }.alarm-row b { color: #9a6514; font-size: 13px; }.alarm-row span { margin-top: 4px; color: #485d70; font-size: 12px; }.alarm-row small { margin-top: 3px; color: #8a99a8; font-size: 11px; }.status-panel { border-top: 3px solid #2aa876; }.status-list > div { display: flex; justify-content: space-between; padding: 11px 0; border-top: 1px solid #edf1f5; color: #617286; font-size: 13px; }.status-list strong { color: #1c2e42; }.secondary-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }.data-row { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 10px; align-items: center; min-height: 42px; border-top: 1px solid #edf1f5; color: #506477; font-size: 12px; }.data-row strong { color: #1c2e42; }.data-row.clickable { cursor: pointer; }.data-row.clickable:hover { background: #f5f8fb; }.empty { padding: 16px 0; color: #8292a2; font-size: 13px; }.success-text { color: #16845b !important; }.danger-text { color: #c23939 !important; }.detail-summary { display: grid; grid-template-columns: 1.6fr 1fr 1fr; gap: 10px; padding: 14px; background: #f5f8fb; }.detail-summary small, .detail-summary b { display: block; }.detail-summary small { color: #75879a; margin-bottom: 6px; }.detail-summary b { color: #1b2c3f; }.detail-dialog h3 { margin: 20px 0 8px; font-size: 15px; }.event-row { display: grid; grid-template-columns: 150px 65px minmax(0, 1fr); gap: 10px; padding: 9px 0; border-top: 1px solid #edf1f5; font-size: 12px; }.event-row span { overflow-wrap: anywhere; }.PASSED { color: #16845b; }.FAILED { color: #c23939; }.audit-detail p { margin: 0; padding: 10px 0; border-bottom: 1px solid #edf1f5; color: #536779; }.audit-detail b { color: #1c2e42; }
@media (max-width: 1050px) { .workspace-grid { grid-template-columns: 1fr; }.scenario-grid { grid-template-columns: 1fr; }.scenario { min-height: auto; }.metric-grid { grid-template-columns: repeat(3, 1fr); } }
@media (max-width: 700px) { .factory-page { padding: 18px 14px 32px; }.page-header { flex-direction: column; }.guide-steps, .metric-grid, .secondary-grid { grid-template-columns: 1fr; }.data-row { grid-template-columns: minmax(0, 1fr) auto; }.data-row .el-tag { grid-column: 2; }.event-row { grid-template-columns: 1fr; gap: 3px; }.detail-summary { grid-template-columns: 1fr; } }
</style>
