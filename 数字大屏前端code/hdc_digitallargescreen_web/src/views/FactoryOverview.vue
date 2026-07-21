<template>
	<div class="factory-screen">
		<header class="screen-header">
			<div class="title-block">
				<div class="eyebrow">BOTTLING LINE · PRODUCTION MONITOR</div>
				<h1>智慧装瓶产线全局监控</h1>
				<p>生产、质量、设备、物流与仓储一体化运行态势</p>
			</div>
			<div class="header-status">
				<div class="line-state" :class="lineStateClass"><i></i><span>整线状态</span><strong>{{ lineStatus }}</strong></div>
				<div class="connection-list">
					<span :class="{ online: online }"><i></i>{{ online ? '后端在线' : '后端断开' }}</span>
					<span :class="{ online: realtimeOnline }"><i></i>{{ realtimeOnline ? '实时通道在线' : '实时通道重连' }}</span>
					<span class="source"><i></i>{{ dataMode }}</span>
				</div>
				<small>数据时间 {{ snapshotTime }} · 2 秒刷新</small>
			</div>
		</header>

		<main>
			<section class="process-section" aria-labelledby="production-flow-title">
				<div class="section-heading">
					<div><span>CONTINUOUS PRODUCTION FLOW</span><h2 id="production-flow-title">整线生产流程</h2><p>每个工位独立运行；点击工位进入设备、物料、质量门和异常详情。</p></div>
					<div class="flow-legend"><span><i class="running"></i>运行</span><span><i class="warning"></i>待处理</span><span><i class="danger"></i>异常/剔除</span><span><i class="simulation"></i>模拟数据</span></div>
				</div>
				<div class="flow-scroll">
					<div class="flow-track">
						<div v-for="(item, index) in stageCards" :key="item.stage.code" class="stage-wrap">
							<button type="button" class="stage-card" :class="item.stateClass" @click="showStage(item.stage)">
								<div class="stage-card-head"><span>{{ String(index + 1).padStart(2, '0') }}</span><b><i></i>{{ item.stateLabel }}</b></div>
								<h3>{{ item.stage.name }}</h3>
								<div class="stage-main-value"><strong>{{ item.runtime.speedDisplay }}</strong><span>{{ item.runtime.cycleDisplay }} / 周期</span></div>
								<dl>
									<div><dt>设备</dt><dd>{{ item.onlineDevices }}/{{ item.deviceCount }} 在线</dd></div>
									<div><dt>缓冲</dt><dd>{{ item.bufferLevel }}/{{ item.bufferCapacity }}</dd></div>
									<div><dt>在制品</dt><dd>{{ item.activeProducts }}</dd></div>
									<div><dt>异常</dt><dd :class="{ danger: item.exceptionCount }">{{ item.exceptionCount }}</dd></div>
								</dl>
								<div class="stage-source"><span>{{ item.sourceLabel }}</span><b>进入工位 <i class="el-icon-arrow-right"></i></b></div>
							</button>
							<div v-if="index < stageCards.length - 1" class="flow-arrow"><i></i><span class="el-icon-arrow-right"></span></div>
						</div>
					</div>
				</div>
			</section>

			<section class="summary-strip" aria-label="生产核心指标">
				<div><span>累计投入</span><strong>{{ dashboard.total }}</strong><small>产品追踪批次</small></div>
				<div><span>完成入库</span><strong>{{ dashboard.completed }}</strong><small>全流程完成</small></div>
				<div><span>在制品 WIP</span><strong>{{ activeBatchCount }}</strong><small>运行或待处理</small></div>
				<div><span>检测剔除</span><strong class="danger-text">{{ dashboard.rejected }}</strong><small>不合格品已隔离</small></div>
				<div><span>待人工处理</span><strong class="warning-text">{{ dashboard.holding }}</strong><small>暂停自动放行</small></div>
				<div><span>批次通过率</span><strong>{{ passRate }}</strong><small>完成 / 已判定批次</small></div>
			</section>

			<div class="dashboard-grid">
				<section class="panel production-panel">
					<div class="panel-heading"><div><span>PRODUCTION & QUALITY</span><h2>生产与质量</h2></div><small>口径：已持久化批次及工序事件</small></div>
					<div class="quality-layout">
						<div class="quality-rate"><div class="rate-number"><strong>{{ passRate }}</strong><span>批次通过率</span></div><div class="rate-track"><i :style="{ width: passRateNumber + '%' }"></i></div><p>已判定 {{ finishedCount }} 批 · 通过 {{ dashboard.completed }} 批 · 剔除 {{ dashboard.rejected }} 批</p></div>
						<div class="production-breakdown">
							<div><span>运行工位</span><b>{{ runningStageCount }}/{{ stages.length }}</b></div>
							<div><span>暂停/阻塞工位</span><b :class="{ 'warning-text': stoppedStageCount }">{{ stoppedStageCount }}</b></div>
							<div><span>开放异常</span><b :class="{ 'danger-text': openExceptions.length }">{{ openExceptions.length }}</b></div>
							<div><span>剔除率</span><b>{{ rejectionRate }}</b></div>
						</div>
					</div>
					<div class="critical-readings" aria-label="全局关键传感器读数">
						<div v-for="item in criticalReadings" :key="item.code" :class="item.status"><span>{{ item.label }}</span><strong>{{ item.value }}</strong><small>{{ item.source }}</small></div>
					</div>
					<div class="defect-list">
						<div class="subheading"><b>缺陷构成</b><span>来自产品级缺陷字段</span></div>
						<div v-if="!defectSummary.length" class="empty-inline">当前没有已记录缺陷</div>
						<div v-for="item in defectSummary" :key="item.type" class="defect-row"><span>{{ defectLabel(item.type) }}</span><div><i :style="{ width: item.percent + '%' }"></i></div><b>{{ item.count }}</b></div>
					</div>
				</section>

				<section class="panel equipment-panel">
					<div class="panel-heading"><div><span>EQUIPMENT & CONSTRAINT</span><h2>设备与产线约束</h2></div><b>{{ onlineDeviceCount }}/{{ totalDeviceCount }} 在线</b></div>
					<div class="equipment-kpis">
						<div><span>MQTT 实机</span><strong>{{ mqttDeviceCount }}</strong><small>当前设备报文</small></div>
						<div><span>模拟兜底</span><strong>{{ fallbackDeviceCount }}</strong><small>无实机报文时启用</small></div>
						<div><span>报警设备</span><strong :class="{ 'danger-text': alarmDeviceCount }">{{ alarmDeviceCount }}</strong><small>设备运行态为 ALARM</small></div>
					</div>
					<div class="constraint-box" :class="{ active: constraintStage }">
						<span>当前约束工位</span><strong>{{ constraintStage ? constraintStage.stage.name : '暂无明显约束' }}</strong>
						<p v-if="constraintStage">缓冲 {{ constraintStage.bufferLevel }}/{{ constraintStage.bufferCapacity }}，优先检查下游放行能力。</p>
						<p v-else>各工位缓冲均无积压，不依据单一速度值强行判定瓶颈。</p>
					</div>
					<div class="buffer-list">
						<div v-for="item in stageCards" :key="item.stage.code"><span>{{ item.stage.name }}</span><div><i :class="bufferClass(item)" :style="{ width: item.bufferPercent + '%' }"></i></div><b>{{ item.bufferLevel }}/{{ item.bufferCapacity }}</b></div>
					</div>
				</section>

				<section class="panel logistics-panel">
					<div class="panel-heading"><div><span>LOGISTICS & WAREHOUSE</span><h2>物流与仓储</h2></div><small>AGV 调度与箱级库存</small></div>
					<div class="logistics-kpis">
						<div><span>AGV 任务</span><strong>{{ logistics.tasks.length }}</strong><small>{{ runningAgv }} 个执行中</small></div>
						<div><span>运输中箱数</span><strong>{{ runningAgv }}</strong><small>状态为 RUNNING</small></div>
						<div><span>已入库箱数</span><strong>{{ logistics.stock.length }}</strong><small>箱级库存记录</small></div>
						<div><span>异常仓区</span><strong :class="{ 'danger-text': alarmZones }">{{ alarmZones }}</strong><small>VOC / 烟雾安全</small></div>
					</div>
					<div class="latest-logistics" v-if="latestAgvTask">
						<div><span>最近 AGV</span><b>{{ latestAgvTask.agvCode }}</b></div><div><span>速度</span><b>{{ latestAgvTask.speedMps }} m/s</b></div><div><span>负载</span><b>{{ latestAgvTask.loadKg }} kg</b></div><div><span>避障距离</span><b :class="{ 'danger-text': latestAgvTask.obstacleDistanceCm < 20 }">{{ latestAgvTask.obstacleDistanceCm }} cm</b></div>
					</div>
					<div class="warehouse-safety" v-if="latestWarehouseZone"><i :class="{ alarm: latestWarehouseZone.status !== 'SAFE' }"></i><div><span>仓区 {{ latestWarehouseZone.zoneCode }} 安全状态</span><strong>{{ latestWarehouseZone.status }}</strong></div><p>VOC {{ latestWarehouseZone.vocPpm }} ppm · 烟雾 {{ latestWarehouseZone.smoke }}% · {{ latestWarehouseZone.temperatureC }} °C</p></div>
				</section>

				<section class="panel exception-panel">
					<div class="panel-heading"><div><span>ACTIVE EXCEPTIONS</span><h2>异常与影响范围</h2></div><b :class="{ danger: openExceptions.length }">{{ openExceptions.length }} 项开放</b></div>
					<div v-if="!openExceptions.length" class="safe-state"><i></i><div><strong>当前无开放异常</strong><span>所有工位满足自动运行和放行条件</span></div></div>
					<div v-for="item in openExceptions.slice(0, 3)" :key="item.id" class="exception-row">
						<i></i><div><strong>{{ item.label }}</strong><span>{{ stageLabel(item.stageCode) }} · {{ item.deviceCode || 'PROCESS' }}</span></div><div><small>处置策略</small><b>{{ item.strategyLabel }}</b></div><div><small>影响范围</small><b>{{ item.impact }}</b></div><strong>{{ item.value }}</strong>
					</div>
					<div v-if="openExceptions.length > 3" class="more-row">另有 {{ openExceptions.length - 3 }} 项异常，请进入管理端处理。</div>
				</section>

				<section class="panel trace-panel">
					<div class="panel-heading"><div><span>RECENT PRODUCT TRACE</span><h2>最近产品追踪</h2></div><small>产品级身份、位置、质量与更新时间</small></div>
					<div class="trace-table" role="table">
						<div class="trace-head" role="row"><span>追踪号</span><span>瓶型</span><span>当前位置</span><span>质量状态</span><span>关键结果</span><span>更新时间</span></div>
						<div v-for="run in recentRuns" :key="run.traceCode" class="trace-row" role="row">
							<b>{{ run.traceCode }}</b><span>{{ run.bottleType || '待识别' }}</span><span>{{ stageLabel(run.currentStage) }}</span><span><i :class="statusClass(run.status)"></i>{{ statusLabel(run.status) }}</span><span>{{ runResult(run) }}</span><time>{{ formatTime(run.updatedAt) }}</time>
						</div>
						<div v-if="!recentRuns.length" class="empty-table">尚无产品追踪记录</div>
					</div>
				</section>
			</div>
		</main>
	</div>
</template>

<script>
import { ServiceGet } from '@/api/Service.js'
import { closeFactoryRealtime, connectFactoryRealtime } from '@/api/FactoryRealtime.js'
import { FACTORY_STAGES } from '@/config/factoryStages.js'
import { buildFactoryRuntime } from '@/config/factoryRuntime.js'

export default {
	data() {
		return {
			timer: null,
			online: false,
			realtimeOnline: false,
			operations: { latestReadings: [], alarms: [], commands: [], aiAudits: [] },
			logistics: { tasks: [], zones: [], stock: [] },
			runtimeSnapshot: { generatedAt: null, devices: [], stages: [], incidents: [] },
			dashboard: { total: 0, running: 0, completed: 0, rejected: 0, holding: 0, runs: [] },
			stages: FACTORY_STAGES
		}
	},
	computed: {
		openAlarms() { return (this.operations.alarms || []).filter(item => item.status === 'OPEN') },
		openRuntimeIncidents() { return (this.runtimeSnapshot.incidents || []).filter(item => item.status === 'OPEN') },
		openExceptions() {
			const alarms = this.openAlarms.map(item => ({
				id: 'alarm-' + item.alarmId,
				label: this.alarmTypeLabel(item.alarmType),
				stageCode: this.normalizedStage(item.stage, item),
				deviceCode: item.deviceCode,
				value: item.value == null ? '--' : item.value + (item.unit ? ' ' + item.unit : ''),
				strategyLabel: '按报警规则处置',
				impact: item.traceCode ? '当前产品 ' + item.traceCode : '对应工位放行'
			}))
			const incidents = this.openRuntimeIncidents.map(item => ({
				id: 'incident-' + item.incidentId,
				label: this.strategyLabel(item.strategy),
				stageCode: item.stageCode,
				deviceCode: item.deviceCode,
				value: item.message || '--',
				strategyLabel: this.strategyLabel(item.strategy),
				impact: [item.upstreamImpact, item.downstreamImpact].filter(value => value && value !== '无').join(' / ') || '仅当前工位'
			}))
			return alarms.concat(incidents)
		},
		stageCards() {
			return this.stages.map(stage => {
				const runtimeState = (this.runtimeSnapshot.stages || []).find(item => item.stageCode === stage.code) || {}
				const devices = (this.runtimeSnapshot.devices || []).filter(item => item.stageCode === stage.code)
				const runtime = buildFactoryRuntime({ stage, operations: this.operations, logistics: this.logistics, runtimeSnapshot: this.runtimeSnapshot, running: this.lineRunning })
				const exceptionCount = this.openExceptions.filter(item => item.stageCode === stage.code).length
				const danger = this.dashboard.runs.some(run => run.currentStage === stage.code && run.status === 'REJECTED') || this.openRuntimeIncidents.some(item => item.stageCode === stage.code && item.strategy === 'REJECT_PRODUCT')
				const hold = runtimeState.state && runtimeState.state !== 'RUNNING' || this.dashboard.runs.some(run => run.currentStage === stage.code && run.status === 'HOLD') || exceptionCount > 0
				const deviceCount = devices.length || stage.devices.length
				const onlineDevices = devices.length ? devices.filter(item => !['OFFLINE', 'DISCONNECTED'].includes(item.state)).length : (this.online ? stage.devices.length : 0)
				const mqtt = devices.filter(item => item.source === 'MQTT' && !item.fallback).length
				const simulation = devices.filter(item => item.source === 'SIMULATION' || item.fallback).length
				const bufferLevel = Number(runtimeState.bufferLevel || 0)
				const bufferCapacity = Number(runtimeState.bufferCapacity || 0)
				return {
					stage, runtime, runtimeState, deviceCount, onlineDevices, bufferLevel, bufferCapacity,
					bufferPercent: bufferCapacity ? Math.min(100, bufferLevel / bufferCapacity * 100) : 0,
					activeProducts: this.dashboard.runs.filter(run => run.currentStage === stage.code && ['RUNNING', 'HOLD'].includes(run.status)).length,
					exceptionCount,
					stateClass: danger ? 'danger' : hold ? 'warning' : runtimeState.state === 'RUNNING' || this.lineRunning ? 'running' : 'standby',
					stateLabel: danger ? '存在剔除' : hold ? '待处理' : runtimeState.state === 'RUNNING' || this.lineRunning ? '持续运行' : '等待上线',
					sourceLabel: mqtt ? mqtt + ' MQTT / ' + simulation + ' 模拟' : simulation ? 'SIMULATION 自动兜底' : '等待设备报文'
				}
			})
		},
		lineRunning() { return (this.runtimeSnapshot.stages || []).some(item => item.state === 'RUNNING') || this.dashboard.total > 0 },
		runningStageCount() { return this.stageCards.filter(item => item.stateClass === 'running').length },
		stoppedStageCount() { return this.stageCards.filter(item => ['warning', 'danger'].includes(item.stateClass)).length },
		lineStatus() { if (!this.online) return '数据连接中'; return this.openExceptions.length ? '连续运行 · 局部异常' : this.lineRunning ? '全线连续运行' : '等待首批上线' },
		lineStateClass() { return !this.online ? 'standby' : this.openExceptions.length ? 'warning' : 'running' },
		activeBatchCount() { return Math.max(0, this.dashboard.total - this.dashboard.completed - this.dashboard.rejected) },
		finishedCount() { return this.dashboard.completed + this.dashboard.rejected },
		passRateNumber() { return this.finishedCount ? Number((this.dashboard.completed / this.finishedCount * 100).toFixed(1)) : 0 },
		passRate() { return this.finishedCount ? this.passRateNumber.toFixed(1) + '%' : '--' },
		rejectionRate() { return this.finishedCount ? (this.dashboard.rejected / this.finishedCount * 100).toFixed(1) + '%' : '--' },
		totalDeviceCount() { return (this.runtimeSnapshot.devices || []).length || this.stages.reduce((total, stage) => total + stage.devices.length, 0) },
		onlineDeviceCount() { const devices = this.runtimeSnapshot.devices || []; return devices.length ? devices.filter(item => !['OFFLINE', 'DISCONNECTED'].includes(item.state)).length : (this.online ? this.totalDeviceCount : 0) },
		mqttDeviceCount() { return (this.runtimeSnapshot.devices || []).filter(item => item.source === 'MQTT' && !item.fallback).length },
		fallbackDeviceCount() { return (this.runtimeSnapshot.devices || []).filter(item => item.source === 'SIMULATION' || item.fallback).length },
		alarmDeviceCount() { return (this.runtimeSnapshot.devices || []).filter(item => item.state === 'ALARM').length },
		dataMode() { return this.mqttDeviceCount ? 'HYBRID · MQTT + SIMULATION' : 'SIMULATION · 自动兜底' },
		snapshotTime() { return this.formatTime(this.runtimeSnapshot.generatedAt) },
		constraintStage() { const candidates = this.stageCards.filter(item => item.bufferLevel > 0).sort((a, b) => b.bufferPercent - a.bufferPercent); return candidates[0] || null },
		defectSummary() {
			const counts = {}
			this.dashboard.runs.filter(run => run.defectType).forEach(run => { counts[run.defectType] = (counts[run.defectType] || 0) + 1 })
			const max = Math.max(1, ...Object.values(counts))
			return Object.keys(counts).map(type => ({ type, count: counts[type], percent: counts[type] / max * 100 })).sort((a, b) => b.count - a.count).slice(0, 3)
		},
		criticalReadings() {
			const readings = this.operations.latestReadings || []
			const processVoc = readings.find(item => item.sensorType === 'VOC' && String(item.deviceCode || '').indexOf('WAREHOUSE') !== 0)
			const temperature = readings.find(item => item.sensorType === 'TEMPERATURE')
			const humidity = readings.find(item => item.sensorType === 'HUMIDITY')
			const zone = this.latestWarehouseZone
			const task = this.latestAgvTask
			return [
				this.readingCard('PROCESS_VOC', '瓶体 VOC', processVoc && processVoc.value, processVoc && processVoc.unit || 'ppm', processVoc ? Number(processVoc.value) <= 10 : null, processVoc && processVoc.mode),
				this.readingCard('BEV_TEMP', '饮料温度', temperature && temperature.value, temperature && temperature.unit || '°C', temperature ? Number(temperature.value) >= 20 && Number(temperature.value) <= 30 : null, temperature && temperature.mode),
				this.readingCard('BEV_HUM', '环境湿度', humidity && humidity.value, humidity && humidity.unit || '%RH', humidity ? true : null, humidity && humidity.mode),
				this.readingCard('WH_VOC', '仓区 VOC', zone && zone.vocPpm, 'ppm', zone ? Number(zone.vocPpm) <= 10 : null, 'WAREHOUSE'),
				this.readingCard('WH_SMOKE', '仓区烟雾', zone && zone.smoke, '%', zone ? Number(zone.smoke) <= .5 : null, 'WAREHOUSE'),
				this.readingCard('AGV_DISTANCE', 'AGV 避障', task && task.obstacleDistanceCm, 'cm', task ? Number(task.obstacleDistanceCm) >= 20 : null, task && task.mode)
			]
		},
		runningAgv() { return (this.logistics.tasks || []).filter(item => item.status === 'RUNNING').length },
		alarmZones() { return (this.logistics.zones || []).filter(item => item.status !== 'SAFE').length },
		latestAgvTask() { return this.sortedByTime(this.logistics.tasks || [], 'updatedAt')[0] || null },
		latestWarehouseZone() { return this.sortedByTime(this.logistics.zones || [], 'updatedAt')[0] || null },
		recentRuns() { return this.sortedByTime(this.dashboard.runs || [], 'updatedAt').slice(0, 5) }
	},
	mounted() {
		this.load()
		this.timer = window.setInterval(this.load, 2000)
		connectFactoryRealtime(this.load, online => { this.realtimeOnline = online })
	},
	beforeDestroy() { window.clearInterval(this.timer); closeFactoryRealtime() },
	methods: {
		async load() {
			try {
				const responses = await Promise.all([
					ServiceGet.get('/hdc/api/factory/dashboard'),
					ServiceGet.get('/hdc/api/operations/overview'),
					ServiceGet.get('/hdc/api/logistics/overview'),
					ServiceGet.get('/hdc/api/factory/runtime')
				])
				this.dashboard = responses[0] || this.dashboard
				this.operations = responses[1] || this.operations
				this.logistics = responses[2] || this.logistics
				this.runtimeSnapshot = responses[3] || this.runtimeSnapshot
				this.online = true
			} catch (error) { this.online = false }
		},
		showStage(stage) { this.$router.push('/factoryStage/' + stage.code) },
		sortedByTime(items, field) { return items.slice().sort((a, b) => new Date(b[field] || 0).getTime() - new Date(a[field] || 0).getTime()) },
		normalizedStage(stage, item) { if (stage === 'WAREHOUSE_SAFETY' || item.deviceCode && item.deviceCode.indexOf('WAREHOUSE') === 0) return 'WAREHOUSE_INBOUND'; return stage },
		bufferClass(item) { if (item.bufferPercent >= 80) return 'danger'; if (item.bufferPercent >= 50) return 'warning'; return 'normal' },
		readingCard(code, label, rawValue, unit, passed, source) { return { code, label, value: rawValue == null ? '--' : rawValue + ' ' + unit, status: passed == null ? 'waiting' : passed ? 'normal' : 'danger', source: source || '等待上报' } },
		defectLabel(value) { return { BODY_DENT: '瓶身凹陷', CAP_DEFECT: '瓶盖缺陷', BOTTOM_DEFECT: '瓶底缺陷', FILL_LEVEL: '液位异常', SEAL_DEFECT: '密封异常' }[value] || value },
		runResult(run) { if (run.defectType) return this.defectLabel(run.defectType); if (run.voc != null) return 'VOC ' + run.voc + ' ppm'; if (run.boxCode) return run.boxCode; return '等待检测结果' },
		statusClass(value) { return { RUNNING: 'running', COMPLETED: 'passed', REJECTED: 'danger', HOLD: 'warning' }[value] || 'standby' },
		statusLabel(value) { return { RUNNING: '运行中', COMPLETED: '已入库', REJECTED: '已剔除', HOLD: '待处理' }[value] || value },
		formatTime(value) { if (!value) return '--'; return String(value).replace('T', ' ').slice(0, 19) },
		alarmTypeLabel(value) { return { VOC_LIMIT: 'VOC 超限', SMOKE_LIMIT: '烟雾超限', TEMPERATURE_LIMIT: '温度超限', AGV_DISTANCE_LIMIT: 'AGV 障碍物' }[value] || value },
		strategyLabel(value) { return { REJECT_PRODUCT: '剔除当前产品', STOP_STAGE: '仅停当前工位', RETURN_PREVIOUS: '返回上一工位', ROUTE_REWORK: '进入返工流程', BUFFER_AND_STOP: '进入缓冲并停工', STOP_LINE: '整线急停', MANUAL_HOLD: '人工确认' }[value] || value },
		stageLabel(value) { if (value === 'COMPLETED') return '完成入库'; const stage = this.stages.find(item => item.code === value); return stage ? stage.name : value || '整线' }
	}
}
</script>

<style scoped>
* { box-sizing: border-box; }
.factory-screen {
	--blue-900: #123a5b; --blue-800: #145da0; --blue-600: #1f7acb; --blue-100: #dceaf5;
	--bg: #edf3f7; --panel: #fff; --line: #c8d6e2; --line-dark: #9fb6c8;
	--text: #16324a; --muted: #61788b; --green: #238b5a; --yellow: #d89016; --red: #c83f49;
	min-height: 100vh; padding: 24px 30px 40px; color: var(--text); background-color: var(--bg);
	background-image: linear-gradient(rgba(20,93,160,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(20,93,160,.035) 1px, transparent 1px);
	background-size: 24px 24px; font-family: 'Microsoft YaHei UI', 'HarmonyOS Sans SC', sans-serif;
}
.screen-header { display: flex; justify-content: space-between; align-items: flex-end; gap: 30px; padding: 0 0 18px; border-bottom: 3px solid var(--blue-800); }
.eyebrow, .section-heading > div > span, .panel-heading > div > span { color: var(--blue-600); font: 11px Consolas, monospace; }
.title-block h1 { margin: 6px 0 5px; color: var(--blue-900); font-size: 31px; line-height: 1.25; letter-spacing: 0; }
.title-block p { margin: 0; color: var(--muted); font-size: 13px; }
.header-status { min-width: 420px; text-align: right; }
.line-state { display: inline-grid; grid-template-columns: 10px auto auto; gap: 8px; align-items: center; margin-bottom: 8px; }
.line-state > i { width: 9px; height: 9px; border-radius: 50%; background: #8698a6; }.line-state.running > i { background: var(--green); }.line-state.warning > i { background: var(--yellow); }
.line-state span { color: var(--muted); font-size: 11px; }.line-state strong { color: var(--blue-900); font-size: 15px; }
.connection-list { display: flex; justify-content: flex-end; gap: 7px; flex-wrap: wrap; }
.connection-list span { display: flex; align-items: center; gap: 6px; min-height: 27px; padding: 4px 8px; color: #718596; border: 1px solid var(--line); background: #f8fafc; font-size: 10px; }
.connection-list i { width: 6px; height: 6px; border-radius: 50%; background: #9aa9b5; }.connection-list .online i { background: var(--green); }.connection-list .source { color: var(--blue-800); border-color: #9fc0dc; background: #edf6fc; }.connection-list .source i { border-radius: 0; background: var(--blue-600); }
.header-status > small { display: block; margin-top: 7px; color: #7d8f9d; font: 9px Consolas, monospace; }
main { display: block; }
.process-section { margin-top: 18px; padding: 18px; border: 1px solid var(--line); border-top: 3px solid var(--blue-800); border-radius: 3px; background: var(--panel); }
.section-heading, .panel-heading { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; }
.section-heading h2, .panel-heading h2 { margin: 4px 0 3px; color: var(--blue-900); font-size: 18px; letter-spacing: 0; }
.section-heading p { margin: 0; color: var(--muted); font-size: 11px; }
.flow-legend { display: flex; gap: 13px; flex-wrap: wrap; color: var(--muted); font-size: 9px; }
.flow-legend span { display: flex; align-items: center; gap: 5px; }.flow-legend i { width: 8px; height: 8px; border-radius: 50%; }.flow-legend .running { background: var(--green); }.flow-legend .warning { background: var(--yellow); }.flow-legend .danger { background: var(--red); }.flow-legend .simulation { border-radius: 0; background: var(--blue-600); }
.flow-scroll { margin-top: 17px; overflow-x: auto; overflow-y: hidden; scrollbar-color: var(--blue-600) #e6eef4; scrollbar-width: thin; }
.flow-track { display: grid; grid-template-columns: repeat(9, minmax(176px, 1fr)); min-width: 1670px; padding-bottom: 7px; }
.stage-wrap { position: relative; min-width: 0; padding-right: 18px; }.stage-wrap:last-child { padding-right: 0; }
.stage-card { position: relative; display: flex; flex-direction: column; width: 100%; height: 236px; padding: 12px; color: var(--text); text-align: left; border: 1px solid var(--line-dark); border-top: 4px solid #8094a3; border-radius: 3px; background: #fff; cursor: pointer; transition: border-color .18s ease, box-shadow .18s ease, transform .18s ease; }
.stage-card:hover { z-index: 2; border-color: var(--blue-600); box-shadow: 0 6px 16px rgba(18,58,91,.12); transform: translateY(-2px); }.stage-card.running { border-top-color: var(--green); }.stage-card.warning { border-top-color: var(--yellow); }.stage-card.danger { border-top-color: var(--red); }
.stage-card-head { display: flex; justify-content: space-between; gap: 8px; align-items: center; }.stage-card-head > span { color: #8297a7; font: 10px Consolas, monospace; }.stage-card-head b { display: flex; align-items: center; gap: 5px; color: var(--green); font-size: 9px; font-weight: normal; }.stage-card-head b i { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }.stage-card.warning .stage-card-head b { color: var(--yellow); }.stage-card.danger .stage-card-head b { color: var(--red); }
.stage-card h3 { min-height: 37px; margin: 10px 0 6px; color: var(--blue-900); font-size: 15px; line-height: 1.3; letter-spacing: 0; }
.stage-main-value { padding: 8px 0; border-top: 1px solid #e4ebf0; border-bottom: 1px solid #e4ebf0; }.stage-main-value strong, .stage-main-value span { display: block; }.stage-main-value strong { color: var(--blue-800); font: bold 17px Consolas, monospace; }.stage-main-value span { margin-top: 3px; color: var(--muted); font-size: 8px; }
.stage-card dl { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 8px; margin: 9px 0 0; }.stage-card dl div { min-width: 0; }.stage-card dt { color: #71879a; font-size: 8px; }.stage-card dd { margin: 2px 0 0; color: var(--text); font: bold 9px Consolas, monospace; }.stage-card dd.danger { color: var(--red); }
.stage-source { display: flex; justify-content: space-between; gap: 7px; align-items: center; margin-top: auto; padding-top: 8px; border-top: 1px solid #e4ebf0; }.stage-source > span { max-width: 58%; overflow: hidden; color: #73899a; font-size: 8px; text-overflow: ellipsis; white-space: nowrap; }.stage-source b { color: var(--blue-600); font-size: 9px; font-weight: normal; }
.flow-arrow { position: absolute; z-index: 3; top: 112px; right: 1px; display: flex; align-items: center; width: 17px; color: var(--blue-600); pointer-events: none; }.flow-arrow i { width: 10px; height: 2px; background: #8db7da; }.flow-arrow span { margin-left: -2px; font-size: 12px; }
.summary-strip { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); margin-top: 14px; border: 1px solid var(--line); border-left: 4px solid var(--blue-800); border-radius: 3px; background: #fff; }
.summary-strip > div { min-height: 88px; padding: 13px 16px; border-left: 1px solid #dde6ed; }.summary-strip > div:first-child { border-left: 0; }.summary-strip span, .summary-strip strong, .summary-strip small { display: block; }.summary-strip span { color: var(--muted); font-size: 10px; }.summary-strip strong { margin: 5px 0 3px; color: var(--blue-900); font: bold 24px Consolas, monospace; }.summary-strip small { color: #8193a0; font-size: 8px; }
.danger-text { color: var(--red) !important; }.warning-text { color: var(--yellow) !important; }
.dashboard-grid { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 14px; margin-top: 14px; }
.panel { min-width: 0; padding: 17px 18px; border: 1px solid var(--line); border-radius: 3px; background: var(--panel); box-shadow: 0 2px 7px rgba(18,58,91,.035); }.production-panel { grid-column: span 7; }.equipment-panel { grid-column: span 5; }.logistics-panel { grid-column: span 5; }.exception-panel { grid-column: span 7; }.trace-panel { grid-column: 1 / -1; }
.panel-heading { align-items: flex-end; padding-bottom: 10px; border-bottom: 1px solid #dce6ed; }.panel-heading h2 { font-size: 17px; }.panel-heading > small, .panel-heading > b { color: var(--muted); font-size: 9px; font-weight: normal; }.panel-heading > b { padding: 4px 7px; color: var(--blue-800); border: 1px solid #a9c4da; background: #f0f7fc; }.panel-heading > b.danger { color: var(--red); border-color: #e3afb3; background: #fff4f4; }
.quality-layout { display: grid; grid-template-columns: 1.2fr 1fr; gap: 18px; margin-top: 15px; }.rate-number { display: flex; align-items: baseline; gap: 9px; }.rate-number strong { color: var(--blue-800); font: bold 29px Consolas, monospace; }.rate-number span { color: var(--muted); font-size: 10px; }.rate-track { height: 9px; margin-top: 8px; overflow: hidden; background: #e4ecf2; }.rate-track i { display: block; height: 100%; background: var(--green); }.quality-rate p { margin: 7px 0 0; color: var(--muted); font-size: 9px; }
.production-breakdown { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: var(--line); }.production-breakdown div { min-height: 54px; padding: 9px; background: #f7fafc; }.production-breakdown span, .production-breakdown b { display: block; }.production-breakdown span { color: var(--muted); font-size: 8px; }.production-breakdown b { margin-top: 5px; color: var(--blue-900); font: bold 15px Consolas, monospace; }
.defect-list { margin-top: 14px; }.subheading { display: flex; justify-content: space-between; margin-bottom: 8px; }.subheading b { font-size: 11px; }.subheading span { color: var(--muted); font-size: 8px; }.defect-row { display: grid; grid-template-columns: 100px minmax(0,1fr) 25px; gap: 10px; align-items: center; min-height: 24px; }.defect-row span { color: var(--muted); font-size: 9px; }.defect-row > div { height: 6px; background: #e7edf2; }.defect-row i { display: block; height: 100%; background: var(--red); }.defect-row b { color: var(--red); font: 10px Consolas, monospace; }.empty-inline { padding: 12px; color: var(--muted); background: #f6f9fb; font-size: 9px; text-align: center; }
.equipment-kpis { display: grid; grid-template-columns: repeat(3,1fr); gap: 1px; margin-top: 14px; background: var(--line); }.equipment-kpis div { padding: 10px; background: #f7fafc; }.equipment-kpis span, .equipment-kpis strong, .equipment-kpis small { display: block; }.equipment-kpis span { color: var(--muted); font-size: 8px; }.equipment-kpis strong { margin: 5px 0 2px; color: var(--blue-800); font: bold 19px Consolas, monospace; }.equipment-kpis small { color: #8596a3; font-size: 7px; }
.constraint-box { margin-top: 12px; padding: 11px 12px; border-left: 3px solid var(--green); background: #f2f8f5; }.constraint-box.active { border-left-color: var(--yellow); background: #fff9ee; }.constraint-box span, .constraint-box strong { display: block; }.constraint-box span { color: var(--muted); font-size: 8px; }.constraint-box strong { margin-top: 3px; font-size: 13px; }.constraint-box p { margin: 5px 0 0; color: #6c7f8e; font-size: 8px; line-height: 1.5; }
.buffer-list { margin-top: 10px; }.buffer-list > div { display: grid; grid-template-columns: 92px minmax(0,1fr) 34px; gap: 8px; align-items: center; min-height: 20px; }.buffer-list span { overflow: hidden; color: var(--muted); font-size: 8px; text-overflow: ellipsis; white-space: nowrap; }.buffer-list > div > div { height: 5px; background: #e5edf3; }.buffer-list i { display: block; height: 100%; min-width: 0; background: var(--green); }.buffer-list i.warning { background: var(--yellow); }.buffer-list i.danger { background: var(--red); }.buffer-list b { color: #5e7487; font: 8px Consolas, monospace; text-align: right; }
.logistics-kpis { display: grid; grid-template-columns: repeat(4,1fr); gap: 1px; margin-top: 14px; background: var(--line); }.logistics-kpis > div { padding: 10px; background: #f7fafc; }.logistics-kpis span, .logistics-kpis strong, .logistics-kpis small { display: block; }.logistics-kpis span { color: var(--muted); font-size: 8px; }.logistics-kpis strong { margin: 5px 0 2px; color: var(--blue-800); font: bold 19px Consolas, monospace; }.logistics-kpis small { color: #8596a3; font-size: 7px; }
.latest-logistics { display: grid; grid-template-columns: repeat(4,1fr); gap: 1px; margin-top: 11px; background: #dce6ed; }.latest-logistics div { padding: 8px; background: #fff; }.latest-logistics span, .latest-logistics b { display: block; }.latest-logistics span { color: var(--muted); font-size: 8px; }.latest-logistics b { margin-top: 4px; font: bold 10px Consolas, monospace; }
.warehouse-safety { display: grid; grid-template-columns: 9px minmax(0,1fr) auto; gap: 9px; align-items: center; margin-top: 11px; padding: 10px; background: #eef7f2; }.warehouse-safety > i { width: 8px; height: 8px; border-radius: 50%; background: var(--green); }.warehouse-safety > i.alarm { background: var(--red); }.warehouse-safety span, .warehouse-safety strong { display: block; }.warehouse-safety span { color: var(--muted); font-size: 8px; }.warehouse-safety strong { margin-top: 2px; color: var(--green); font: bold 10px Consolas, monospace; }.warehouse-safety p { margin: 0; color: #567083; font: 9px Consolas, monospace; }
.safe-state { display: flex; align-items: center; gap: 10px; min-height: 76px; margin-top: 12px; padding: 12px; border-left: 3px solid var(--green); background: #eef7f2; }.safe-state > i { width: 9px; height: 9px; border-radius: 50%; background: var(--green); }.safe-state strong, .safe-state span { display: block; }.safe-state strong { font-size: 11px; }.safe-state span { margin-top: 3px; color: var(--muted); font-size: 8px; }
.exception-row { display: grid; grid-template-columns: 8px minmax(130px,1.3fr) minmax(100px,.9fr) minmax(100px,1fr) auto; gap: 10px; align-items: center; min-height: 52px; border-bottom: 1px solid #e4ebf0; }.exception-row > i { width: 7px; height: 7px; border-radius: 50%; background: var(--red); }.exception-row strong, .exception-row span, .exception-row small, .exception-row b { display: block; }.exception-row > div > strong { color: var(--red); font-size: 10px; }.exception-row span, .exception-row small { margin-top: 2px; color: var(--muted); font-size: 8px; }.exception-row b { margin-top: 3px; color: var(--text); font-size: 9px; font-weight: normal; }.exception-row > strong { max-width: 140px; overflow: hidden; color: var(--red); font: 9px Consolas, monospace; text-overflow: ellipsis; white-space: nowrap; }.more-row { padding: 8px; color: var(--muted); font-size: 8px; text-align: center; }
.trace-table { margin-top: 10px; overflow-x: auto; }.trace-head, .trace-row { display: grid; grid-template-columns: minmax(210px,1.5fr) 90px 120px 100px minmax(150px,1fr) 150px; min-width: 850px; gap: 10px; align-items: center; }.trace-head { min-height: 30px; padding: 0 10px; color: #627a8d; background: #eaf1f6; font-size: 8px; }.trace-row { min-height: 39px; padding: 0 10px; border-bottom: 1px solid #e2e9ef; font-size: 9px; }.trace-row > b { overflow: hidden; color: var(--blue-800); font: 9px Consolas, monospace; text-overflow: ellipsis; white-space: nowrap; }.trace-row > span { color: #455f73; }.trace-row > span:nth-child(4) { display: flex; align-items: center; gap: 6px; }.trace-row span i { width: 7px; height: 7px; border-radius: 50%; background: #8799a6; }.trace-row span i.running { background: var(--green); }.trace-row span i.passed { background: var(--blue-600); }.trace-row span i.danger { background: var(--red); }.trace-row span i.warning { background: var(--yellow); }.trace-row time { color: var(--muted); font: 8px Consolas, monospace; }.empty-table { min-width: 850px; padding: 20px; color: var(--muted); text-align: center; font-size: 9px; }
@media (max-width: 1200px) { .factory-screen { padding: 22px 20px 34px; }.summary-strip { grid-template-columns: repeat(3,1fr); }.summary-strip > div:nth-child(4) { border-left: 0; border-top: 1px solid #dde6ed; }.summary-strip > div:nth-child(5), .summary-strip > div:nth-child(6) { border-top: 1px solid #dde6ed; }.production-panel, .equipment-panel, .logistics-panel, .exception-panel { grid-column: 1 / -1; } }
@media (max-width: 760px) { .factory-screen { padding: 16px 11px 28px; }.screen-header, .section-heading { align-items: flex-start; flex-direction: column; }.header-status { min-width: 0; width: 100%; text-align: left; }.connection-list { justify-content: flex-start; }.title-block h1 { font-size: 25px; }.flow-track { grid-template-columns: repeat(9, 182px); min-width: 1638px; }.summary-strip { grid-template-columns: repeat(2,1fr); }.summary-strip > div:nth-child(odd) { border-left: 0; }.summary-strip > div:nth-child(n+3) { border-top: 1px solid #dde6ed; }.quality-layout { grid-template-columns: 1fr; }.logistics-kpis { grid-template-columns: repeat(2,1fr); }.latest-logistics { grid-template-columns: repeat(2,1fr); }.exception-row { grid-template-columns: 8px minmax(0,1fr) auto; padding: 8px 0; }.exception-row > div:nth-of-type(2), .exception-row > div:nth-of-type(3) { display: none; }.warehouse-safety { grid-template-columns: 9px 1fr; }.warehouse-safety p { grid-column: 2; }.panel { padding: 15px 12px; } }
</style>

<style scoped>
.critical-readings { display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); gap:1px; margin-top:10px; background:#c8d6e2; }
.critical-readings > div { position:relative; min-width:0; min-height:52px; padding:7px 8px 6px 11px; border-left:3px solid #238b5a; background:#f7fafc; }
.critical-readings > div.waiting { border-left-color:#8296a5; }.critical-readings > div.danger { border-left-color:#c83f49; background:#fff4f4; }
.critical-readings span,.critical-readings strong,.critical-readings small { display:block; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.critical-readings span { color:#61788b; font-size:8px; }.critical-readings strong { margin-top:3px; color:#123a5b; font:700 12px Consolas,monospace; }.critical-readings small { margin-top:2px; color:#8092a0; font-size:7px; }
.critical-readings .danger strong { color:#c83f49; }

@media (min-width:1500px) and (min-height:850px) {
	.factory-screen { padding:12px 16px 18px; }
	.screen-header { min-height:74px; padding:11px 16px 10px; }.title-block h1 { margin:3px 0; font-size:25px; }.title-block p { font-size:11px; }.eyebrow { font-size:9px; }.header-status { min-width:470px; }.line-state { margin-bottom:5px; }.connection-list span { min-height:23px; padding:3px 7px; font-size:8px; }.header-status > small { margin-top:4px; font-size:8px; }
	.process-section { margin-top:9px; padding:9px 10px 8px; }.section-heading { padding-bottom:7px; }.section-heading h2 { margin:2px 0; font-size:15px; }.section-heading p { font-size:9px; }.flow-legend { gap:9px; font-size:8px; }
	.flow-scroll { margin-top:8px; overflow-x:hidden; }.flow-track { grid-template-columns:repeat(9,minmax(0,1fr)); min-width:0; padding-bottom:0; }.stage-wrap { padding-right:10px; }.stage-card { height:174px; padding:8px; }.stage-card-head > span { font-size:8px; }.stage-card-head b { font-size:8px; }.stage-card h3 { min-height:28px; margin:6px 0 4px; font-size:13px; }.stage-main-value { padding:5px 0; }.stage-main-value strong { font-size:14px; }.stage-main-value span { margin-top:1px; font-size:7px; }.stage-card dl { gap:3px 6px; margin-top:5px; }.stage-card dt { font-size:7px; }.stage-card dl dd { margin-top:1px; font-size:8px; }.stage-source { padding-top:5px; }.stage-source > span,.stage-source b { font-size:7px; }.flow-arrow { top:81px; right:0; width:10px; }.flow-arrow i { width:6px; }
	.summary-strip { margin-top:8px; }.summary-strip > div { min-height:58px; padding:7px 12px; }.summary-strip span { font-size:8px; }.summary-strip strong { margin:3px 0 1px; font-size:19px; }.summary-strip small { font-size:7px; }
	.dashboard-grid { grid-template-columns:repeat(12,minmax(0,1fr)); grid-template-rows:276px 204px; gap:8px; margin-top:8px; }.panel { padding:10px; overflow:hidden; }.production-panel { grid-column:1 / 5; grid-row:1; }.equipment-panel { grid-column:5 / 9; grid-row:1; }.logistics-panel { grid-column:9 / 13; grid-row:1; }.exception-panel { grid-column:1 / 6; grid-row:2; }.trace-panel { grid-column:6 / 13; grid-row:2; }
	.panel-heading { min-height:40px; margin:-10px -10px 7px; padding:7px 10px 6px; align-items:center; }.panel-heading h2 { margin:2px 0 0; font-size:14px; }.panel-heading > div > span { font-size:8px; }.panel-heading > small,.panel-heading > b { font-size:7px; }
	.quality-layout { grid-template-columns:1.15fr 1fr; gap:8px; margin-top:6px; }.rate-number { gap:5px; }.rate-number strong { font-size:20px; }.rate-number span { font-size:8px; }.rate-track { height:6px; margin-top:4px; }.quality-rate p { margin-top:4px; font-size:7px; }.production-breakdown div { min-height:35px; padding:5px 6px; }.production-breakdown span { font-size:7px; }.production-breakdown b { margin-top:2px; font-size:11px; }
	.critical-readings { grid-template-columns:repeat(3,1fr); margin-top:6px; }.critical-readings > div { min-height:36px; padding:4px 5px 3px 8px; }.critical-readings span { font-size:7px; }.critical-readings strong { margin-top:1px; font-size:10px; }.critical-readings small { margin-top:1px; font-size:6px; }
	.defect-list { margin-top:6px; }.subheading { margin-bottom:3px; }.subheading b { font-size:8px; }.subheading span { font-size:7px; }.defect-row { grid-template-columns:70px minmax(0,1fr) 18px; gap:6px; min-height:15px; }.defect-row span,.defect-row b { font-size:7px; }.defect-row > div { height:4px; }.empty-inline { padding:6px; font-size:7px; }
	.equipment-kpis { margin-top:5px; }.equipment-kpis div { padding:5px 7px; }.equipment-kpis span,.equipment-kpis small { font-size:7px; }.equipment-kpis strong { margin:2px 0 1px; font-size:14px; }.constraint-box { margin-top:6px; padding:6px 8px; }.constraint-box span,.constraint-box p { font-size:7px; }.constraint-box strong { margin-top:1px; font-size:10px; }.constraint-box p { margin-top:2px; line-height:1.25; }.buffer-list { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:1px 8px; margin-top:5px; }.buffer-list > div { grid-template-columns:52px minmax(0,1fr) 22px; gap:4px; min-height:16px; }.buffer-list span,.buffer-list b { font-size:6px; }.buffer-list > div > div { height:4px; }
	.logistics-kpis { margin-top:5px; }.logistics-kpis > div { padding:6px; }.logistics-kpis span,.logistics-kpis small { font-size:7px; }.logistics-kpis strong { margin:2px 0 1px; font-size:14px; }.latest-logistics { margin-top:7px; }.latest-logistics div { padding:5px; }.latest-logistics span { font-size:7px; }.latest-logistics b { margin-top:2px; font-size:8px; }.warehouse-safety { margin-top:7px; padding:7px; }.warehouse-safety span { font-size:7px; }.warehouse-safety strong,.warehouse-safety p { font-size:8px; }
	.exception-row { grid-template-columns:7px minmax(115px,1.3fr) minmax(90px,.9fr) minmax(90px,1fr) auto; min-height:42px; }.exception-row > div > strong { font-size:8px; }.exception-row span,.exception-row small,.exception-row b,.exception-row > strong { font-size:7px; }.more-row { padding:5px; font-size:7px; }
	.trace-table { margin-top:4px; }.trace-head,.trace-row { grid-template-columns:minmax(155px,1.4fr) 65px 85px 78px minmax(105px,1fr) 110px; min-width:0; gap:6px; }.trace-head { min-height:23px; padding:0 7px; font-size:7px; }.trace-row { min-height:26px; padding:0 7px; font-size:7px; }.trace-row > b,.trace-row time { font-size:7px; }.empty-table { min-width:0; padding:10px; font-size:7px; }
}

@media (max-width:900px) { .critical-readings { grid-template-columns:repeat(3,1fr); } }
@media (max-width:520px) { .critical-readings { grid-template-columns:repeat(2,1fr); } }
</style>

<style scoped>
/* 深蓝标题带和钢板式分隔线让浅色界面保留设备控制室的重量感。 */
.factory-screen { background-color:#e3edf4; }
.screen-header { padding:20px 22px 18px; border:1px solid #0f3654; border-bottom:5px solid #0b4d7b; background:#123a5b; box-shadow:0 4px 0 rgba(18,58,91,.12); }
.eyebrow { color:#a9cde6; }.title-block h1 { color:#fff; }.title-block p { color:#d2e0eb; }.line-state span { color:#bbd1df; }.line-state strong { color:#fff; }.header-status > small { color:#c2d4e1; }.connection-list span { border-color:#b9cad7; }
.process-section { border-width:1px 1px 3px; border-color:#9cb5c8; border-top-color:#145da0; box-shadow:0 3px 0 rgba(18,58,91,.08); }.section-heading { padding-bottom:12px; border-bottom:2px solid #c5d6e2; }.section-heading h2 { font-size:19px; }.section-heading > div > span { font-weight:bold; }
.stage-card { border-width:1px 1px 2px; background:#f8fbfd; }.stage-card h3 { font-size:16px; }.stage-card dl dd { font-size:10px; }.stage-source b { font-weight:bold; }
.summary-strip { border-width:1px 1px 3px; border-color:#9cb5c8; border-left-color:#145da0; box-shadow:0 3px 0 rgba(18,58,91,.08); }.summary-strip > div { background:#fff; }.summary-strip strong { font-size:25px; }
.panel { border-width:1px 1px 2px; border-color:#a8bece; }.panel-heading { margin:-17px -18px 12px; padding:11px 18px 9px; border-bottom:2px solid #c4d6e2; background:#edf4f9; }.panel-heading h2 { font-size:18px; }.quality-layout,.equipment-kpis,.logistics-kpis { margin-top:15px; }
@media (max-width:760px) { .screen-header { padding:17px 14px; }.panel-heading { margin:-15px -12px 12px; padding:10px 12px 8px; } }
@media (min-width:1500px) and (min-height:850px) {
	.screen-header { padding:11px 16px 10px; }
	.section-heading { padding-bottom:7px; }.section-heading h2 { font-size:15px; }
	.stage-card h3 { font-size:13px; }.stage-card dl dd { font-size:8px; }
	.summary-strip strong { font-size:19px; }
	.panel-heading { margin:-10px -10px 7px; padding:7px 10px 6px; }.panel-heading h2 { font-size:14px; }
	.quality-layout,.equipment-kpis,.logistics-kpis { margin-top:5px; }
}
</style>
