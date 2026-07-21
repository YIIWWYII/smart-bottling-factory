const STAGE_RUNTIME = {
	PRETREATMENT: { nominalSpeedMps: .12, pathLengthM: .96 },
	GAS_INSPECTION: { nominalSpeedMps: .10, pathLengthM: .80 },
	APPEARANCE_INSPECTION: { nominalSpeedMps: .18, pathLengthM: .90 },
	BEVERAGE_READY: { nominalSpeedMps: .08, pathLengthM: .96, useRecipeSpeed: false },
	FILLING: { nominalSpeedMps: .12, pathLengthM: .84 },
	SECONDARY_INSPECTION: { nominalSpeedMps: .16, pathLengthM: .96 },
	PACKING: { nominalSpeedMps: .08, pathLengthM: .96, useRecipeSpeed: false },
	AGV_TRANSPORT: { nominalSpeedMps: 1, pathLengthM: 10, useRecipeSpeed: false },
	WAREHOUSE_INBOUND: { nominalSpeedMps: .10, pathLengthM: 1, useRecipeSpeed: false }
}

function number(value, fallback = 0) {
	const parsed = Number(value)
	return Number.isFinite(parsed) ? parsed : fallback
}

function timestamp(value, fallback = 0) {
	const parsed = value ? new Date(value).getTime() : NaN
	return Number.isFinite(parsed) ? parsed : fallback
}

function parsePayload(value) {
	try { return JSON.parse(value || '{}') } catch (error) { return {} }
}

function latest(items, timeField) {
	return (items || []).slice().sort((a, b) => timestamp(b[timeField]) - timestamp(a[timeField]))[0] || null
}

function latestRecipeCommand(operations) {
	return latest((operations.commands || []).filter(item => item.commandType === 'SET_RECIPE' && item.status === 'SUCCEEDED'), 'acknowledgedAt')
}

function selectedAgvTask(logistics) {
	const tasks = logistics.tasks || []
	return latest(tasks.filter(item => item.status === 'RUNNING'), 'updatedAt') || latest(tasks, 'updatedAt')
}

function clamp(value, min, max) { return Math.min(max, Math.max(min, value)) }

const STOPPED_PRODUCT_PROGRESS = {
	hold: .58,
	rejected: .82
}

export function buildFactoryRuntime({ stage, operations = {}, logistics = {}, runtimeSnapshot = {}, running = false }) {
	const config = STAGE_RUNTIME[stage.code] || { nominalSpeedMps: .12, pathLengthM: .84 }
	const recipeCommand = latestRecipeCommand(operations)
	const recipe = recipeCommand ? parsePayload(recipeCommand.payload) : {}
	let speedMps = config.nominalSpeedMps
	let pathLengthM = config.pathLengthM
	let source = 'SIMULATION 工位配置'
	let mode = 'SIMULATION'
	let anchorMs = 0
	let fixedProgress = null
	let runtimeRunning = running
	let status = running ? 'RUNNING' : 'STANDBY'
	const runtimeDevices = (runtimeSnapshot.devices || []).filter(item => item.stageCode === stage.code)
	const mqttDevice = runtimeDevices.find(item => item.source === 'MQTT' && !item.fallback)
	const fallbackDevice = runtimeDevices.find(item => item.source === 'SIMULATION')
	const runtimeStage = (runtimeSnapshot.stages || []).find(item => item.stageCode === stage.code)

	if (config.useRecipeSpeed !== false && number(recipe.conveyorSpeedMmS) > 0) {
		speedMps = number(recipe.conveyorSpeedMmS) / 1000
		source = 'SIMULATION / ' + (recipeCommand.source || 'AI_VALIDATED') + ' 配方指令'
		anchorMs = timestamp(recipeCommand.acknowledgedAt || recipeCommand.createdAt)
	}

	if (mqttDevice) {
		speedMps = Math.max(0, number(mqttDevice.speedMps, speedMps))
		mode = 'REAL'
		source = 'MQTT 设备遥测'
		anchorMs = timestamp(mqttDevice.occurredAt, timestamp(runtimeSnapshot.generatedAt))
		if (speedMps > 0 && mqttDevice.progress != null) anchorMs -= clamp(number(mqttDevice.progress), 0, 1) * (pathLengthM / speedMps) * 1000
	} else if (fallbackDevice && !recipeCommand) {
		speedMps = Math.max(0, number(fallbackDevice.speedMps, speedMps))
		source = 'SIMULATION 自动兜底'
		anchorMs = timestamp(runtimeSnapshot.generatedAt)
	}

	if (runtimeStage && runtimeStage.state !== 'RUNNING') {
		runtimeRunning = false
		speedMps = 0
		status = runtimeStage.state
		source += ' / 工位隔离'
	}

	if (stage.code === 'AGV_TRANSPORT') {
		const task = selectedAgvTask(logistics)
		if (task) {
			pathLengthM = Math.max(.1, number(task.totalDistanceM, config.pathLengthM))
			const reportedProgress = clamp(number(task.completedDistanceM) / pathLengthM, 0, 1)
			runtimeRunning = task.status === 'RUNNING'
			speedMps = runtimeRunning ? Math.max(0, number(task.speedMps)) : 0
			mode = task.mode || 'SIMULATION'
			source = mode + ' AGV 调度报文'
			anchorMs = timestamp(task.updatedAt || task.createdAt)
			if (runtimeRunning && speedMps > 0) anchorMs -= reportedProgress * (pathLengthM / speedMps) * 1000
			else fixedProgress = reportedProgress
			status = task.status || (runtimeRunning ? 'RUNNING' : 'STANDBY')
		}
	}

	const cycleSeconds = speedMps > 0 ? pathLengthM / speedMps : 0
	const motionScale = runtimeRunning && speedMps > 0 ? clamp(speedMps / config.nominalSpeedMps, .2, 2.5) : 0
	return {
		stageCode: stage.code,
		mode,
		source,
		status,
		running: runtimeRunning,
		speedMps,
		nominalSpeedMps: config.nominalSpeedMps,
		pathLengthM,
		cycleSeconds,
		motionScale,
		anchorMs,
		fixedProgress,
		speedDisplay: stage.code === 'AGV_TRANSPORT' ? speedMps.toFixed(2) + ' m/s' : Math.round(speedMps * 1000) + ' mm/s',
		pathDisplay: pathLengthM.toFixed(pathLengthM < 1 ? 2 : 1) + ' m',
		cycleDisplay: cycleSeconds > 0 ? cycleSeconds.toFixed(1) + ' s' : '已停止',
		signature: [stage.code, speedMps, pathLengthM, runtimeRunning, status, anchorMs, fixedProgress].join('|')
	}
}

export function runtimeProgressAt(runtime, timeMs, index = 0, count = 1) {
	if (!runtime) return 0
	if (runtime.fixedProgress != null) return clamp(runtime.fixedProgress, 0, 1)
	if (!runtime.running || !runtime.cycleSeconds) return 0
	const elapsedSeconds = (timeMs - (runtime.anchorMs || 0)) / 1000
	const spacing = count > 0 ? index / count : 0
	const value = elapsedSeconds / runtime.cycleSeconds + spacing
	return ((value % 1) + 1) % 1
}

export function runtimeProductProgressAt(runtime, timeMs, product = {}, index = 0, count = 1) {
	const stoppedProgress = STOPPED_PRODUCT_PROGRESS[product.visualStatus]
	if (stoppedProgress != null) return stoppedProgress
	return runtimeProgressAt(runtime, timeMs, index, count)
}

export function runtimeDeviceActivityAt(runtime, timeMs, deviceIndex, deviceCount, products = []) {
	if (!runtime || !runtime.running || !deviceCount || !products.length) return 0
	const target = (deviceIndex + 1) / (deviceCount + 1)
	const radius = Math.max(.055, Math.min(.12, .48 / (deviceCount + 1)))
	let activity = 0
	const count = Math.max(1, products.length)
	products.forEach((product, index) => {
		if (product.visualStatus === 'rejected' && target < .7) return
		const progress = runtimeProductProgressAt(runtime, timeMs, product, index, count)
		const distance = Math.abs(progress - target)
		activity = Math.max(activity, clamp(1 - distance / radius, 0, 1))
	})
	return Number(activity.toFixed(3))
}

export function runtimeDuration(baseSeconds, runtime) {
	const scale = runtime && runtime.motionScale ? runtime.motionScale : 1
	return Math.max(.18, baseSeconds / scale).toFixed(3) + 's'
}
