<template>
	<div class="plan-view" :class="['stage-' + stage.code.toLowerCase(), { stopped: !running, editing: editMode, paused, 'state-colors': stateColors }]" :style="runtimeStyle">
		<div class="plan-header">
			<div><b>{{ visual.title }}</b><span>二维工艺布置示意</span></div>
			<div class="plan-actions">
				<small>{{ editMode ? '当前工位布局编辑中' : '点击设备查看档案 · 非工程施工图' }}</small>
				<div v-if="stateColors" class="state-legend"><span class="running">运行</span><span class="hold">待处理</span><span class="rejected">异常</span><span class="passed">通过</span></div>
				<button type="button" :class="{ active: editMode }" :title="editMode ? '保存当前位置并退出编辑' : '拖拽调整当前工位设备位置'" @click="toggleEdit"><i :class="editMode ? 'el-icon-check' : 'el-icon-edit'"></i>{{ editMode ? '完成' : '布局编辑' }}</button>
				<button type="button" title="清除当前工位的自定义位置" @click="resetLayout"><i class="el-icon-refresh-left"></i>恢复默认</button>
			</div>
		</div>
		<div class="plan-canvas" :class="routeMode">
			<div class="factory-zone"><span>设备作业边界</span></div>
			<div class="process-pipe" :class="routeMode"><i></i></div>
			<div class="flow-caption input">{{ visual.material }}</div>
			<div class="flow-caption output">{{ visual.output }}</div>
			<button v-for="(product, index) in products.slice(0, 6)" :key="product.traceCode + '-' + animationRevision" type="button" class="material-token" :class="[materialShape, product.visualStatus]" :style="materialStyle(index)" :title="product.traceCode" @click.stop="$emit('select-product', product)"><i></i><span>{{ shortCode(product.traceCode) }}</span></button>
			<div v-if="!products.length" class="no-products">等待带追踪码的产品进入本工位</div>
			<button v-for="(device, index) in stage.devices" :key="device.code" type="button" class="device-node" :class="[deviceVisual(index).visual, deviceState(index), { dragging: dragging && dragging.index === index, 'linked-trigger': deviceIsTriggered(index), 'linked-active': deviceIsActive(index) }]" :style="nodeStyle(index)" @pointerdown="startDrag($event, index)" @click="selectDevice(device, index)">
				<span class="node-number">{{ String(index + 1).padStart(2, '0') }}</span>
				<div class="device-symbol"><i></i><i></i><i></i><i></i><span></span></div>
				<div class="node-copy"><strong>{{ device.name }}</strong><small>{{ device.code }}</small><b><i></i>{{ deviceOperationLabel(index) }}</b></div>
			</button>
			<div v-if="stage.code === 'APPEARANCE_INSPECTION' || stage.code === 'SECONDARY_INSPECTION'" class="scan-zone"><i></i><span>视觉检测区</span></div>
			<div v-if="stage.code === 'PACKING'" class="packing-box"><i></i><i></i><i></i><i></i><span>装箱位</span></div>
			<div v-if="stage.code === 'WAREHOUSE_INBOUND'" class="warehouse-lanes"><i></i><i></i><i></i><span>库位区</span></div>
		</div>
		<div class="plan-footer"><div><span>投入</span><b>{{ visual.material }}</b></div><i>→</i><div><span>设备联动</span><b>{{ activeDeviceNames }}</b></div><i>→</i><div><span>产出</span><b>{{ visual.output }}</b></div></div>
		<div v-if="products.length" class="plan-product-strip"><button v-for="product in products.slice(0,6)" :key="product.traceCode" type="button" @click="$emit('select-product', product)"><i :class="stateColors ? product.visualStatus : 'neutral'"></i><span><b>{{ product.traceCode }}</b><small>{{ product.bottleType || '待识别' }} · {{ product.statusLabel }}</small></span></button></div>
	</div>
</template>

<script>
import { findFactoryVisual } from '@/config/factoryVisuals.js'
import { runtimeDuration, runtimeProductProgressAt } from '@/config/factoryRuntime.js'

const TRIGGERED_VISUALS = new Set(['positioner', 'chamber', 'camera-top', 'camera-side', 'camera-bottom', 'camera-level', 'light-ring', 'light-panel', 'reject', 'filler', 'robot', 'gripper', 'printer', 'counter', 'location-light'])
export default {
	name: 'StagePlanView',
	props: {
		stage: { type: Object, required: true }, running: Boolean, paused: Boolean, stateColors: Boolean,
		products: { type: Array, default: () => [] }, alarmCount: { type: Number, default: 0 },
		runtime: { type: Object, default: () => ({ running: false, cycleSeconds: 0, motionScale: 0 }) },
		nowMs: { type: Number, default: 0 }, deviceStates: { type: Array, default: () => [] }, deviceActivity: { type: Array, default: () => [] }
	},
	data() { return { editMode: false, positions: [], dragging: null, previousUserSelect: '', animationRevision: 0, motionAnchorMs: Date.now() } },
	computed: {
		visual() { return findFactoryVisual(this.stage.code) },
		runtimeStyle() {
			return {
				'--motion-fast': runtimeDuration(.75, this.runtime),
				'--motion-normal': runtimeDuration(1, this.runtime),
				'--motion-slow': runtimeDuration(1.45, this.runtime),
				'--motion-cycle': runtimeDuration(2.4, this.runtime)
			}
		},
		activeDeviceNames() { return this.stage.devices.map(item => item.name).join(' / ') },
		routeMode() {
			if (this.stage.code === 'BEVERAGE_READY') return 'liquid-route'
			if (this.stage.code === 'AGV_TRANSPORT') return 'agv-route'
			if (this.stage.code === 'WAREHOUSE_INBOUND') return 'warehouse-route'
			return 'conveyor-route'
		},
		materialShape() {
			if (this.stage.code === 'BEVERAGE_READY') return 'liquid'
			if (['AGV_TRANSPORT', 'WAREHOUSE_INBOUND'].includes(this.stage.code)) return 'carton'
			return 'bottle'
		}
	},
	mounted() { this.loadLayout(); if (this.paused) this.$nextTick(this.pauseAnimations) },
	beforeDestroy() { this.stopDrag(); this.saveLayout() },
	watch: { 'stage.code'() { this.stopDrag(); this.editMode = false; this.motionAnchorMs = Date.now(); this.loadLayout() }, 'runtime.signature'() { this.motionAnchorMs = Date.now(); this.animationRevision += 1 }, paused(value) { if (value) this.$nextTick(this.pauseAnimations); else { this.motionAnchorMs = Date.now(); this.animationRevision += 1 } } },
	methods: {
		deviceVisual(index) { return this.visual.devices[index] || { visual: 'cabinet', x: 20 + index * 15, y: 40, scale: 1 } },
		nodeStyle(index) { const item = this.deviceVisual(index); const position = this.positions[index] || item; return { left: position.x + '%', top: position.y + '%', '--scale': item.scale || 1 } },
		deviceState(index) { return this.deviceStates[index] || (this.alarmCount && index === this.stage.devices.length - 1 ? 'alarm' : this.running ? 'running' : 'standby') },
		deviceIsTriggered(index) { return TRIGGERED_VISUALS.has(this.deviceVisual(index).visual) },
		deviceIsActive(index) { return this.deviceState(index) === 'running' && (!this.deviceIsTriggered(index) || Number(this.deviceActivity[index]) > .02) },
		deviceOperationLabel(index) { if (this.deviceState(index) === 'alarm') return '报警停机'; if (!this.running || this.deviceState(index) === 'standby') return '待机'; if (!this.deviceIsTriggered(index)) return '连续运行'; return this.deviceIsActive(index) ? '联动动作' : '等待物料' },
		materialStyle(index) {
			const product = this.products[index] || {}
			if (product.visualStatus === 'hold' || product.visualStatus === 'rejected') return { left: (runtimeProductProgressAt(this.runtime, this.motionAnchorMs, product, index, Math.min(this.products.length, 6)) * 100) + '%', animation: 'none' }
			if (this.runtime.fixedProgress != null) return { left: (this.runtime.fixedProgress * 100) + '%', animation: 'none' }
			const duration = Math.max(.1, Number(this.runtime.cycleSeconds) || 7)
			const progress = runtimeProductProgressAt(this.runtime, this.runtime.frozenAtMs || this.motionAnchorMs, product, index, Math.min(this.products.length, 6))
			return { '--motion-duration': duration + 's', '--motion-delay': (-progress * duration) + 's' }
		},
		async pauseAnimations() { if (!this.$el || !this.$el.getAnimations) return; this.$el.getAnimations({ subtree: true }).forEach(animation => animation.updatePlaybackRate(0)); await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))) },
		pauseVisual() { return this.pauseAnimations() },
		shortCode(value) { const parts = String(value || '').split('-'); return parts.length > 2 ? parts.slice(-2).join('-') : value },
		storageKey() { return 'hdc_factory_plan_layout_' + this.stage.code },
		loadLayout() {
			try {
				const saved = JSON.parse(window.localStorage.getItem(this.storageKey()) || '[]')
				this.positions = Array.isArray(saved) ? saved : []
			} catch (error) { this.positions = [] }
		},
		saveLayout() {
			try { window.localStorage.setItem(this.storageKey(), JSON.stringify(this.positions)) } catch (error) {}
		},
		toggleEdit() { if (this.editMode) this.saveLayout(); this.editMode = !this.editMode },
		resetLayout() { this.stopDrag(); this.positions = []; try { window.localStorage.removeItem(this.storageKey()) } catch (error) {} },
		selectDevice(device, index) { if (!this.editMode) this.$emit('select-device', device, index) },
		startDrag(event, index) {
			if (!this.editMode || event.button !== 0) return
			event.preventDefault()
			const canvas = this.$el.querySelector('.plan-canvas')
			if (!canvas) return
			this.previousUserSelect = document.body.style.userSelect
			document.body.style.userSelect = 'none'
			this.dragging = { index, canvas, pointerId: event.pointerId }
			window.addEventListener('pointermove', this.moveDrag)
			window.addEventListener('pointerup', this.stopDrag)
			window.addEventListener('pointercancel', this.stopDrag)
			this.moveDrag(event)
		},
		moveDrag(event) {
			if (!this.dragging || event.pointerId !== this.dragging.pointerId) return
			const rect = this.dragging.canvas.getBoundingClientRect()
			const x = Math.min(94, Math.max(6, ((event.clientX - rect.left) / rect.width) * 100))
			const y = Math.min(84, Math.max(12, ((event.clientY - rect.top) / rect.height) * 100))
			this.$set(this.positions, this.dragging.index, { x: Number(x.toFixed(2)), y: Number(y.toFixed(2)) })
		},
		stopDrag(event) {
			if (event && this.dragging && event.pointerId !== this.dragging.pointerId) return
			if (this.dragging) this.saveLayout()
			this.dragging = null
			window.removeEventListener('pointermove', this.moveDrag)
			window.removeEventListener('pointerup', this.stopDrag)
			window.removeEventListener('pointercancel', this.stopDrag)
			if (document && document.body) document.body.style.userSelect = this.previousUserSelect
		}
	}
}
</script>

<style scoped>
.plan-view { color: #dce1e2; background: #111719; }
.plan-header { display: flex; justify-content: space-between; align-items: center; min-height: 48px; padding: 7px 15px; border: 1px solid #4a5357; border-bottom: 0; background: #20272a; }
.plan-header b, .plan-header span { display: block; }.plan-header b { font-size: 13px; }.plan-header span, .plan-header small { margin-top: 3px; color: #8e999d; font-size: 9px; }
.plan-actions { display: flex; align-items: center; justify-content: flex-end; gap: 7px; }.plan-actions small { margin: 0 5px 0 0; }.plan-actions button { display: inline-flex; align-items: center; gap: 5px; min-height: 30px; padding: 0 9px; color: #aeb6b8; border: 1px solid #5c666a; border-radius: 2px; background: #171d20; cursor: pointer; font-size: 9px; }.plan-actions button:hover { color: #e9aa24; border-color: #e9aa24; }.plan-actions button.active { color: #171c1e; border-color: #e9aa24; background: #e9aa24; font-weight: bold; }
.state-legend { display: flex; gap: 5px; }.state-legend span { padding: 3px 5px; color: #aeb6b8; border-left: 3px solid #7c878a; background: #171d20; font-size: 8px; }.state-legend .running { border-color: #54b975; }.state-legend .hold { border-color: #e9aa24; }.state-legend .rejected { border-color: #df5a52; }.state-legend .passed { border-color: #4c94ad; }
.plan-canvas { position: relative; height: clamp(430px, 52vw, 610px); min-height: 430px; overflow: hidden; border: 1px solid #4a5357; background-color: #151c1f; background-image: linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px); background-size: 28px 28px; }
.factory-zone { position: absolute; inset: 22px; border: 1px dashed #4c565a; pointer-events: none; }.factory-zone span { position: absolute; top: -8px; left: 12px; padding: 0 6px; color: #6f7a7e; background: #151c1f; font: 8px Consolas, monospace; }
.process-pipe { position: absolute; z-index: 1; left: 4%; right: 4%; top: 67%; height: 34px; border: 2px solid #697276; background: repeating-linear-gradient(90deg, #343c3f 0 18px, #1a2124 18px 25px); }.process-pipe::before, .process-pipe::after { content: ''; position: absolute; top: -7px; bottom: -7px; width: 2px; background: #8a9497; }.process-pipe::before { left: 0; }.process-pipe::after { right: 0; }.process-pipe > i { position: absolute; inset: 4px; border-top: 1px dashed #8b9497; border-bottom: 1px dashed #8b9497; }
.process-pipe.liquid-route { top: 68%; height: 18px; border-color: #65777d; border-radius: 9px; background: #25363b; }.process-pipe.liquid-route > i { inset: 5px; border: 0; border-top: 5px solid #31859a; }.process-pipe.liquid-route::before, .process-pipe.liquid-route::after { top: -4px; bottom: -4px; width: 8px; border: 2px solid #8d989b; border-radius: 2px; background: #30383b; }
.process-pipe.agv-route, .process-pipe.warehouse-route { top: 63%; height: 74px; border: 1px solid #806a2c; background: #252c2f; }.process-pipe.agv-route > i, .process-pipe.warehouse-route > i { inset: 35px 7px auto; border: 0; border-top: 2px dashed #d8a62f; }.process-pipe.agv-route::before, .process-pipe.agv-route::after, .process-pipe.warehouse-route::before, .process-pipe.warehouse-route::after { display: none; }
.flow-caption { position: absolute; z-index: 3; top: calc(67% + 43px); color: #a6afb2; font-size: 9px; }.flow-caption.input { left: 4%; }.flow-caption.output { right: 4%; text-align: right; }
.material-token { position: absolute; z-index: 6; left: -74px; top: calc(67% - 20px); width: 54px; height: 48px; padding: 0; color: #aeb6b8; border: 0; background: transparent; cursor: pointer; animation: planMaterial 7s linear infinite; animation-delay: var(--delay); }.material-token > span { position: absolute; left: 50%; bottom: -13px; max-width: 70px; padding: 2px 4px; overflow: hidden; color: #aeb6b8; background: rgba(17,23,25,.86); font: 7px Consolas, monospace; text-overflow: ellipsis; white-space: nowrap; transform: translateX(-50%); }.material-token i { position: absolute; left: 19px; bottom: 0; width: 16px; height: 31px; border: 2px solid #8f999c; border-radius: 5px 5px 3px 3px; background: rgba(143,153,156,.16); }.material-token i::before { content: ''; position: absolute; top: -8px; left: 3px; width: 6px; height: 7px; border: 2px solid currentColor; border-bottom: 0; }
.state-colors .material-token.running i { color: #54b975; border-color: #54b975; background: rgba(84,185,117,.2); }.state-colors .material-token.hold i { color: #e9aa24; border-color: #e9aa24; background: rgba(233,170,36,.2); }.state-colors .material-token.rejected i { color: #df5a52; border-color: #df5a52; background: rgba(223,90,82,.2); }.state-colors .material-token.passed i { color: #4c94ad; border-color: #4c94ad; background: rgba(76,148,173,.2); }
.material-token.liquid { top: calc(68% - 1px); width: 18px; height: 18px; }.material-token.liquid i { left: 0; width: 18px; height: 18px; border: 0; border-radius: 50%; background: #45a3b6; box-shadow: 0 0 0 3px rgba(69,163,182,.16); }.material-token.liquid i::before { display: none; }
.state-colors .material-token.liquid.running i { background: #54b975; }.state-colors .material-token.liquid.hold i { background: #e9aa24; }.state-colors .material-token.liquid.rejected i { background: #df5a52; }.state-colors .material-token.liquid.passed i { background: #4c94ad; }
.material-token.carton { top: calc(63% + 12px); width: 54px; height: 34px; }.material-token.carton i { left: 10px; width: 34px; height: 28px; border-color: #8f999c; border-radius: 1px; background: #4f585b; }.material-token.carton i::before { top: -2px; left: 15px; width: 2px; height: 28px; border: 0; background: currentColor; }.state-colors .material-token.carton.running i { background: #376e49; }.state-colors .material-token.carton.hold i { background: #755b22; }.state-colors .material-token.carton.rejected i { background: #713b37; }.state-colors .material-token.carton.passed i { background: #365d6b; }
.no-products { position: absolute; z-index: 4; left: 50%; top: calc(67% - 35px); padding: 6px 9px; color: #7f898d; border: 1px dashed #4e585c; background: #171e21; font-size: 8px; transform: translateX(-50%); }
.device-node { position: absolute; z-index: 5; width: 150px; min-height: 106px; padding: 9px; color: #dfe4e5; text-align: left; border: 1px solid #667075; border-left: 4px solid #4faa6e; border-radius: 2px; background: #242c2f; cursor: pointer; transform: translate(-50%, -50%) scale(var(--scale)); transform-origin: center; transition: border-color .16s ease, background .16s ease; }.device-node:hover { z-index: 9; border-color: #e9aa24; background: #2b3336; }.device-node.alarm { border-left-color: #df554e; }.device-node.standby { border-left-color: #737d80; }
.plan-view:not(.state-colors) .device-node { border-left-color: #737d80; }.state-colors .device-node.running { border-left-color: #54b975; }.state-colors .device-node.alarm { border-left-color: #df5a52; }.state-colors .device-node.standby { border-left-color: #7c878a; }
.device-node.linked-trigger:not(.linked-active) .device-symbol > *, .device-node.alarm .device-symbol > * { animation-play-state: paused !important; }
.device-node.linked-active { box-shadow: inset 0 0 0 1px rgba(233,170,36,.35), 0 0 14px rgba(233,170,36,.08); }
.device-node.linked-active .node-copy b { color: #e9aa24; }
.editing .device-node { cursor: grab; touch-action: none; outline: 1px dashed rgba(233,170,36,.55); outline-offset: 3px; }.editing .device-node:active, .editing .device-node.dragging { z-index: 12; cursor: grabbing; border-color: #e9aa24; box-shadow: 0 8px 20px rgba(0,0,0,.3); transition: none; }
.node-number { position: absolute; right: 7px; top: 6px; color: #7e898d; font: 8px Consolas, monospace; }.node-copy { margin-left: 45px; }.node-copy strong, .node-copy small, .node-copy b { display: block; }.node-copy strong { min-height: 30px; font-size: 11px; line-height: 1.4; }.node-copy small { color: #7f8a8e; font: 7px Consolas, monospace; }.node-copy b { display: flex; align-items: center; gap: 5px; margin-top: 8px; color: #64bd80; font-size: 8px; }.node-copy b i { width: 6px; height: 6px; border-radius: 50%; background: currentColor; animation: statusPulse 1.3s ease-in-out infinite; }.device-node.alarm .node-copy b { color: #ef635b; }
.plan-view:not(.state-colors) .node-copy b { color: #8f999c; }.state-colors .device-node.running .node-copy b { color: #54b975; }.state-colors .device-node.alarm .node-copy b { color: #df5a52; }.state-colors .device-node.standby .node-copy b { color: #8f999c; }
.device-symbol { position: absolute; left: 9px; top: 34px; width: 34px; height: 42px; color: #e9aa24; }.device-symbol > i, .device-symbol > span { position: absolute; display: block; border: 2px solid currentColor; }
.conveyor .device-symbol > i:nth-child(1), .positioner .device-symbol > i:nth-child(1) { left: 0; top: 14px; width: 34px; height: 14px; }.conveyor .device-symbol > i:nth-child(2), .positioner .device-symbol > i:nth-child(2) { left: 5px; top: 18px; width: 5px; height: 5px; border-radius: 50%; box-shadow: 9px 0 0 -1px #e9aa24, 18px 0 0 -1px #e9aa24; animation: rollerSpin .8s linear infinite; }
.washer .device-symbol > i:nth-child(1), .mixer .device-symbol > i:nth-child(1) { left: 4px; top: 5px; width: 26px; height: 32px; border-radius: 4px 4px 11px 11px; }.washer .device-symbol > i:nth-child(2), .mixer .device-symbol > i:nth-child(2) { left: 7px; top: 20px; width: 20px; height: 12px; border: 0; background: #3b8797; animation: liquidWave 1.5s ease-in-out infinite; }.mixer .device-symbol > i:nth-child(3) { left: 16px; top: 0; width: 2px; height: 28px; border: 0; background: #e9aa24; animation: mixerMove 1s ease-in-out infinite; }
.fan .device-symbol > i:nth-child(1) { left: 2px; top: 4px; width: 30px; height: 30px; border-radius: 50%; }.fan .device-symbol > span { left: 14px; top: 11px; width: 7px; height: 18px; border-radius: 50%; transform-origin: 3px 9px; animation: fanSpin .7s linear infinite; }
.plc .device-symbol > i:nth-child(1), .dispatch .device-symbol > i:nth-child(1), .printer .device-symbol > i:nth-child(1), .rack .device-symbol > i:nth-child(1) { left: 3px; top: 1px; width: 28px; height: 39px; }.plc .device-symbol > i:nth-child(2), .dispatch .device-symbol > i:nth-child(2) { left: 8px; top: 7px; width: 18px; height: 10px; border-color: #65b879; background: #17311f; }.plc .device-symbol > i:nth-child(3), .dispatch .device-symbol > i:nth-child(3) { left: 8px; top: 23px; width: 4px; height: 4px; border-radius: 50%; box-shadow: 9px 0 0 -1px #e9aa24; }
.chamber .device-symbol > i:nth-child(1) { left: 1px; top: 0; width: 32px; height: 40px; border-style: double; }.chamber .device-symbol > i:nth-child(2) { left: 8px; top: 8px; width: 18px; height: 22px; border-color: #5ab0bd; }.chamber .device-symbol > span { left: 13px; top: 16px; width: 8px; height: 13px; border-radius: 4px; animation: chamberPulse 1.4s ease-in-out infinite; }
.sensor .device-symbol > i:nth-child(1), .sensor-temp .device-symbol > i:nth-child(1), .sensor-hum .device-symbol > i:nth-child(1), .sensor-voc .device-symbol > i:nth-child(1), .sensor-smoke .device-symbol > i:nth-child(1), .level-sensor .device-symbol > i:nth-child(1), .ultrasonic .device-symbol > i:nth-child(1), .flowmeter .device-symbol > i:nth-child(1), .odometer .device-symbol > i:nth-child(1), .load-cell .device-symbol > i:nth-child(1), .counter .device-symbol > i:nth-child(1) { left: 13px; top: 14px; width: 8px; height: 25px; }.sensor .device-symbol > i:nth-child(2), .sensor-temp .device-symbol > i:nth-child(2), .sensor-hum .device-symbol > i:nth-child(2), .sensor-voc .device-symbol > i:nth-child(2), .sensor-smoke .device-symbol > i:nth-child(2), .level-sensor .device-symbol > i:nth-child(2), .ultrasonic .device-symbol > i:nth-child(2), .flowmeter .device-symbol > i:nth-child(2), .odometer .device-symbol > i:nth-child(2), .load-cell .device-symbol > i:nth-child(2), .counter .device-symbol > i:nth-child(2) { left: 8px; top: 3px; width: 18px; height: 18px; border-radius: 50%; animation: sensorPulse 1.4s ease-in-out infinite; }
.pump .device-symbol > i:nth-child(1) { left: 2px; top: 12px; width: 24px; height: 24px; border-radius: 50%; }.pump .device-symbol > i:nth-child(2) { right: 0; top: 20px; width: 11px; height: 8px; }.pump .device-symbol > span { left: 10px; top: 20px; width: 8px; height: 8px; border-radius: 50%; animation: fanSpin 1s linear infinite; }
.beacon .device-symbol > i:nth-child(1), .location-light .device-symbol > i:nth-child(1) { left: 13px; top: 13px; width: 9px; height: 27px; }.beacon .device-symbol > i:nth-child(2), .location-light .device-symbol > i:nth-child(2) { left: 8px; top: 0; width: 19px; height: 16px; border-radius: 8px 8px 2px 2px; background: rgba(233,170,36,.35); animation: beaconFlash 1s steps(2,end) infinite; }
.camera-top .device-symbol > i:nth-child(1), .camera-side .device-symbol > i:nth-child(1), .camera-bottom .device-symbol > i:nth-child(1), .camera-level .device-symbol > i:nth-child(1) { left: 2px; top: 7px; width: 25px; height: 20px; }.camera-top .device-symbol > i:nth-child(2), .camera-side .device-symbol > i:nth-child(2), .camera-bottom .device-symbol > i:nth-child(2), .camera-level .device-symbol > i:nth-child(2) { right: 0; top: 12px; width: 12px; height: 10px; border-radius: 50%; animation: cameraFocus 1.2s ease-in-out infinite; }
.light-ring .device-symbol > i:nth-child(1) { left: 2px; top: 4px; width: 30px; height: 30px; border-width: 5px; border-radius: 50%; animation: lightPulse 1.4s ease-in-out infinite; }.light-panel .device-symbol > i:nth-child(1) { left: 3px; top: 4px; width: 28px; height: 31px; background: rgba(233,170,36,.22); animation: lightPulse 1.4s ease-in-out infinite; }
.reject .device-symbol > i:nth-child(1) { left: 1px; top: 16px; width: 31px; height: 10px; }.reject .device-symbol > i:nth-child(2) { left: 24px; top: 11px; width: 8px; height: 20px; animation: rejectMove 1.5s ease-in-out infinite; }
.heater .device-symbol > i:nth-child(1) { left: 1px; top: 5px; width: 32px; height: 32px; }.heater .device-symbol > i:nth-child(2) { left: 8px; top: 14px; width: 18px; height: 15px; border: 0; background: repeating-linear-gradient(90deg,#d75a35 0 3px,transparent 3px 7px); animation: heaterGlow 1s ease-in-out infinite; }
.filler .device-symbol > i:nth-child(1) { left: 1px; top: 2px; width: 32px; height: 10px; }.filler .device-symbol > i:nth-child(2) { left: 7px; top: 11px; width: 3px; height: 23px; border: 0; background: #e9aa24; box-shadow: 9px 0 #e9aa24,18px 0 #e9aa24; animation: fillerMove 1.3s ease-in-out infinite; }
.robot .device-symbol > i:nth-child(1) { left: 3px; bottom: 1px; width: 27px; height: 8px; }.robot .device-symbol > i:nth-child(2) { left: 14px; top: 15px; width: 8px; height: 24px; transform-origin: bottom; animation: robotArm 2.4s ease-in-out infinite; }.robot .device-symbol > i:nth-child(3) { left: 14px; top: 7px; width: 23px; height: 8px; transform-origin: left; animation: robotForearm 2.4s ease-in-out infinite; }.gripper .device-symbol > i:nth-child(1) { left: 14px; top: 3px; width: 7px; height: 22px; }.gripper .device-symbol > i:nth-child(2), .gripper .device-symbol > i:nth-child(3) { top: 22px; width: 8px; height: 16px; }.gripper .device-symbol > i:nth-child(2) { left: 7px; transform: rotate(18deg); }.gripper .device-symbol > i:nth-child(3) { right: 6px; transform: rotate(-18deg); }
.agv .device-symbol > i:nth-child(1) { left: 0; top: 11px; width: 34px; height: 21px; }.agv .device-symbol > i:nth-child(2), .agv .device-symbol > i:nth-child(3) { top: 29px; width: 9px; height: 9px; border-radius: 50%; animation: rollerSpin .7s linear infinite; }.agv .device-symbol > i:nth-child(2) { left: 4px; }.agv .device-symbol > i:nth-child(3) { right: 4px; }
.printer .device-symbol > i:nth-child(2) { left: 8px; top: 17px; width: 18px; height: 17px; background: #e7e9e9; animation: printPaper 1.8s ease-in-out infinite; }.rack .device-symbol > i:nth-child(2), .rack .device-symbol > i:nth-child(3) { left: 3px; width: 28px; height: 2px; border: 0; background: #e9aa24; }.rack .device-symbol > i:nth-child(2) { top: 14px; }.rack .device-symbol > i:nth-child(3) { top: 27px; }
.scan-zone { position: absolute; z-index: 2; left: 25%; right: 22%; top: 25%; bottom: 23%; border: 1px dashed #56aebb; pointer-events: none; }.scan-zone i { position: absolute; left: 0; right: 0; top: 10%; height: 2px; background: rgba(86,174,187,.7); box-shadow: 0 0 8px #56aebb; animation: scanLine 2.2s linear infinite; }.scan-zone span, .packing-box span, .warehouse-lanes span { position: absolute; right: 5px; bottom: 4px; color: #67aab4; font-size: 8px; }
.packing-box { position: absolute; z-index: 2; right: 7%; bottom: 17%; width: 165px; height: 110px; border: 3px solid #8c6a2b; background: rgba(140,106,43,.16); }.packing-box > i { position: absolute; width: 20px; height: 34px; border: 2px solid #e9aa24; border-radius: 5px; }.packing-box > i:nth-child(1) { left: 20px; top: 18px; }.packing-box > i:nth-child(2) { left: 52px; top: 18px; }.packing-box > i:nth-child(3) { left: 84px; top: 18px; }.packing-box > i:nth-child(4) { left: 116px; top: 18px; }
.warehouse-lanes { position: absolute; z-index: 2; right: 5%; top: 16%; width: 230px; height: 280px; border: 2px solid #697276; }.warehouse-lanes > i { position: absolute; left: 8px; right: 8px; height: 2px; background: #697276; }.warehouse-lanes > i:nth-child(1) { top: 25%; }.warehouse-lanes > i:nth-child(2) { top: 50%; }.warehouse-lanes > i:nth-child(3) { top: 75%; }
.plan-footer { display: grid; grid-template-columns: minmax(140px,.8fr) 28px minmax(260px,1.6fr) 28px minmax(140px,.8fr); gap: 8px; align-items: center; min-height: 58px; padding: 9px 15px; border: 1px solid #4a5357; border-top: 0; background: #20272a; }.plan-footer > div span, .plan-footer > div b { display: block; }.plan-footer span { color: #849094; font-size: 8px; }.plan-footer b { margin-top: 4px; overflow: hidden; font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }.plan-footer > i { color: #e9aa24; text-align: center; font-style: normal; }
.plan-product-strip { display: grid; grid-template-columns: repeat(auto-fit,minmax(190px,1fr)); border: 1px solid #4a5357; border-top: 0; background: #171e21; }.plan-product-strip button { display: grid; grid-template-columns: 9px minmax(0,1fr); gap: 8px; align-items: center; min-height: 46px; padding: 8px 10px; color: #dce1e2; text-align: left; border: 0; border-right: 1px solid #3f484c; background: transparent; cursor: pointer; }.plan-product-strip button:hover { background: #242c2f; }.plan-product-strip button > i { width: 8px; height: 24px; background: #8f999c; }.plan-product-strip button > i.running { background: #54b975; }.plan-product-strip button > i.hold { background: #e9aa24; }.plan-product-strip button > i.rejected { background: #df5a52; }.plan-product-strip button > i.passed { background: #4c94ad; }.plan-product-strip span,.plan-product-strip b,.plan-product-strip small { display: block; min-width: 0; }.plan-product-strip b { overflow: hidden; font: 8px Consolas,monospace; text-overflow: ellipsis; white-space: nowrap; }.plan-product-strip small { margin-top: 4px; color: #899397; font-size: 8px; }
.material-token { animation-duration: var(--motion-duration, 7s); animation-delay: var(--motion-delay, 0s); }
.conveyor .device-symbol > i:nth-child(2), .positioner .device-symbol > i:nth-child(2), .fan .device-symbol > span, .agv .device-symbol > i:nth-child(2), .agv .device-symbol > i:nth-child(3) { animation-duration: var(--motion-fast); }
.mixer .device-symbol > i:nth-child(3), .pump .device-symbol > span, .beacon .device-symbol > i:nth-child(2), .location-light .device-symbol > i:nth-child(2), .heater .device-symbol > i:nth-child(2) { animation-duration: var(--motion-normal); }
.node-copy b i, .washer .device-symbol > i:nth-child(2), .mixer .device-symbol > i:nth-child(2), .chamber .device-symbol > span, .sensor .device-symbol > i:nth-child(2), .sensor-temp .device-symbol > i:nth-child(2), .sensor-hum .device-symbol > i:nth-child(2), .sensor-voc .device-symbol > i:nth-child(2), .sensor-smoke .device-symbol > i:nth-child(2), .level-sensor .device-symbol > i:nth-child(2), .ultrasonic .device-symbol > i:nth-child(2), .flowmeter .device-symbol > i:nth-child(2), .odometer .device-symbol > i:nth-child(2), .load-cell .device-symbol > i:nth-child(2), .counter .device-symbol > i:nth-child(2), .camera-top .device-symbol > i:nth-child(2), .camera-side .device-symbol > i:nth-child(2), .camera-bottom .device-symbol > i:nth-child(2), .camera-level .device-symbol > i:nth-child(2), .light-ring .device-symbol > i:nth-child(1), .light-panel .device-symbol > i:nth-child(1), .reject .device-symbol > i:nth-child(2), .filler .device-symbol > i:nth-child(2), .printer .device-symbol > i:nth-child(2) { animation-duration: var(--motion-slow); }
.robot .device-symbol > i:nth-child(2), .robot .device-symbol > i:nth-child(3), .scan-zone i { animation-duration: var(--motion-cycle); }
.stopped .material-token, .stopped .device-symbol *, .stopped .node-copy b i, .paused .material-token, .paused .device-symbol *, .paused .node-copy b i, .paused .scan-zone i { animation-play-state: paused !important; }
@keyframes planMaterial { from { left: -74px; } to { left: calc(100% + 74px); } }
@keyframes statusPulse { 0%,100%{opacity:.4}50%{opacity:1} }
@keyframes rollerSpin { to { transform: rotate(360deg); } }
@keyframes liquidWave { 0%,100%{transform:scaleY(.75)}50%{transform:scaleY(1)} }
@keyframes mixerMove { 0%,100%{transform:rotate(-10deg)}50%{transform:rotate(10deg)} }
@keyframes fanSpin { to { transform:rotate(360deg); } }
@keyframes chamberPulse { 0%,100%{opacity:.35}50%{opacity:1} }
@keyframes sensorPulse { 0%,100%{box-shadow:0 0 0 0 rgba(233,170,36,.1)}50%{box-shadow:0 0 0 6px rgba(233,170,36,.18)} }
@keyframes beaconFlash { 50%{background:#e9aa24;box-shadow:0 0 10px #e9aa24} }
@keyframes cameraFocus { 50%{border-color:#5abac7;box-shadow:0 0 7px #5abac7} }
@keyframes lightPulse { 50%{box-shadow:0 0 13px rgba(233,170,36,.8)} }
@keyframes rejectMove { 50%{transform:translateX(9px)} }
@keyframes heaterGlow { 50%{opacity:.45} }
@keyframes fillerMove { 50%{transform:translateY(8px)} }
@keyframes robotArm { 0%,100%{transform:rotate(-20deg)}50%{transform:rotate(25deg)} }
@keyframes robotForearm { 0%,100%{transform:rotate(-18deg)}50%{transform:rotate(30deg)} }
@keyframes printPaper { 50%{transform:translateY(8px)} }
@keyframes scanLine { from{top:8%}to{top:90%} }
@media (max-width: 850px) { .plan-view { overflow-x: auto; scrollbar-color: #e9aa24 #20272a; scrollbar-width: thin; }.plan-header, .plan-canvas, .plan-footer, .plan-product-strip { min-width: 840px; }.plan-canvas { height: 560px; overflow: hidden; }.device-node { width: 135px; }.plan-footer { grid-template-columns: minmax(120px,.8fr) 24px minmax(260px,1.6fr) 24px minmax(120px,.8fr); }.plan-footer > i { display: block; }.plan-actions small { display: none; } }
@media (prefers-reduced-motion: reduce) { .plan-view * { animation: none !important; } }
</style>

<style scoped>
.plan-view { color:#16324a; background:#f4f8fb; }
.plan-header { border-color:#c8d6e2; background:#fff; }.plan-header b { color:#123a5b; }.plan-header span,.plan-header small { color:#61788b; }
.plan-actions button { color:#145da0; border-color:#a9c4d8; background:#fff; }.plan-actions button:hover,.plan-actions button.active { color:#fff; border-color:#145da0; background:#145da0; }.state-legend { color:#61788b; }.plan-actions .state-legend span { color:#61788b; }
.plan-canvas { border-color:#c8d6e2; background-color:#eaf1f6; background-image:linear-gradient(rgba(20,93,160,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(20,93,160,.045) 1px,transparent 1px); background-size:24px 24px; }
.factory-zone { border-color:#86a8c0; background:rgba(255,255,255,.36); }.factory-zone span { color:#607e94; }.process-pipe { border-color:#9eb6c7; background:repeating-linear-gradient(90deg,#d1dfe8 0 20px,#e8f0f5 20px 26px); }.process-pipe > i { border-color:#7ea3bd; }.process-pipe::before,.process-pipe::after { background:#7394aa; }.process-pipe.liquid-route > i { border-top-color:#3c91c5; }.process-pipe.agv-route,.process-pipe.warehouse-route { border-color:#87a8bf; background:#d8e6ee; }.process-pipe.agv-route > i,.process-pipe.warehouse-route > i { border-color:#568bb1; }.flow-caption { color:#59778d; }
.material-token > span { color:#45677e; background:rgba(255,255,255,.9); }.material-token i { border-color:#5b7990; background:rgba(91,121,144,.12); }.state-colors .material-token.running i { border-color:#238b5a; background:rgba(35,139,90,.16); }.state-colors .material-token.hold i { border-color:#d89016; background:rgba(216,144,22,.15); }.state-colors .material-token.rejected i { border-color:#c83f49; background:rgba(200,63,73,.15); }.state-colors .material-token.passed i { border-color:#1f7acb; background:rgba(31,122,203,.14); }.material-token.liquid i { background:#4f9dcc; }.state-colors .material-token.liquid.running i { background:#238b5a; }.state-colors .material-token.liquid.hold i { background:#d89016; }.state-colors .material-token.liquid.rejected i { background:#c83f49; }.state-colors .material-token.liquid.passed i { background:#1f7acb; }
.material-token.carton i { border-color:#6b879b; background:#a7bdca; }.state-colors .material-token.carton.running i { background:#7ab694; }.state-colors .material-token.carton.hold i { background:#d5ae61; }.state-colors .material-token.carton.rejected i { background:#cf7c80; }.state-colors .material-token.carton.passed i { background:#79a9ca; }.no-products { color:#6b8497; border-color:#9db4c4; background:rgba(255,255,255,.86); }
.device-node { color:#16324a; border-color:#9bb2c2; background:#fff; box-shadow:0 2px 7px rgba(18,58,91,.08); }.device-node:hover { border-color:#1f7acb; background:#f8fbfd; }.device-node.standby { border-left-color:#8499a8; }.state-colors .device-node.running { border-left-color:#238b5a; }.state-colors .device-node.alarm { border-left-color:#c83f49; }.device-node.linked-active { box-shadow:inset 0 0 0 1px rgba(31,122,203,.55),0 0 12px rgba(31,122,203,.13); }.device-node.linked-active .node-copy b { color:#1f7acb; }.editing .device-node { outline-color:rgba(31,122,203,.55); }.editing .device-node:active,.editing .device-node.dragging { border-color:#1f7acb; box-shadow:0 7px 18px rgba(18,58,91,.18); }.node-number,.node-copy small { color:#7b91a2; }.node-copy b { color:#238b5a; }.node-copy b i { background:currentColor; }.device-node.alarm .node-copy b { color:#c83f49; }.plan-view:not(.state-colors) .node-copy b { color:#6c8799; }.state-colors .device-node.running .node-copy b { color:#238b5a; }.state-colors .device-node.alarm .node-copy b { color:#c83f49; }.state-colors .device-node.standby .node-copy b { color:#6c8799; }.device-symbol { color:#145da0; }
.scan-zone { border-color:#5d9bc4; }.scan-zone i { background:rgba(31,122,203,.65); box-shadow:0 0 8px rgba(31,122,203,.35); }.scan-zone span,.packing-box span,.warehouse-lanes span { color:#477b9e; }.packing-box { border-color:#779bb4; background:rgba(119,155,180,.12); }.packing-box > i { border-color:#1f7acb; }.warehouse-lanes { border-color:#7898ad; }.warehouse-lanes > i { background:#7898ad; }
.plan-footer { border-color:#c8d6e2; background:#fff; }.plan-footer span { color:#6c8496; }.plan-footer b { color:#16324a; }.plan-footer > i { color:#1f7acb; }.plan-product-strip { border-color:#c8d6e2; background:#f7fafc; }.plan-product-strip button { color:#16324a; border-right-color:#dce6ed; }.plan-product-strip button:hover { background:#edf5fa; }.plan-product-strip button > i { background:#8fa4b2; }.plan-product-strip button > i.running { background:#238b5a; }.plan-product-strip button > i.hold { background:#d89016; }.plan-product-strip button > i.rejected { background:#c83f49; }.plan-product-strip button > i.passed { background:#1f7acb; }.plan-product-strip small { color:#6e8495; }
@media (max-width:850px) { .plan-view { scrollbar-color:#1f7acb #e6eef4; } }
@media (min-width:1100px) { .plan-canvas { height:380px; min-height:380px; }.plan-header { min-height:40px; padding:5px 11px; }.plan-footer { min-height:48px; padding:6px 11px; }.plan-product-strip button { min-height:39px; padding:5px 8px; } }
</style>
