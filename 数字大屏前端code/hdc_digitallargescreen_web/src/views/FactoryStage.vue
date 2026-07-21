<template>
	<div class="stage-page">
		<header class="stage-header">
			<div class="stage-nav">
				<button type="button" @click="goOverview">← 产线总览</button>
				<span><b>SIMULATION</b> · 工位 {{ String(stageIndex + 1).padStart(2, '0') }} / {{ stages.length }}</span>
			</div>
			<div class="header-main">
				<div><div class="station-code">{{ stage.code }}</div><h1>{{ stage.name }}工位</h1><p>{{ stage.description }}</p></div>
				<div class="live-state" :class="stageStatusClass"><i></i><div><small>工位状态</small><b>{{ stageStatus }}</b></div></div>
			</div>
			<div class="stage-switcher">
				<button type="button" :disabled="!previousStage" @click="goStage(previousStage)">← 上一工位 <span>{{ previousStage ? previousStage.name : '产线起点' }}</span></button>
				<button type="button" :disabled="!nextStage" @click="goStage(nextStage)"><span>{{ nextStage ? nextStage.name : '产线终点' }}</span> 下一工位 →</button>
			</div>
		</header>

		<section class="workcell">
			<div class="section-heading">
				<div><span class="section-number">01</span><h2>工位可视化</h2><p>平面图看清设备位置和物料路径，三维图查看设备空间关系与运行动画。点击设备或产品查看档案。</p></div>
				<div class="visual-toolbar">
					<label class="status-color-control"><span>状态颜色</span><el-switch v-model="stateColorsEnabled" active-color="#e9aa24" inactive-color="#596367" @change="saveStateColorPreference"></el-switch></label>
					<button v-if="viewMode !== 'off'" type="button" class="pause-visual" :class="{ active: visualPaused }" @click="toggleVisualPause"><i :class="visualPaused ? 'el-icon-video-play' : 'el-icon-video-pause'"></i>{{ visualPaused ? '恢复实时' : '暂停画面' }}</button>
					<div class="view-switch" role="tablist">
						<button type="button" class="off" :class="{ active: viewMode === 'off' }" :aria-selected="viewMode === 'off'" @click="setViewMode('off')"><i class="el-icon-switch-button"></i>关闭</button>
						<button type="button" :class="{ active: viewMode === 'plan' }" :aria-selected="viewMode === 'plan'" @click="setViewMode('plan')"><i class="el-icon-map-location"></i>平面工艺图</button>
						<button type="button" :class="{ active: viewMode === 'three' }" :aria-selected="viewMode === 'three'" @click="setViewMode('three')"><i class="el-icon-c-scale-to-original"></i>三维运行图</button>
					</div>
				</div>
			</div>
			<StagePlanView v-if="viewMode === 'plan'" ref="visualView" :key="'plan-' + visualRevision" :stage="stage" :running="visualRuntime.running" :paused="visualPaused" :state-colors="stateColorsEnabled" :products="visualProducts" :alarm-count="visualAlarmCount" :runtime="visualRuntime" :now-ms="visualNowMs" :device-states="visualDeviceStates" :device-activity="visualDeviceActivity" @select-device="showDevice" @select-product="showProduct" />
			<StageThreeView v-else-if="viewMode === 'three'" ref="visualView" :key="'three-' + visualRevision" :stage="stage" :running="visualRuntime.running" :paused="visualPaused" :state-colors="stateColorsEnabled" :products="visualProducts" :product-key="visualProductKey" :alarm-count="visualAlarmCount" :runtime="visualRuntime" :now-ms="visualNowMs" :device-states="visualDeviceStates" :device-activity="visualDeviceActivity" @select-device="showDevice" @select-product="showProduct" />
			<div v-else class="visualization-off"><i class="el-icon-switch-button"></i><b>可视化已关闭</b><span>实时数据继续刷新，设备动画与三维渲染已停止</span></div>
			<div v-if="viewMode !== 'off'" class="visual-runtime-bar">
				<div><span>联动数据源</span><b>{{ visualRuntime.source }}</b></div>
				<div><span>当前速度</span><b>{{ visualRuntime.speedDisplay }}</b></div>
				<div><span>可视化段长</span><b>{{ visualRuntime.pathDisplay }}</b></div>
				<div><span>画面通过周期</span><b>{{ visualRuntime.cycleDisplay }}</b></div>
				<div><span>联动状态</span><b :class="visualRuntime.running ? 'success-text' : ''">{{ visualPaused ? '画面与数据同时冻结' : visualRuntime.running ? '平面 / 三维同步运行' : visualRuntime.status }}</b></div>
			</div>
		</section>

		<div class="stage-details-heading">
			<div><span>STATION OPERATIONS</span><h2>工位运行与质量控制</h2></div>
			<p>设备动作 · 工艺参数 · 质量放行 · 在制品 · 异常影响</p>
		</div>

		<section class="live-metrics" aria-label="工位运行指标">
			<div><span>工位状态</span><strong :class="stageStatusClass === 'alarm' ? 'danger-text' : 'success-text'">{{ stageStatus }}</strong><small>{{ stageRuntimeState.state || 'STANDBY' }}</small></div>
			<div><span>当前速度</span><strong>{{ liveRuntime.speedDisplay }}</strong><small>通过周期 {{ liveRuntime.cycleDisplay }}</small></div>
			<div><span>缓冲占用</span><strong :class="{ 'warning-text': bufferPercent >= 50, 'danger-text': bufferPercent >= 80 }">{{ stageRuntimeState.bufferLevel || 0 }}/{{ stageRuntimeState.bufferCapacity || 0 }}</strong><small>{{ bufferPercent.toFixed(0) }}% · 工位间解耦缓冲</small></div>
			<div><span>设备在线</span><strong>{{ onlineDeviceCount }}/{{ stage.devices.length }}</strong><small>{{ mqttDeviceCount }} MQTT · {{ simulationDeviceCount }} 模拟</small></div>
			<div><span>工位在制品</span><strong>{{ currentWipCount }}</strong><small>当前位于本工位或待处理</small></div>
			<div><span>数据时间</span><strong class="time-value">{{ dataTime }}</strong><small>{{ liveRuntime.source }}</small></div>
		</section>

		<section class="operations-grid">
			<section class="device-status-panel">
				<div class="section-heading compact"><div><span class="section-number">02</span><h2>设备运行清单</h2><p>状态、数据源和当前动作来自设备运行态；点击设备查看参数和关联读数。</p></div><span class="section-count">{{ onlineDeviceCount }}/{{ stage.devices.length }} 在线</span></div>
				<div class="device-table">
					<div class="device-table-head"><span>设备</span><span>状态</span><span>数据源</span><span>当前动作</span><span>关键读数</span></div>
					<button v-for="(item, index) in deviceRows" :key="item.device.code" type="button" class="device-table-row" @click="showDevice(item.device, index)">
						<span><i>{{ String(index + 1).padStart(2, '0') }}</i><b>{{ item.device.name }}</b><small>{{ item.device.code }}</small></span>
						<span><i class="state-dot" :class="item.state"></i>{{ item.status }}</span>
						<span><b>{{ item.source }}</b><small>{{ item.fallback ? '自动兜底' : '设备报文' }}</small></span>
						<span>{{ item.action }}</span>
						<span><b>{{ item.reading }}</b><i class="el-icon-arrow-right"></i></span>
					</button>
				</div>
			</section>

			<section class="quality-gate-panel">
				<div class="section-heading compact"><div><span class="section-number">03</span><h2>质量放行门</h2><p>显示当前环节真实判定依据、最近结果和数据来源。</p></div></div>
				<div class="gate-summary" :class="qualityGateSummary.className"><i></i><div><span>当前放行结论</span><strong>{{ qualityGateSummary.label }}</strong></div><b>{{ qualityGateSummary.count }}</b></div>
				<div class="gate-list">
					<div v-for="gate in qualityGates" :key="gate.label" class="gate-row">
						<i :class="gate.status.toLowerCase()"></i><div><strong>{{ gate.label }}</strong><span>标准：{{ gate.standard }}</span></div><div><b>{{ gate.actual }}</b><small>{{ gate.source }}</small></div>
					</div>
				</div>
			</section>
		</section>

		<section class="material-section">
			<div class="section-heading">
				<div><span class="section-number">04</span><h2>物料与在制品</h2><p>每种物料独立记录规格、批次规则、当前位置、去向和质量要求。点击物料查看完整信息。</p></div>
				<span class="section-count">{{ stage.materials.length }} 种物料</span>
			</div>
			<div class="material-flow">
				<button v-for="(item, index) in stage.materials" :key="item.code" type="button" class="material-card" @click="showMaterial(item, index)">
					<div class="material-head"><span>{{ item.type }}</span><i :style="{ '--delay': (index * -.6) + 's' }"></i></div>
					<strong>{{ item.name }}</strong><small>{{ item.code }}</small>
					<dl><div><dt>当前状态</dt><dd>{{ materialStatus(item, index) }}</dd></div><div><dt>规格</dt><dd>{{ item.specification }}</dd></div><div><dt>流向</dt><dd>{{ item.input }} → {{ item.output }}</dd></div></dl>
					<b>查看物料档案 →</b>
				</button>
			</div>
		</section>

		<section class="detail-grid">
			<section class="data-panel">
				<div class="section-heading compact"><div><span class="section-number">05</span><h2>工位实时数据</h2><p>有设备报文时显示实时值，没有报文时明确等待上报。</p></div></div>
				<div class="metric-cards"><div v-for="metric in stage.metrics" :key="metric.label"><span>{{ metric.label }}</span><strong>{{ metricDisplay(metric) }}</strong><small>{{ metricSource(metric) }}</small></div></div>
				<div v-if="stageReadings.length" class="reading-list"><div v-for="reading in stageReadings" :key="reading.readingId"><span>{{ reading.deviceCode }} / {{ sensorLabel(reading.sensorType) }}</span><b>{{ reading.value }} {{ reading.unit }}</b><small>{{ reading.mode }}</small></div></div>
				<div v-else class="empty-state">当前没有与本工位匹配的传感器报文。</div>
			</section>
			<section class="alarm-panel">
				<div class="section-heading compact"><div><span class="section-number">06</span><h2>工位异常与上下游影响</h2><p>展示隔离、剔除、返工或停工策略，操作统一在管理端完成。</p></div></div>
				<div v-if="!stageAlarms.length && !stageIncidents.length" class="safe-state"><i></i><div><b>工位状态正常</b><span>当前满足连续生产条件</span></div></div>
				<div v-for="alarm in stageAlarms" :key="alarm.alarmId" class="alarm-row"><div><b>{{ alarmTypeLabel(alarm.alarmType) }}</b><span>{{ alarm.message }}</span></div><strong>{{ alarm.value }}</strong></div>
				<div v-for="incident in stageIncidents" :key="incident.incidentId" class="incident-row"><div><b>{{ strategyLabel(incident.strategy) }}</b><span>{{ incident.message }}</span></div><strong>{{ incident.targetStage }}</strong><small>{{ stageRuntimeState.upstreamImpact }}；{{ stageRuntimeState.downstreamImpact }}</small></div>
			</section>
		</section>

		<section class="records-block">
			<div class="section-heading compact"><div><span class="section-number">07</span><h2>最近处理批次</h2><p>记录来自批次事件链，点击可查看完整生产记录。</p></div></div>
			<div v-if="!stageRuns.length" class="empty-state">当前还没有批次经过该工位。</div>
			<button v-for="run in stageRuns.slice(0, 8)" :key="run.traceCode" type="button" class="record-row" @click="showRun(run)"><span>{{ run.traceCode }}</span><b>{{ run.bottleType }}</b><span>{{ statusLabel(run.status) }}</span><span>{{ eventResult(run) }}</span><strong>完整追踪 →</strong></button>
		</section>

		<section v-if="stage.code === 'AGV_TRANSPORT'" class="records-block">
			<div class="section-heading compact"><div><span class="section-number">06</span><h2>AGV 实时任务</h2><p>速度、里程、负载和超声波距离来自调度报文。</p></div></div>
			<div v-for="task in logistics.tasks.slice(0, 8)" :key="task.taskId" class="task-row"><span>{{ task.agvCode }} / {{ task.boxCode }}</span><b>{{ task.status }}</b><span>速度 {{ task.speedMps }} m/s</span><span>里程 {{ task.completedDistanceM }}/{{ task.totalDistanceM }} m</span><strong :class="task.obstacleDistanceCm < 20 ? 'danger-text' : ''">障碍 {{ task.obstacleDistanceCm }} cm</strong></div>
		</section>

		<section v-if="stage.code === 'WAREHOUSE_INBOUND'" class="records-block">
			<div class="section-heading compact"><div><span class="section-number">06</span><h2>仓储实时情况</h2><p>仓区安全、库位和箱级库存。</p></div></div>
			<div v-for="zone in logistics.zones" :key="zone.zoneCode" class="task-row"><span>仓区 {{ zone.zoneCode }}</span><b :class="zone.status === 'SAFE' ? 'success-text' : 'danger-text'">{{ zone.status }}</b><span>VOC {{ zone.vocPpm }} ppm</span><span>烟雾 {{ zone.smoke }}%</span><strong>温度 {{ zone.temperatureC }} °C</strong></div>
			<div v-for="stock in logistics.stock.slice(0, 8)" :key="stock.boxCode" class="task-row"><span>{{ stock.boxCode }}</span><b>{{ stock.bottleType }}</b><span>{{ stock.zoneCode }}</span><span>{{ stock.locationCode }}</span><strong>{{ stock.status }}</strong></div>
		</section>

		<el-dialog title="设备档案" :visible.sync="deviceDialogVisible" width="680px" custom-class="industrial-dialog">
			<div v-if="selectedDevice" class="asset-dialog">
				<div class="asset-title"><div><small>{{ selectedDevice.type }}</small><h3>{{ selectedDevice.name }}</h3><span>{{ selectedDevice.code }}</span></div><b :class="selectedDeviceStatusClass"><i></i>{{ selectedDeviceStatus }}</b></div>
				<div class="asset-grid"><div><small>设备作用</small><strong>{{ selectedDevice.role }}</strong></div><div><small>当前数据来源</small><strong>{{ selectedDeviceRuntime ? selectedDeviceRuntime.source + (selectedDeviceRuntime.fallback ? ' / 自动兜底' : '') : sourceLabel(selectedDevice.source) }}</strong></div><div><small>输入</small><strong>{{ selectedDevice.input }}</strong></div><div><small>输出</small><strong>{{ selectedDevice.output }}</strong></div></div>
				<h4>当前工艺参数</h4><div class="parameter-list"><div v-for="(value, key) in selectedDevice.parameters" :key="key"><span>{{ key }}</span><b>{{ value }}</b></div></div>
				<div v-if="selectedDeviceReading" class="device-reading"><span>关联实时读数</span><strong>{{ selectedDeviceReading.value }} {{ selectedDeviceReading.unit }}</strong><small>{{ selectedDeviceReading.mode }}</small></div>
				<div v-else class="dialog-note">当前设备没有对应的实时传感器报文，以上参数为演示工艺配置。</div>
			</div>
		</el-dialog>

		<el-dialog title="物料档案" :visible.sync="materialDialogVisible" width="680px" custom-class="industrial-dialog">
			<div v-if="selectedMaterial" class="asset-dialog">
				<div class="asset-title"><div><small>{{ selectedMaterial.type }}</small><h3>{{ selectedMaterial.name }}</h3><span>{{ selectedMaterial.code }}</span></div><b class="running"><i></i>{{ selectedMaterialStatus }}</b></div>
				<div class="asset-grid"><div><small>规格</small><strong>{{ selectedMaterial.specification }}</strong></div><div><small>批次规则</small><strong>{{ selectedMaterial.batchRule }}</strong></div><div><small>来源</small><strong>{{ selectedMaterial.input }}</strong></div><div><small>去向</small><strong>{{ selectedMaterial.output }}</strong></div></div>
				<h4>质量要求</h4><div class="quality-rule">{{ selectedMaterial.quality }}</div>
				<div class="material-runtime"><div><small>当前状态</small><b>{{ selectedMaterialStatus }}</b></div><div><small>关联生产批次</small><b>{{ latestTraceCode }}</b></div></div>
			</div>
		</el-dialog>

		<el-dialog title="产品追踪档案" :visible.sync="productDialogVisible" width="760px" custom-class="industrial-dialog">
			<div v-if="selectedProduct" class="product-dialog">
				<div class="asset-title"><div><small>{{ selectedProduct.productType === 'box' ? '成品箱' : '单件产品' }}</small><h3>{{ selectedProduct.traceCode }}</h3><span>{{ selectedProduct.batchCode || '未关联生产批次' }}</span></div><b :class="selectedProduct.visualStatus"><i></i>{{ selectedProduct.statusLabel }}</b></div>
				<div class="asset-grid product-summary"><div><small>瓶型</small><strong>{{ selectedProduct.bottleType || '等待识别' }}</strong></div><div><small>当前位置</small><strong>{{ stageLabel(selectedProduct.currentStage) }}</strong></div><div><small>箱码</small><strong>{{ selectedProduct.boxCode || '--' }}</strong></div><div><small>仓储位置</small><strong>{{ selectedProduct.warehouseLocation || '--' }}</strong></div><div><small>开始时间</small><strong>{{ formatTime(selectedProduct.startedAt) }}</strong></div><div><small>更新时间</small><strong>{{ formatTime(selectedProduct.updatedAt) }}</strong></div></div>
				<h4>产品检测结果</h4><div class="product-observations"><div v-if="selectedProduct.voc != null"><span>VOC</span><b>{{ selectedProduct.voc }} ppm</b></div><div v-if="selectedProduct.beverageTemperature != null"><span>饮料温度</span><b>{{ selectedProduct.beverageTemperature }} °C</b></div><div v-if="selectedProduct.beverageHumidity != null"><span>环境湿度</span><b>{{ selectedProduct.beverageHumidity }} %RH</b></div><div v-if="selectedProduct.defectType"><span>缺陷类型</span><b class="danger-text">{{ selectedProduct.defectType }}</b></div><div v-if="selectedProduct.stageEvent"><span>本工位结论</span><b>{{ selectedProduct.stageEvent.message }}</b></div><div v-if="selectedProduct.aiAudits.length"><span>AI 校验</span><b>{{ selectedProduct.aiAudits[0].validationStatus }} / {{ selectedProduct.aiAudits[0].decision }}</b></div><div v-if="!hasProductObservations(selectedProduct)" class="empty-observation">尚未写入产品级检测结果</div></div>
				<h4>本产品关联传感器数据</h4>
				<div v-if="selectedProduct.sensorReadings.length" class="product-readings"><div v-for="reading in selectedProduct.sensorReadings" :key="reading.readingId"><span>{{ reading.deviceCode }} / {{ sensorLabel(reading.sensorType) }}</span><b>{{ reading.value }} {{ reading.unit }}</b><small>{{ reading.quality }} · {{ reading.mode }} · {{ formatTime(reading.occurredAt) }}</small></div></div>
				<div v-else class="dialog-note">当前没有携带该产品追踪码的传感器报文。未带 traceCode 的工位公共读数不会写入本产品档案。</div>
				<div v-if="selectedProduct.linkedAlarms.length" class="product-linked-alarms"><b>关联报警记录 {{ selectedProduct.linkedAlarms.length }} 项</b><div v-for="alarm in selectedProduct.linkedAlarms" :key="alarm.alarmId"><span>{{ alarmTypeLabel(alarm.alarmType) }} / {{ alarm.deviceCode }}</span><strong>{{ alarm.value }} / 阈值 {{ alarm.limitValue }}</strong><small>{{ alarm.status }} · {{ alarm.message }} · {{ formatTime(alarm.occurredAt) }}</small></div></div>
				<h4>生产事件</h4><div v-if="selectedProduct.events && selectedProduct.events.length" class="product-events"><div v-for="event in selectedProduct.events" :key="event.eventId"><span>{{ stageLabel(event.stage) }}</span><b :class="event.status">{{ event.status === 'PASSED' ? '通过' : '异常' }}</b><small>{{ event.message }} · {{ formatTime(event.occurredAt) }}</small></div></div><div v-else class="dialog-note">该追踪码来自传感器报文，尚未关联生产事件。</div>
			</div>
		</el-dialog>

		<el-dialog title="批次完整追踪" :visible.sync="runDialogVisible" width="680px" custom-class="industrial-dialog">
			<div v-if="selectedRun" class="run-dialog"><div class="run-summary"><div><small>追踪编号</small><b>{{ selectedRun.traceCode }}</b></div><div><small>瓶型</small><b>{{ selectedRun.bottleType }}</b></div><div><small>状态</small><b>{{ statusLabel(selectedRun.status) }}</b></div></div><div v-for="event in selectedRun.events" :key="event.eventId" class="event-row"><span>{{ stageLabel(event.stage) }}</span><b :class="event.status">{{ event.status === 'PASSED' ? '通过' : '失败' }}</b><span>{{ event.message }}</span></div></div>
		</el-dialog>
	</div>
</template>

<script>
import { ServiceGet } from '@/api/Service.js'
import { closeFactoryRealtime, connectFactoryRealtime } from '@/api/FactoryRealtime.js'
import { FACTORY_STAGES, findFactoryStage } from '@/config/factoryStages.js'
import { buildFactoryRuntime, runtimeDeviceActivityAt } from '@/config/factoryRuntime.js'
import StagePlanView from '@/components/factory/StagePlanView.vue'
import StageThreeView from '@/components/factory/StageThreeView.vue'

export default {
	components: { StagePlanView, StageThreeView },
	data() {
		return {
			stages: FACTORY_STAGES, viewMode: 'plan', stateColorsEnabled: true, visualPaused: false, visualRevision: 0, timer: null, runtimeTimer: null, runtimeNowMs: Date.now(), online: false, realtimeOnline: false,
			frozenProducts: [], frozenAlarmCount: 0, frozenLineRunning: false, frozenRuntime: null, frozenDeviceStates: [],
			runDialogVisible: false, deviceDialogVisible: false, materialDialogVisible: false, productDialogVisible: false,
			selectedRun: null, selectedDevice: null, selectedDeviceIndex: -1, selectedMaterial: null, selectedMaterialIndex: -1, selectedProduct: null,
			dashboard: { total: 0, running: 0, completed: 0, rejected: 0, holding: 0, runs: [] },
			operations: { latestReadings: [], alarms: [], commands: [], aiAudits: [] },
			logistics: { tasks: [], zones: [], stock: [] },
			runtimeSnapshot: { devices: [], stages: [], incidents: [] }
		}
	},
	computed: {
		stage() { return findFactoryStage(this.$route.params.stageCode) },
		stageIndex() { return this.stages.findIndex(item => item.code === this.stage.code) },
		previousStage() { return this.stageIndex > 0 ? this.stages[this.stageIndex - 1] : null },
		nextStage() { return this.stageIndex < this.stages.length - 1 ? this.stages[this.stageIndex + 1] : null },
		lineRunning() { return this.dashboard.total > 0 },
		stageReadings() { return this.operations.latestReadings.filter(reading => this.readingBelongsToStage(reading)).slice(0, 8) },
		stageAlarms() { return this.operations.alarms.filter(alarm => alarm.status === 'OPEN' && this.alarmBelongsToStage(alarm)) },
		stageRuns() { return this.dashboard.runs.filter(run => run.events && run.events.some(event => event.stage === this.stage.code)) },
		stageProducts() {
			const byCode = new Map()
			this.stageRuns.forEach(run => byCode.set(run.traceCode, run))
			this.stageReadings.filter(reading => reading.traceCode).forEach(reading => { if (!byCode.has(reading.traceCode)) byCode.set(reading.traceCode, { traceCode: reading.traceCode, bottleType: null, batchCode: null, currentStage: reading.stage || this.stage.code, status: reading.quality === 'GOOD' ? 'RUNNING' : 'HOLD', startedAt: reading.occurredAt, updatedAt: reading.occurredAt, events: [] }) })
			return Array.from(byCode.values()).map(run => {
				const sensorReadings = this.operations.latestReadings.filter(reading => reading.traceCode === run.traceCode && this.readingBelongsToStage(reading))
				const aiAudits = this.operations.aiAudits.filter(item => item.traceCode === run.traceCode)
				const linkedAlarms = this.operations.alarms.filter(item => item.traceCode === run.traceCode)
				const openProductAlarms = linkedAlarms.filter(item => item.status === 'OPEN')
				const stageEvent = (run.events || []).find(event => event.stage === this.stage.code)
				const visualStatus = this.productVisualStatus(run, stageEvent, sensorReadings, openProductAlarms)
				return { ...run, sensorReadings, stageEvent, aiAudits, linkedAlarms, visualStatus, statusLabel: this.productStatusLabel(visualStatus), productType: ['PACKING', 'AGV_TRANSPORT', 'WAREHOUSE_INBOUND'].includes(this.stage.code) ? 'box' : this.stage.code === 'BEVERAGE_READY' ? 'liquid' : 'bottle' }
			}).sort((a, b) => this.productPriority(a) - this.productPriority(b) || String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))).slice(0, 6)
		},
		visualProducts() { return this.visualPaused ? this.frozenProducts : this.stageProducts },
		visualProductKey() { return this.visualProducts.map(item => item.traceCode + ':' + item.visualStatus).join('|') },
		visualAlarmCount() { return this.visualPaused ? this.frozenAlarmCount : this.stageAlarms.length },
		visualLineRunning() { return this.visualPaused ? this.frozenLineRunning : this.lineRunning },
		liveRuntime() { return buildFactoryRuntime({ stage: this.stage, operations: this.operations, logistics: this.logistics, runtimeSnapshot: this.runtimeSnapshot, running: this.lineRunning }) },
		visualRuntime() { return this.visualPaused && this.frozenRuntime ? this.frozenRuntime : this.liveRuntime },
		visualNowMs() { return this.visualPaused && this.frozenRuntime ? this.frozenRuntime.frozenAtMs : this.runtimeNowMs },
		liveDeviceStates() { return this.stage.devices.map((device, index) => this.deviceRuntimeState(device, index)) },
		visualDeviceStates() { return this.visualPaused ? this.frozenDeviceStates : this.liveDeviceStates },
		visualDeviceActivity() { return this.stage.devices.map((device, index) => { const telemetry = this.runtimeSnapshot.devices.find(item => item.deviceCode === device.code); if (telemetry && telemetry.source === 'MQTT' && telemetry.metrics && telemetry.metrics.activity != null) return Number(telemetry.metrics.activity); return runtimeDeviceActivityAt(this.visualRuntime, this.visualNowMs, index, this.stage.devices.length, this.visualProducts) }) },
		stageRuntimeState() { return this.runtimeSnapshot.stages.find(item => item.stageCode === this.stage.code) || { state: 'RUNNING', upstreamImpact: '无', downstreamImpact: '无', bufferLevel: 0, bufferCapacity: 0 } },
		stageIncidents() { return this.runtimeSnapshot.incidents.filter(item => item.stageCode === this.stage.code && item.status === 'OPEN') },
		processedCount() { return this.stageRuns.length },
		stageStatus() { return this.stageAlarms.length ? '异常待处理' : this.lineRunning ? '持续运行' : '等待首批' },
		stageStatusClass() { return this.stageAlarms.length ? 'alarm' : this.lineRunning ? 'running' : 'standby' },
		onlineDeviceCount() { return this.online ? this.stage.devices.length : 0 },
		currentAction() { return this.lineRunning ? this.stage.devices.map(item => item.role).join('；') : '设备等待首批物料' },
		materialRoute() { const main = this.stage.materials[0]; return main ? main.input + ' → ' + main.output : '等待物料' },
		selectedDeviceStatus() { return this.selectedDevice ? this.equipmentStatus(this.selectedDeviceIndex) : '' },
		selectedDeviceStatusClass() { return this.selectedDevice ? this.equipmentStatusClass(this.selectedDeviceIndex) : '' },
		selectedDeviceReading() { return this.selectedDevice ? this.readingForDevice(this.selectedDevice) : null },
		selectedDeviceRuntime() { return this.selectedDevice ? this.runtimeSnapshot.devices.find(item => item.deviceCode === this.selectedDevice.code) || null : null },
		selectedMaterialStatus() { return this.selectedMaterial ? this.materialStatus(this.selectedMaterial, this.selectedMaterialIndex) : '' },
		latestTraceCode() { return this.stageRuns.length ? this.stageRuns[0].traceCode : '等待批次进入' },
		bufferPercent() { const capacity = Number(this.stageRuntimeState.bufferCapacity || 0); return capacity ? Math.min(100, Number(this.stageRuntimeState.bufferLevel || 0) / capacity * 100) : 0 },
		currentWipCount() { return this.dashboard.runs.filter(run => run.currentStage === this.stage.code && ['RUNNING', 'HOLD'].includes(run.status)).length },
		stageRuntimeDevices() { return this.runtimeSnapshot.devices.filter(item => item.stageCode === this.stage.code) },
		mqttDeviceCount() { return this.stageRuntimeDevices.filter(item => item.source === 'MQTT' && !item.fallback).length },
		simulationDeviceCount() { return this.stageRuntimeDevices.filter(item => item.source === 'SIMULATION' || item.fallback).length },
		dataTime() { return this.formatTime(this.runtimeSnapshot.generatedAt || this.stageRuntimeDevices[0] && this.stageRuntimeDevices[0].occurredAt) },
		deviceRows() {
			return this.stage.devices.map((device, index) => {
				const runtime = this.stageRuntimeDevices.find(item => item.deviceCode === device.code)
				const state = this.liveDeviceStates[index]
				const reading = this.readingForDevice(device)
				return {
					device,
					state,
					status: this.equipmentStatus(index),
					source: runtime ? runtime.source : 'SIMULATION',
					fallback: runtime ? runtime.fallback : true,
					action: state === 'alarm' ? '等待异常处置' : state === 'standby' ? '等待物料或联锁放行' : device.role,
					reading: reading ? reading.value + ' ' + reading.unit : '查看参数'
				}
			})
		},
		latestStageEvent() {
			const events = this.stageRuns.reduce((result, run) => result.concat((run.events || []).filter(event => event.stage === this.stage.code).map(event => ({ ...event, run }))), [])
			return events.sort((a, b) => new Date(b.occurredAt || 0).getTime() - new Date(a.occurredAt || 0).getTime())[0] || null
		},
		qualityGates() { return this.buildQualityGates() },
		qualityGateSummary() {
			const failed = this.qualityGates.filter(item => item.status === 'FAIL').length
			const waiting = this.qualityGates.filter(item => item.status === 'WAIT').length
			if (failed) return { label: '禁止自动放行', className: 'failed', count: failed + ' 项不合格' }
			if (waiting) return { label: '等待判定数据', className: 'waiting', count: waiting + ' 项待确认' }
			return { label: '满足放行条件', className: 'passed', count: this.qualityGates.length + ' 项通过' }
		}
	},
	mounted() {
		try { const savedMode = window.localStorage.getItem('hdc_factory_visual_mode'); if (['off', 'plan', 'three'].includes(savedMode)) this.viewMode = savedMode; const savedColors = window.localStorage.getItem('hdc_factory_state_colors'); if (savedColors !== null) this.stateColorsEnabled = savedColors === 'true' } catch (error) {}
		this.load(); this.timer = window.setInterval(this.load, 2000); this.runtimeTimer = window.setInterval(() => { this.runtimeNowMs = Date.now() }, 200); connectFactoryRealtime(this.load, online => { this.realtimeOnline = online })
	},
	beforeDestroy() { window.clearInterval(this.timer); window.clearInterval(this.runtimeTimer); closeFactoryRealtime() },
	methods: {
		setViewMode(mode) { this.viewMode = mode; if (mode === 'off') this.clearVisualPause(); try { window.localStorage.setItem('hdc_factory_visual_mode', mode) } catch (error) {} },
		saveStateColorPreference(value) { try { window.localStorage.setItem('hdc_factory_state_colors', String(value)) } catch (error) {} },
		async toggleVisualPause() { if (!this.visualPaused) { const frozenAtMs = Date.now(); this.frozenProducts = JSON.parse(JSON.stringify(this.stageProducts)); this.frozenAlarmCount = this.stageAlarms.length; this.frozenLineRunning = this.lineRunning; this.frozenRuntime = { ...this.liveRuntime, frozenAtMs }; this.frozenDeviceStates = this.liveDeviceStates.slice(); const view = this.$refs.visualView; if (view && view.pauseVisual) await view.pauseVisual(frozenAtMs); this.visualPaused = true; return } await this.load(); this.visualPaused = false; this.frozenProducts = []; this.frozenRuntime = null; this.frozenDeviceStates = []; this.visualRevision += 1 },
		clearVisualPause() { this.visualPaused = false; this.frozenProducts = []; this.frozenAlarmCount = 0; this.frozenLineRunning = false; this.frozenRuntime = null; this.frozenDeviceStates = [] },
		async load() {
			try {
				const responses = await Promise.all([ServiceGet.get('/hdc/api/factory/dashboard'), ServiceGet.get('/hdc/api/operations/overview'), ServiceGet.get('/hdc/api/logistics/overview'), ServiceGet.get('/hdc/api/factory/runtime?stageCode=' + this.stage.code).catch(() => null)])
				this.dashboard = responses[0] || this.dashboard; this.operations = responses[1] || this.operations; this.logistics = responses[2] || this.logistics; this.runtimeSnapshot = responses[3] || this.runtimeSnapshot; this.online = true
			} catch (error) { this.online = false }
		},
		goOverview() { this.$router.push('/factoryOverview') },
		goStage(stage) { if (stage) { this.clearVisualPause(); this.visualRevision += 1; this.$router.push('/factoryStage/' + stage.code) } },
		showRun(run) { this.selectedRun = run; this.runDialogVisible = true },
		showDevice(device, index) { this.selectedDevice = device; this.selectedDeviceIndex = index; this.deviceDialogVisible = true },
		showMaterial(material, index) { this.selectedMaterial = material; this.selectedMaterialIndex = index; this.materialDialogVisible = true },
		showProduct(product) { this.selectedProduct = product; this.productDialogVisible = true },
		readingBelongsToStage(reading) { if (reading.stage === this.stage.code) return true; if (this.stage.code === 'AGV_TRANSPORT') return reading.sensorType === 'AGV_DISTANCE'; if (this.stage.code === 'WAREHOUSE_INBOUND') return reading.deviceCode.indexOf('WAREHOUSE') === 0; if (this.stage.code === 'BEVERAGE_READY') return ['TEMPERATURE', 'HUMIDITY'].includes(reading.sensorType); return false },
		alarmBelongsToStage(alarm) { if (this.stage.code === 'GAS_INSPECTION') return alarm.alarmType === 'VOC_LIMIT' && alarm.deviceCode.indexOf('WAREHOUSE') !== 0; if (this.stage.code === 'AGV_TRANSPORT') return alarm.alarmType === 'AGV_DISTANCE_LIMIT'; if (this.stage.code === 'WAREHOUSE_INBOUND') return alarm.deviceCode.indexOf('WAREHOUSE') === 0 || alarm.alarmType === 'SMOKE_LIMIT'; return false },
		metricDisplay(metric) { if (!metric.sensorType) return (metric.value || '') + (metric.unit ? ' ' + metric.unit : ''); const reading = this.stageReadings.find(item => item.sensorType === metric.sensorType); return reading ? reading.value + ' ' + (reading.unit || metric.unit || '') : '等待设备上报' },
		metricSource(metric) { return metric.sensorType ? '实时传感器数据' : '当前工艺配置' },
		equipmentStatus(index) { return { standby: this.online ? '待机' : '离线', alarm: '报警', running: '运行中' }[this.liveDeviceStates[index]] || '状态未知' },
		equipmentStatusClass(index) { return { standby: 'offline', alarm: 'alarm', running: 'running' }[this.liveDeviceStates[index]] || 'offline' },
		deviceRuntimeState(device, index) {
			const runtimeDevice = this.runtimeSnapshot.devices.find(item => item.deviceCode === device.code)
			if (runtimeDevice && ['STOPPED', 'BLOCKED', 'STANDBY', 'OFFLINE'].includes(runtimeDevice.state)) return 'standby'
			if (runtimeDevice && runtimeDevice.state === 'ALARM') return 'alarm'
			if (!this.online || !this.liveRuntime.running) return 'standby'
			const alarm = this.stageAlarms.find(item => item.deviceCode === device.code || (item.alarmType === 'SMOKE_LIMIT' && device.code === 'WH-SMOKE-01') || (item.alarmType === 'VOC_LIMIT' && device.code.indexOf('VOC') !== -1) || (item.alarmType === 'AGV_DISTANCE_LIMIT' && index === 0))
			return alarm ? 'alarm' : 'running'
		},
		materialStatus(item, index) { if (!this.lineRunning) return '等待上线'; return index === 0 ? item.state : '状态正常' },
		productVisualStatus(run, event, readings, alarms) { if (run.status === 'REJECTED') return 'rejected'; if (run.status === 'HOLD' || alarms.length || readings.some(item => item.quality && item.quality !== 'GOOD')) return 'hold'; if (event && event.status === 'FAILED') return 'rejected'; if (run.status === 'RUNNING' && run.currentStage === this.stage.code) return 'running'; if ((event && event.status === 'PASSED') || run.status === 'COMPLETED') return 'passed'; return 'running' },
		productStatusLabel(value) { return { running: '运行中', hold: '待处理', rejected: '异常/剔除', passed: '本工位已通过' }[value] || '状态未知' },
		productPriority(product) { if (product.currentStage === this.stage.code && ['running', 'hold', 'rejected'].includes(product.visualStatus)) return 0; if (product.sensorReadings && product.sensorReadings.length) return 1; return 2 },
		hasProductObservations(product) { return product.voc != null || product.beverageTemperature != null || product.beverageHumidity != null || !!product.defectType || !!product.stageEvent || (product.aiAudits && product.aiAudits.length) },
		readingForDevice(device) { const map = { 'GAS-VERIFY-01': 'VOC', 'BEV-TEMP-01': 'TEMPERATURE', 'BEV-HUM-01': 'HUMIDITY', 'AGV-US-01': 'AGV_DISTANCE', 'WH-VOC-01': 'VOC', 'WH-SMOKE-01': 'SMOKE' }; const sensorType = map[device.code]; if (!sensorType) return null; return this.stageReadings.find(item => item.sensorType === sensorType) || null },
		latestReading(sensorType) { return this.stageReadings.find(item => item.sensorType === sensorType) || null },
		gate(label, standard, actual, status, source) { return { label, standard, actual, status, source } },
		buildQualityGates() {
			const event = this.latestStageEvent
			const eventGate = (label, standard) => this.gate(label, standard, event ? event.message : '等待产品判定', event ? (event.status === 'PASSED' ? 'PASS' : 'FAIL') : 'WAIT', event ? '产品工序事件' : '尚无工序事件')
			const runningGate = this.gate('设备联锁', '工位状态 RUNNING 且无阻断异常', this.stageRuntimeState.state || '等待运行态', this.stageRuntimeState.state === 'RUNNING' && !this.stageIncidents.length && !this.stageAlarms.length ? 'PASS' : this.stageIncidents.length || this.stageAlarms.length ? 'FAIL' : 'WAIT', '持久化工位运行态与报警')
			if (this.stage.code === 'PRETREATMENT') return [eventGate('清洗与风洗流程', '冷却静置、水洗和风洗工序记录完整'), runningGate]
			if (this.stage.code === 'GAS_INSPECTION') {
				const reading = this.latestReading('VOC')
				return [this.gate('VOC 安全浓度', '<= 10 ppm 且无开放报警', reading ? reading.value + ' ' + reading.unit : '等待传感器上报', reading ? (Number(reading.value) <= 10 && reading.quality !== 'BAD' && !this.stageAlarms.length ? 'PASS' : 'FAIL') : 'WAIT', reading ? reading.mode + ' · ' + this.formatTime(reading.occurredAt) : 'VOC 传感器'), runningGate]
			}
			if (this.stage.code === 'APPEARANCE_INSPECTION') return [eventGate('瓶盖、瓶身、瓶底外观', '视觉模型判定 PASSED；缺陷品进入剔除通道'), this.gate('剔除机构联锁', '不合格品不得进入下游', this.stageAlarms.length ? '存在开放报警' : '剔除通道可用', this.stageAlarms.length ? 'FAIL' : 'PASS', '设备与报警运行态')]
			if (this.stage.code === 'BEVERAGE_READY') {
				const temperature = this.latestReading('TEMPERATURE')
				const humidity = this.latestReading('HUMIDITY')
				return [this.gate('饮料温度', '20-30 °C', temperature ? temperature.value + ' ' + temperature.unit : '等待传感器上报', temperature ? (Number(temperature.value) >= 20 && Number(temperature.value) <= 30 ? 'PASS' : 'FAIL') : 'WAIT', temperature ? temperature.mode : '温度传感器'), this.gate('环境湿度记录', '持续记录，当前不作为自动拒绝阈值', humidity ? humidity.value + ' ' + humidity.unit : '等待传感器上报', humidity ? 'PASS' : 'WAIT', humidity ? humidity.mode : '湿度传感器'), eventGate('混合与杀菌流程', '生产与高温处理记录完整')]
			}
			if (this.stage.code === 'FILLING') {
				const command = this.operations.commands.find(item => item.commandType === 'SET_RECIPE')
				return [eventGate('灌装完成判定', '灌装工序事件 PASSED'), this.gate('配方参数校验', '本地配方校验后下发成功', command ? command.status + ' · ' + (command.source || '--') : '等待配方指令', command ? (command.status === 'SUCCEEDED' ? 'PASS' : 'FAIL') : 'WAIT', 'AI 校验与设备命令'), runningGate]
			}
			if (this.stage.code === 'SECONDARY_INSPECTION') return [eventGate('瓶盖、液位与封装复检', '视觉判定 PASSED；失败产品自动剔除'), this.gate('下游装箱联锁', '仅合格产品允许进入装箱', this.stageAlarms.length ? '暂停放行' : '放行通道可用', this.stageAlarms.length ? 'FAIL' : 'PASS', '报警与设备运行态')]
			if (this.stage.code === 'PACKING') return [eventGate('箱内排列与计数', '12 瓶/箱，箱码与产品追踪绑定'), runningGate]
			if (this.stage.code === 'AGV_TRANSPORT') {
				const task = this.logistics.tasks.slice().sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))[0]
				return [this.gate('超声波避障距离', '>= 20 cm', task ? task.obstacleDistanceCm + ' cm' : '等待 AGV 报文', task ? (Number(task.obstacleDistanceCm) >= 20 ? 'PASS' : 'FAIL') : 'WAIT', task ? task.mode : 'AGV 超声波'), this.gate('车辆负载', '<= 30 kg', task ? task.loadKg + ' kg' : '等待负载报文', task ? (Number(task.loadKg) <= 30 ? 'PASS' : 'FAIL') : 'WAIT', task ? task.mode : 'AGV 负载检测')]
			}
			if (this.stage.code === 'WAREHOUSE_INBOUND') {
				const zone = this.logistics.zones.slice().sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))[0]
				return [this.gate('仓区 VOC', '<= 10 ppm', zone ? zone.vocPpm + ' ppm' : '等待仓区报文', zone ? (Number(zone.vocPpm) <= 10 ? 'PASS' : 'FAIL') : 'WAIT', '仓区安全传感器'), this.gate('仓区烟雾', '<= 0.5%', zone ? zone.smoke + '%' : '等待仓区报文', zone ? (Number(zone.smoke) <= .5 ? 'PASS' : 'FAIL') : 'WAIT', '仓区烟雾传感器'), this.gate('库位安全状态', 'SAFE', zone ? zone.status : '等待仓区状态', zone ? (zone.status === 'SAFE' ? 'PASS' : 'FAIL') : 'WAIT', '仓储管理系统')]
			}
			return [eventGate('工序放行判定', '产品工序事件 PASSED'), runningGate]
		},
		sourceLabel(source) { return source === 'REAL_OR_SIMULATION' ? '实机接入后显示实时数据；当前允许模拟' : 'SIMULATION 演示配置' },
		eventResult(run) { const event = run.events.find(item => item.stage === this.stage.code); return event ? (event.status === 'PASSED' ? '本工位通过' : '本工位异常') : '等待记录' },
		sensorLabel(value) { return { TEMPERATURE: '温度', HUMIDITY: '湿度', VOC: 'VOC', SMOKE: '烟雾', AGV_DISTANCE: 'AGV距离' }[value] || value },
		statusLabel(value) { return { RUNNING: '运行中', COMPLETED: '已入库', REJECTED: '已剔除', HOLD: '待处理' }[value] || value },
		formatTime(value) { if (!value) return '--'; return String(value).replace('T', ' ').slice(0, 19) },
		stageLabel(value) { if (value === 'COMPLETED') return '已完成入库'; const found = this.stages.find(item => item.code === value); return found ? found.name : value },
		alarmTypeLabel(value) { return { VOC_LIMIT: 'VOC超限', SMOKE_LIMIT: '烟雾超限', AGV_DISTANCE_LIMIT: 'AGV障碍物' }[value] || value },
		strategyLabel(value) { return { REJECT_PRODUCT: '剔除当前产品', STOP_STAGE: '仅停当前工位', RETURN_PREVIOUS: '返回上一工位', ROUTE_REWORK: '进入返工流程', BUFFER_AND_STOP: '进入缓冲并停工', STOP_LINE: '整线急停', MANUAL_HOLD: '人工确认' }[value] || value }
	}
}
</script>

<style scoped>
* { box-sizing: border-box; }
.stage-page { min-height: 100vh; padding: 28px 42px 46px; color: #e4e7e7; background-color: #101619; background-image: linear-gradient(rgba(255,255,255,.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.025) 1px, transparent 1px); background-size: 24px 24px; font-family: 'Microsoft YaHei', sans-serif; }
button { font-family: inherit; }
.stage-header { padding-bottom: 20px; border-bottom: 1px solid #485155; }
.stage-nav, .header-main, .stage-switcher, .section-heading { display: flex; justify-content: space-between; align-items: center; gap: 18px; }
.stage-nav button { padding: 7px 11px; color: #d1d7d8; border: 1px solid #657075; border-radius: 2px; background: #1b2225; cursor: pointer; }
.stage-nav span, .stage-switcher span { color: #8b969a; font-family: Consolas, monospace; font-size: 11px; }
.stage-nav span b { padding: 3px 6px; color: #171c1e; background: #e9aa24; font-size: 9px; letter-spacing: 0; }
.header-main { align-items: flex-end; margin-top: 21px; }
.station-code { display: inline-block; padding: 4px 7px; color: #111719; background: #e9aa24; font-family: Consolas, monospace; font-size: 10px; font-weight: bold; }
.header-main h1 { margin: 8px 0 5px; font-size: 34px; letter-spacing: 0; }
.header-main p { max-width: 780px; margin: 0; color: #9ca5a8; font-size: 12px; line-height: 1.65; }
.live-state { display: flex; align-items: center; gap: 11px; min-width: 178px; padding: 12px 15px; border: 1px solid #596367; border-left: 4px solid #7b8588; background: #1a2124; }
.live-state > i, .machine > b i, .asset-title > b i { width: 8px; height: 8px; border-radius: 50%; background: #7b8588; }
.live-state small, .live-state b { display: block; }.live-state small { margin-bottom: 4px; color: #8c9699; font-size: 10px; }
.live-state.running { border-left-color: #4da66b; }.live-state.running > i { background: #4fbd76; box-shadow: 0 0 0 4px rgba(79,189,118,.12); }
.live-state.alarm { border-left-color: #d9544d; }.live-state.alarm > i { background: #ef635b; }
.stage-switcher { margin-top: 18px; }.stage-switcher button { padding: 5px 8px; color: #c4cbcd; border: 0; background: transparent; cursor: pointer; }.stage-switcher button:disabled { color: #596164; cursor: default; }
.live-metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 0 0 12px; }
.live-metrics > div { min-height: 85px; padding: 13px 15px; border: 1px solid #3f484c; border-top: 3px solid #e9aa24; background: #1a2124; }
.live-metrics span, .live-metrics strong, .live-metrics small { display: block; }.live-metrics span, .live-metrics small { color: #879195; }.live-metrics span { font-size: 10px; }.live-metrics strong { margin: 6px 0 3px; font-size: 20px; }.live-metrics small { font-size: 9px; }
.success-text { color: #5bc47f !important; }.danger-text { color: #ef635b !important; }
.workcell, .material-section, .data-panel, .alarm-panel, .records-block { margin-top: 12px; padding: 18px; border: 1px solid #414a4e; border-radius: 2px; background: #171e21; }
.section-heading { align-items: flex-start; margin-bottom: 15px; }.section-heading > div { display: grid; grid-template-columns: 32px auto; column-gap: 9px; }.section-number { grid-row: 1 / span 2; display: grid; place-items: center; width: 32px; height: 32px; color: #161b1d; background: #e9aa24; font-family: Consolas, monospace; font-weight: bold; }.section-heading h2 { margin: 0 0 5px; font-size: 18px; }.section-heading p { grid-column: 2; margin: 0; color: #899397; font-size: 10px; }.mode-label, .section-count { padding: 5px 9px; color: #e9aa24; border: 1px solid #80631f; background: #211f17; font-size: 10px; }
.stage-details-heading { display: flex; justify-content: space-between; align-items: flex-end; gap: 20px; margin: 26px 0 12px; padding-bottom: 10px; border-bottom: 1px solid #485155; }
.stage-details-heading span { color: #e9aa24; font-family: Consolas, monospace; font-size: 10px; }
.stage-details-heading h2 { margin: 5px 0 0; font-size: 19px; }
.stage-details-heading p { margin: 0 0 2px; color: #899397; font-size: 10px; }
.visual-toolbar { display: flex !important; grid-template-columns: none !important; align-items: center; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }.status-color-control { display: inline-flex; align-items: center; gap: 8px; min-height: 34px; padding: 0 10px; color: #9da7aa; border: 1px solid #596367; background: #101619; font-size: 9px; }.pause-visual { display: inline-flex; align-items: center; gap: 6px; min-height: 34px; padding: 0 11px; color: #d2d7d8; border: 1px solid #596367; border-radius: 2px; background: #20272a; cursor: pointer; font-size: 10px; }.pause-visual:hover { color: #e9aa24; border-color: #e9aa24; }.pause-visual.active { color: #171c1e; border-color: #e9aa24; background: #e9aa24; font-weight: bold; }
.view-switch { display: inline-flex !important; grid-template-columns: none !important; flex: 0 0 auto; gap: 0; border: 1px solid #596367; background: #101619; }
.view-switch button { display: inline-flex; align-items: center; gap: 6px; min-height: 34px; padding: 0 12px; color: #9da7aa; border: 0; border-right: 1px solid #596367; background: transparent; cursor: pointer; font-size: 10px; }
.view-switch button:last-child { border-right: 0; }.view-switch button:hover { color: #f0b429; background: #242c2f; }.view-switch button.active { color: #171c1e; background: #e9aa24; font-weight: bold; }.view-switch button.off.active { color: #e2e6e7; background: #4b5559; }.view-switch i { font-size: 13px; }
.visualization-off { display: grid; place-items: center; align-content: center; min-height: 190px; border: 1px solid #414a4e; background: #111719; text-align: center; }.visualization-off > i { color: #768185; font-size: 28px; }.visualization-off b, .visualization-off span { display: block; }.visualization-off b { margin-top: 12px; color: #cbd1d2; font-size: 14px; }.visualization-off span { margin-top: 6px; color: #7f898d; font-size: 9px; }
.visual-runtime-bar { display: grid; grid-template-columns: 1.55fr repeat(4, minmax(110px, .75fr)); border: 1px solid #4a5357; border-top: 0; background: #20272a; }
.visual-runtime-bar > div { min-height: 54px; padding: 9px 12px; border-left: 1px solid #3c464a; }.visual-runtime-bar > div:first-child { border-left: 0; }
.visual-runtime-bar span, .visual-runtime-bar b { display: block; }.visual-runtime-bar span { color: #879195; font-size: 8px; }.visual-runtime-bar b { margin-top: 5px; overflow-wrap: anywhere; font-size: 10px; }
.machine-line { position: relative; min-height: 252px; padding: 48px 24px 38px; overflow: hidden; border: 1px solid #343d40; background: #111719; }
.machine-line::before { content: ''; position: absolute; left: 0; right: 0; bottom: 31px; height: 34px; background: repeating-linear-gradient(90deg, #252d30 0 20px, #151b1e 20px 26px); border-top: 2px solid #566064; border-bottom: 2px solid #566064; }
.rail { position: absolute; left: 0; right: 0; height: 2px; background: #5d676a; }.rail-top { bottom: 65px; }.rail-bottom { bottom: 30px; }
.moving-load { position: absolute; z-index: 2; left: -36px; bottom: 68px; width: 28px; height: 20px; border: 2px solid #f0b429; background: #5a4518; animation: materialMove 5s linear infinite; animation-delay: var(--delay); }
.moving-load::before { content: ''; position: absolute; left: 7px; top: -10px; width: 10px; height: 8px; border: 2px solid #f0b429; border-bottom: 0; }
.machine-line.stopped .moving-load, .machine-line.stopped .machine-motion i { animation-play-state: paused; }
.line-label { position: absolute; bottom: 8px; color: #7f898c; font-size: 9px; }.input-label { left: 12px; }.output-label { right: 12px; }
.device-track { position: relative; z-index: 3; display: grid; grid-template-columns: repeat(auto-fit, minmax(145px, 1fr)); gap: 9px; }
.machine { position: relative; min-height: 144px; padding: 11px; color: #dfe3e4; text-align: left; border: 1px solid #4a5559; border-top: 3px solid #5d686c; border-radius: 2px; background: #20282b; cursor: pointer; transition: border-color .16s ease, transform .16s ease; }
.machine:hover { border-color: #e9aa24; transform: translateY(-2px); }.machine.running { border-top-color: #4fa66d; }.machine.alarm { border-top-color: #d9544d; }
.machine-index { position: absolute; top: 8px; right: 9px; color: #6d777b; font-family: Consolas, monospace; font-size: 9px; }
.machine-motion { display: flex; align-items: flex-end; gap: 3px; width: 31px; height: 25px; margin-bottom: 9px; padding: 3px; border: 1px solid #566064; background: #111719; }
.machine-motion i { width: 5px; height: 6px; background: #e9aa24; animation: machineLevel 1.1s steps(3, end) infinite; }.machine-motion i:nth-child(2) { animation-delay: -.35s; }.machine-motion i:nth-child(3) { animation-delay: -.7s; }
.machine > strong, .machine > small, .machine > b, .machine > em { display: block; }.machine > strong { max-width: calc(100% - 24px); font-size: 12px; }.machine > small { margin-top: 4px; color: #7f898d; font-family: Consolas, monospace; font-size: 8px; }.machine > b { display: flex; align-items: center; gap: 6px; margin-top: 10px; color: #68bf84; font-size: 9px; }.machine > b i { width: 6px; height: 6px; background: #54b975; animation: statusPulse 1.4s ease-in-out infinite; }.machine.alarm > b { color: #ef635b; }.machine.alarm > b i { background: #ef635b; }.machine > em { position: absolute; right: 9px; bottom: 9px; color: #c5a451; font-size: 8px; font-style: normal; }
.work-description { display: grid; grid-template-columns: auto minmax(0, 1.6fr) 26px auto minmax(0, 1fr); gap: 10px; align-items: center; min-height: 42px; padding: 8px 12px; border: 1px solid #3b4447; border-top: 0; color: #8e989b; font-size: 9px; background: #20272a; }.work-description strong, .work-description b { color: #d1d6d7; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.work-description i { height: 1px; background: #776123; }
.material-flow { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 9px; }.material-card { min-height: 184px; padding: 13px; color: #dfe3e4; text-align: left; border: 1px solid #454f53; border-radius: 2px; background: #20272a; cursor: pointer; transition: border-color .16s ease, transform .16s ease; }.material-card:hover { border-color: #e9aa24; transform: translateY(-2px); }
.material-head { display: flex; justify-content: space-between; align-items: center; }.material-head span { padding: 3px 6px; color: #d7b55d; border: 1px solid #705b23; font-size: 8px; }.material-head i { width: 8px; height: 8px; border: 2px solid #4fa66d; transform: rotate(45deg); animation: materialSignal 1.6s ease-in-out infinite; animation-delay: var(--delay); }
.material-card > strong, .material-card > small, .material-card > b { display: block; }.material-card > strong { margin-top: 11px; font-size: 14px; }.material-card > small { margin-top: 4px; color: #798387; font-family: Consolas, monospace; font-size: 8px; }.material-card dl { margin: 11px 0; }.material-card dl > div { display: grid; grid-template-columns: 60px minmax(0, 1fr); gap: 7px; padding: 4px 0; border-top: 1px solid #333c3f; font-size: 9px; }.material-card dt { color: #7f898c; }.material-card dd { margin: 0; color: #c8cecf; overflow-wrap: anywhere; }.material-card > b { margin-top: auto; color: #d1ad4e; font-size: 9px; font-weight: normal; }
.detail-grid { display: grid; grid-template-columns: 1.4fr 1fr; gap: 12px; }.compact { margin-bottom: 13px; }.metric-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 7px; }.metric-cards > div { min-height: 90px; padding: 12px; border-left: 3px solid #e9aa24; background: #20272a; }.metric-cards span, .metric-cards strong, .metric-cards small { display: block; }.metric-cards span, .metric-cards small { color: #818b8e; }.metric-cards span { font-size: 9px; }.metric-cards strong { margin: 10px 0 5px; font-size: 15px; overflow-wrap: anywhere; }.metric-cards small { font-size: 8px; }
.reading-list { margin-top: 9px; }.reading-list > div { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 10px; align-items: center; min-height: 34px; border-top: 1px solid #343d40; font-size: 9px; }.reading-list small { color: #808a8d; }.empty-state { padding: 18px 2px; color: #808a8d; font-size: 10px; }.safe-state { display: flex; align-items: center; gap: 11px; min-height: 88px; padding: 13px; border-left: 3px solid #4fa66d; background: #20272a; }.safe-state > i { width: 9px; height: 9px; border-radius: 50%; background: #54b975; }.safe-state b, .safe-state span { display: block; }.safe-state span { margin-top: 4px; color: #869093; font-size: 9px; }.alarm-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-top: 1px solid #5a3432; }.alarm-row b, .alarm-row span { display: block; }.alarm-row b, .alarm-row strong { color: #ef635b; }.alarm-row span { margin-top: 3px; color: #a87d7a; font-size: 9px; }
.incident-row { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 5px 12px; padding: 10px 0; border-top: 1px solid #6b5424; }.incident-row b { color: #e9aa24; }.incident-row span { display: block; margin-top: 3px; color: #b5a273; font-size: 9px; }.incident-row strong { color: #e7c66e; font: 9px Consolas,monospace; }.incident-row small { grid-column: 1 / -1; color: #899397; font-size: 8px; }
.record-row, .task-row { display: grid; grid-template-columns: 1.5fr .7fr .7fr 1fr 1fr; gap: 12px; align-items: center; width: 100%; min-height: 40px; padding: 0 9px; color: #bec5c7; text-align: left; border: 0; border-top: 1px solid #343d40; background: transparent; font-size: 10px; }.record-row { cursor: pointer; }.record-row:hover { background: #20272a; }.record-row strong, .task-row strong { color: #d5b45d; text-align: right; }
.asset-dialog { color: #22292c; }.asset-title { display: flex; justify-content: space-between; align-items: center; gap: 20px; padding-bottom: 13px; border-bottom: 2px solid #2f373a; }.asset-title small, .asset-title span { display: block; color: #687277; }.asset-title h3 { margin: 4px 0; font-size: 21px; }.asset-title span { font-family: Consolas, monospace; }.asset-title > b { display: flex; align-items: center; gap: 6px; padding: 5px 8px; color: #277943; border: 1px solid #4b9a63; font-size: 10px; }.asset-title > b i { background: #3ba75d; }.asset-title > b.alarm { color: #b63d37; border-color: #c4635e; }.asset-title > b.alarm i { background: #d9544d; }.asset-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; margin-top: 14px; background: #cbd0d1; }.asset-grid > div { min-height: 78px; padding: 11px; background: #f2f3f3; }.asset-grid small, .asset-grid strong { display: block; }.asset-grid small { margin-bottom: 7px; color: #717b7f; }.asset-grid strong { line-height: 1.5; }.asset-dialog h4 { margin: 17px 0 8px; }.parameter-list { border-top: 1px solid #bdc4c6; }.parameter-list > div { display: flex; justify-content: space-between; gap: 20px; padding: 8px; border-bottom: 1px solid #d5d9da; }.device-reading, .material-runtime { display: flex; align-items: center; gap: 14px; margin-top: 13px; padding: 11px; color: #e7eaea; background: #272f32; }.device-reading strong { color: #f0b429; font-size: 18px; }.device-reading small { margin-left: auto; color: #9ca5a8; }.dialog-note, .quality-rule { margin-top: 13px; padding: 11px; color: #5e686c; border-left: 3px solid #e9aa24; background: #eef0f0; }.material-runtime { justify-content: space-between; }.material-runtime small, .material-runtime b { display: block; }.material-runtime small { color: #9ca5a8; }.material-runtime b { margin-top: 4px; }.run-summary { display: grid; grid-template-columns: 1.6fr 1fr 1fr; gap: 1px; padding: 1px; background: #c8cdcf; }.run-summary > div { padding: 11px; background: #f2f3f3; }.run-summary small, .run-summary b { display: block; }.event-row { display: grid; grid-template-columns: 140px 55px minmax(0, 1fr); gap: 10px; padding: 9px 0; border-top: 1px solid #d5d9da; color: #4c575b; font-size: 11px; }.PASSED { color: #278047; }.FAILED { color: #bd4039; }
.product-dialog { color: #22292c; }.product-dialog h4 { margin: 17px 0 8px; }.asset-title > b.running { color: #277943; border-color: #4b9a63; }.asset-title > b.running i { background: #54b975; }.asset-title > b.hold { color: #a56d08; border-color: #d09a28; }.asset-title > b.hold i { background: #e9aa24; }.asset-title > b.rejected { color: #b63d37; border-color: #c4635e; }.asset-title > b.rejected i { background: #df5a52; }.asset-title > b.passed { color: #2f7188; border-color: #5f9fb5; }.asset-title > b.passed i { background: #4c94ad; }.product-summary { grid-template-columns: repeat(3,1fr); }.product-readings > div, .product-events > div { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 4px 12px; padding: 9px; border-top: 1px solid #d2d7d8; background: #f4f5f5; }.product-readings span, .product-events span { color: #3f4b50; font-size: 11px; }.product-readings b { color: #9a690e; }.product-readings small, .product-events small { grid-column: 1 / -1; color: #788287; font-size: 9px; }.product-events b { font-size: 10px; }
.product-observations { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 1px; background: #cbd0d1; }.product-observations > div { display: flex; justify-content: space-between; gap: 12px; min-height: 42px; padding: 10px; background: #f2f3f3; }.product-observations span { color: #717b7f; }.product-observations b { text-align: right; }.product-observations .empty-observation { grid-column: 1 / -1; justify-content: flex-start; color: #788287; }
.product-linked-alarms { margin-top: 12px; padding: 11px; color: #5b302d; border-left: 4px solid #df5a52; background: #f7e9e8; }.product-linked-alarms > b { display: block; margin-bottom: 8px; color: #ad3731; }.product-linked-alarms > div { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 4px 12px; padding: 7px 0; border-top: 1px solid #e6c5c2; }.product-linked-alarms strong { color: #b63d37; }.product-linked-alarms small { grid-column: 1 / -1; color: #8e625e; font-size: 9px; }
@keyframes materialMove { from { transform: translateX(0); } to { transform: translateX(calc(100vw + 80px)); } }
@keyframes machineLevel { 0%,100% { height: 6px; } 50% { height: 18px; } }
@keyframes statusPulse { 0%,100% { opacity: .45; } 50% { opacity: 1; } }
@keyframes materialSignal { 0%,100% { opacity: .45; transform: rotate(45deg) scale(.8); } 50% { opacity: 1; transform: rotate(45deg) scale(1); } }
@media (max-width: 1200px) { .stage-page { padding: 24px; }.detail-grid { grid-template-columns: 1fr; }.device-track { grid-template-columns: repeat(3, 1fr); }.material-flow { grid-template-columns: repeat(2, 1fr); }.live-metrics { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 700px) { .stage-page { padding: 16px 12px 28px; }.header-main, .section-heading, .stage-details-heading { align-items: flex-start; flex-direction: column; }.stage-nav { align-items: flex-start; }.stage-nav span { text-align: right; }.stage-switcher button span { display: none; }.live-metrics, .metric-cards, .material-flow { grid-template-columns: 1fr; }.device-track { grid-template-columns: repeat(2, minmax(0, 1fr)); }.machine-line { padding: 45px 12px 38px; }.work-description { grid-template-columns: 1fr; }.work-description i { display: none; }.work-description strong, .work-description b { white-space: normal; }.record-row, .task-row { grid-template-columns: 1fr; gap: 4px; padding: 9px; }.record-row strong, .task-row strong { text-align: left; }.asset-grid, .run-summary, .product-summary { grid-template-columns: 1fr; }.event-row { grid-template-columns: 1fr; gap: 3px; }.visual-toolbar { width: 100%; justify-content: flex-start; }.view-switch { width: 100%; }.view-switch button { flex: 1; justify-content: center; }.status-color-control, .pause-visual { flex: 1; justify-content: center; }.visual-runtime-bar { grid-template-columns: 1fr 1fr; }.visual-runtime-bar > div { border-top: 1px solid #3c464a; }.visual-runtime-bar > div:first-child { grid-column: 1 / -1; } }
@media (prefers-reduced-motion: reduce) { .moving-load, .machine-motion i, .machine > b i, .material-head i { animation: none !important; } .machine, .material-card { transition: none; } }
</style>

<style scoped>
.stage-page {
	--blue-900:#123a5b; --blue-800:#145da0; --blue-600:#1f7acb; --blue-100:#dceaf5;
	--bg:#edf3f7; --panel:#fff; --line:#c8d6e2; --text:#16324a; --muted:#61788b;
	--green:#238b5a; --yellow:#d89016; --red:#c83f49;
	color:var(--text); background-color:var(--bg);
	background-image:linear-gradient(rgba(20,93,160,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(20,93,160,.035) 1px,transparent 1px);
	background-size:24px 24px; font-family:'Microsoft YaHei UI','HarmonyOS Sans SC',sans-serif;
}
.stage-header { border-bottom:3px solid var(--blue-800); }
.stage-nav button { color:var(--blue-800); border-color:#9ebbd1; background:#fff; }.stage-nav button:hover { border-color:var(--blue-600); background:#f1f7fb; }
.stage-nav span,.stage-switcher span { color:var(--muted); }.stage-nav span b,.station-code { color:#fff; background:var(--blue-800); }
.header-main h1 { color:var(--blue-900); }.header-main p { color:var(--muted); }
.live-state { border-color:var(--line); border-left-color:#8398a8; background:#fff; }.live-state small { color:var(--muted); }.live-state.running { border-left-color:var(--green); }.live-state.running > i { background:var(--green); box-shadow:none; }.live-state.alarm { border-left-color:var(--red); }.live-state.alarm > i { background:var(--red); }
.stage-switcher button { color:var(--blue-800); }.stage-switcher button:disabled { color:#9caab5; }
.workcell,.material-section,.data-panel,.alarm-panel,.records-block,.device-status-panel,.quality-gate-panel { border-color:var(--line); border-radius:3px; background:#fff; box-shadow:0 2px 7px rgba(18,58,91,.035); }
.workcell { border-top:3px solid var(--blue-800); }
.section-heading h2,.stage-details-heading h2 { color:var(--blue-900); }.section-heading p,.stage-details-heading p { color:var(--muted); }
.section-number { color:#fff; background:var(--blue-800); }.mode-label,.section-count { color:var(--blue-800); border-color:#a7c3d8; background:#f1f7fb; }
.stage-details-heading { border-bottom-color:#b7c9d7; }.stage-details-heading span { color:var(--blue-600); letter-spacing:0; }
.status-color-control { color:var(--muted); border-color:var(--line); background:#f7fafc; }.pause-visual { color:var(--blue-800); border-color:#9ebbd1; background:#fff; }.pause-visual:hover { color:var(--blue-600); border-color:var(--blue-600); }.pause-visual.active { color:#fff; border-color:var(--blue-800); background:var(--blue-800); }
.view-switch { border-color:#9ebbd1; background:#fff; }.view-switch button { color:#5d7486; border-right-color:#c5d4df; }.view-switch button:hover { color:var(--blue-800); background:#edf5fb; }.view-switch button.active { color:#fff; background:var(--blue-800); }.view-switch button.off.active { color:#fff; background:#637b8d; }
.visualization-off { border-color:var(--line); color:var(--text); background:#f5f8fa; }.visualization-off > i { color:#7c93a4; }.visualization-off b { color:var(--blue-900); }.visualization-off span { color:var(--muted); }
.visual-runtime-bar { border-color:var(--line); background:#f5f9fc; }.visual-runtime-bar > div { border-left-color:#d7e2ea; }.visual-runtime-bar span { color:var(--muted); }.visual-runtime-bar b { color:var(--text); }
.live-metrics { grid-template-columns:repeat(6,minmax(0,1fr)); gap:8px; }.live-metrics > div { min-height:94px; border-color:var(--line); border-top-color:var(--blue-600); border-radius:2px; background:#fff; }.live-metrics span,.live-metrics small { color:var(--muted); }.live-metrics strong { color:var(--blue-900); font-size:18px; }.live-metrics .time-value { font:700 12px Consolas,monospace; overflow-wrap:anywhere; }
.success-text { color:var(--green) !important; }.danger-text { color:var(--red) !important; }.warning-text { color:var(--yellow) !important; }
.operations-grid { display:grid; grid-template-columns:minmax(0,1.45fr) minmax(360px,.85fr); gap:12px; margin-top:12px; }.device-status-panel,.quality-gate-panel { min-width:0; padding:18px; }
.device-table { overflow-x:auto; }.device-table-head,.device-table-row { display:grid; grid-template-columns:minmax(190px,1.3fr) 82px 112px minmax(180px,1.2fr) 105px; min-width:730px; gap:10px; align-items:center; }.device-table-head { min-height:30px; padding:0 10px; color:var(--muted); background:#eaf1f6; font-size:8px; }.device-table-row { width:100%; min-height:49px; padding:6px 10px; color:var(--text); text-align:left; border:0; border-bottom:1px solid #e1e9ef; background:#fff; cursor:pointer; }.device-table-row:hover { background:#f3f8fc; }
.device-table-row > span { min-width:0; color:#506a7d; font-size:9px; }.device-table-row > span:first-child { display:grid; grid-template-columns:26px minmax(0,1fr); gap:2px 7px; }.device-table-row > span:first-child > i { grid-row:1 / span 2; align-self:center; color:var(--blue-600); font:8px Consolas,monospace; }.device-table-row b,.device-table-row small { display:block; }.device-table-row b { overflow:hidden; color:var(--text); font-size:9px; text-overflow:ellipsis; white-space:nowrap; }.device-table-row small { margin-top:3px; color:#8496a3; font:7px Consolas,monospace; }.device-table-row > span:nth-child(2) { display:flex; align-items:center; gap:6px; }.state-dot { width:7px; height:7px; border-radius:50%; background:#8496a3; }.state-dot.running { background:var(--green); }.state-dot.alarm { background:var(--red); }.device-table-row > span:last-child { display:flex; justify-content:space-between; align-items:center; color:var(--blue-600); }
.gate-summary { display:grid; grid-template-columns:9px minmax(0,1fr) auto; gap:10px; align-items:center; min-height:55px; padding:10px 12px; border-left:3px solid var(--green); background:#eef7f2; }.gate-summary > i { width:8px; height:8px; border-radius:50%; background:var(--green); }.gate-summary span,.gate-summary strong { display:block; }.gate-summary span { color:var(--muted); font-size:8px; }.gate-summary strong { margin-top:3px; font-size:12px; }.gate-summary > b { color:var(--green); font-size:9px; }.gate-summary.waiting { border-left-color:var(--yellow); background:#fff8eb; }.gate-summary.waiting > i { background:var(--yellow); }.gate-summary.waiting > b { color:var(--yellow); }.gate-summary.failed { border-left-color:var(--red); background:#fff2f2; }.gate-summary.failed > i { background:var(--red); }.gate-summary.failed > b { color:var(--red); }
.gate-list { margin-top:8px; }.gate-row { display:grid; grid-template-columns:8px minmax(0,1fr) minmax(100px,.8fr); gap:9px; align-items:center; min-height:55px; padding:7px 0; border-bottom:1px solid #e2e9ef; }.gate-row > i { width:7px; height:7px; border-radius:50%; background:#8c9ba6; }.gate-row > i.pass { background:var(--green); }.gate-row > i.fail { background:var(--red); }.gate-row > i.wait { background:var(--yellow); }.gate-row strong,.gate-row span,.gate-row b,.gate-row small { display:block; }.gate-row strong { font-size:9px; }.gate-row span { margin-top:3px; color:var(--muted); font-size:8px; line-height:1.4; }.gate-row > div:last-child { text-align:right; }.gate-row b { color:var(--blue-800); font:9px Consolas,monospace; overflow-wrap:anywhere; }.gate-row small { margin-top:4px; color:#8295a3; font-size:7px; }
.material-card { color:var(--text); border-color:var(--line); background:#f9fbfc; }.material-card:hover { border-color:var(--blue-600); }.material-head span { color:var(--blue-800); border-color:#a9c5da; background:#eef6fb; }.material-head i { border-color:var(--green); }.material-card > small { color:#748a9b; }.material-card dl > div { border-top-color:#dce6ed; }.material-card dt { color:var(--muted); }.material-card dd { color:var(--text); }.material-card > b { color:var(--blue-600); }
.metric-cards > div { border-left-color:var(--blue-600); background:#f4f8fb; }.metric-cards span,.metric-cards small { color:var(--muted); }.metric-cards strong { color:var(--blue-900); }.reading-list > div { border-top-color:#dce6ed; }.reading-list small,.empty-state { color:var(--muted); }
.safe-state { border-left-color:var(--green); background:#eef7f2; }.safe-state > i { background:var(--green); }.safe-state span { color:var(--muted); }.alarm-row { border-top-color:#edc7c9; }.alarm-row b,.alarm-row strong { color:var(--red); }.alarm-row span { color:#93676a; }.incident-row { border-top-color:#ecd8ae; }.incident-row b,.incident-row strong { color:var(--yellow); }.incident-row span { color:#876f43; }.incident-row small { color:var(--muted); }
.record-row,.task-row { color:#476276; border-top-color:#dce6ed; }.record-row:hover { background:#f2f7fb; }.record-row strong,.task-row strong { color:var(--blue-600); }
.asset-dialog { color:var(--text); }.asset-title { border-bottom-color:var(--blue-800); }.asset-title h3 { color:var(--blue-900); }.asset-grid { background:var(--line); }.asset-grid > div,.run-summary > div { background:#f4f8fb; }.device-reading,.material-runtime { color:#fff; background:var(--blue-900); }.device-reading strong { color:#fff; }.dialog-note,.quality-rule { color:#50697b; border-left-color:var(--blue-600); background:#edf5fa; }
@media (max-width:1250px) { .live-metrics { grid-template-columns:repeat(3,1fr); }.operations-grid { grid-template-columns:1fr; } }
@media (max-width:700px) { .live-metrics { grid-template-columns:repeat(2,1fr); }.operations-grid { grid-template-columns:1fr; }.device-status-panel,.quality-gate-panel { padding:14px 11px; }.gate-row { grid-template-columns:8px minmax(0,1fr); }.gate-row > div:last-child { grid-column:2; text-align:left; }.workcell,.material-section,.data-panel,.alarm-panel,.records-block { padding:14px 11px; } }
@media (min-width:1100px) {
	.stage-page { padding:16px 24px 28px; }.stage-header { padding-bottom:10px; }.header-main { margin-top:10px; }.header-main h1 { margin:5px 0 3px; font-size:28px; }.header-main p { font-size:10px; }.stage-switcher { margin-top:8px; }.workcell { margin-top:8px; padding:12px; }.workcell > .section-heading { margin-bottom:9px; }.stage-details-heading { margin:15px 0 8px; padding-bottom:7px; }.live-metrics { gap:6px; margin-bottom:8px; }.live-metrics > div { min-height:70px; padding:8px 10px; }.live-metrics strong { margin:3px 0 2px; font-size:15px; }.operations-grid { gap:8px; margin-top:8px; }.device-status-panel,.quality-gate-panel { padding:12px; }
}
</style>

<style>
.industrial-dialog { border-top-color:#145da0 !important; }
.industrial-dialog .el-dialog__header { border-bottom-color:#c8d6e2; background:#edf4f9; }
.industrial-dialog .el-dialog__title { color:#123a5b; }
</style>

<style>
.industrial-dialog { border-radius: 2px !important; border-top: 5px solid #145da0; }
.industrial-dialog .el-dialog__header { padding: 14px 18px; border-bottom: 1px solid #c8d6e2; background: #edf4f9; }
.industrial-dialog .el-dialog__title { color: #123a5b; font-size: 15px; font-weight: bold; }
.industrial-dialog .el-dialog__body { padding: 18px; }
@media (max-width: 800px) { .industrial-dialog { width: calc(100% - 24px) !important; margin-top: 4vh !important; }.industrial-dialog .el-dialog__body { max-height: 78vh; overflow-y: auto; } }
</style>
