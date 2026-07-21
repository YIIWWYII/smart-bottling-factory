<template>
	<div class="three-view">
		<div class="three-toolbar"><div><b>{{ visual.title }}</b><span>三维运行示意 · 拖动旋转 · 滚轮缩放 · 点击设备</span></div><small>工艺演示模型，不代表实机尺寸与安装坐标</small></div>
		<div ref="canvasHost" class="three-host" @pointerdown="rememberPointer" @pointerup="selectFromScene">
			<div v-if="webglError" class="webgl-error"><b>三维场景无法启动</b><span>{{ webglError }}</span></div>
			<div class="scene-status"><i :class="{ stopped: !running, alarm: alarmCount, paused }"></i><span>{{ paused ? '画面已暂停' : alarmCount ? '局部设备报警' : running ? '设备连续运行' : '设备待机' }}</span></div>
			<div class="scene-legend"><template v-if="stateColors"><span><i class="running"></i>运行</span><span><i class="hold"></i>待处理</span><span><i class="rejected"></i>异常</span><span><i class="passed"></i>通过</span></template><template v-else><span><i class="material"></i>产品</span><span><i class="machine"></i>设备</span><span><i class="safety"></i>安全区域</span></template></div>
		</div>
		<div class="three-device-strip">
			<button v-for="(device,index) in stage.devices" :key="device.code" type="button" :class="[stateColors ? deviceState(index) : 'neutral', { 'linked-active': deviceIsActive(index) }]" @click="$emit('select-device', device, index)"><span>{{ String(index+1).padStart(2,'0') }}</span><b>{{ device.name }}</b><small>{{ device.code }}</small><em>{{ deviceOperationLabel(index) }}</em><i></i></button>
		</div>
		<div v-if="products.length" class="three-product-strip"><button v-for="product in products.slice(0,6)" :key="product.traceCode" type="button" @click="$emit('select-product', product)"><i :class="stateColors ? product.visualStatus : 'neutral'"></i><span><b>{{ product.traceCode }}</b><small>{{ product.bottleType || '待识别' }} · {{ product.statusLabel }}</small></span></button></div>
	</div>
</template>

<script>
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { findFactoryVisual } from '@/config/factoryVisuals.js'
import { runtimeProgressAt, runtimeProductProgressAt } from '@/config/factoryRuntime.js'

const TRIGGERED_VISUALS = new Set(['positioner', 'chamber', 'camera-top', 'camera-side', 'camera-bottom', 'camera-level', 'light-ring', 'light-panel', 'reject', 'filler', 'robot', 'gripper', 'printer', 'counter', 'location-light'])

export default {
	name: 'StageThreeView',
	props: {
		stage: { type: Object, required: true }, running: Boolean, paused: Boolean, stateColors: Boolean,
		products: { type: Array, default: () => [] }, productKey: { type: String, default: '' }, alarmCount: { type: Number, default: 0 },
		runtime: { type: Object, default: () => ({ running: false, cycleSeconds: 0, motionScale: 0 }) },
		nowMs: { type: Number, default: 0 }, deviceStates: { type: Array, default: () => [] }, deviceActivity: { type: Array, default: () => [] }
	},
	data() { return { webglError: '', renderer: null, scene: null, camera: null, controls: null, frameId: null, resizeObserver: null, clock: null, raycaster: null, pointer: null, pointerDown: null, frozenTime: null, deviceGroups: [], productGroups: [], statusMarkers: [], productMarkers: [], movers: [], animated: [] } },
	computed: { visual() { return findFactoryVisual(this.stage.code) } },
	mounted() { this.initializeScene() },
	beforeDestroy() { this.disposeScene() },
	watch: {
		'stage.code'() { this.disposeScene(); this.$nextTick(this.initializeScene) },
		paused(value) { this.setPaused(value, this.runtime.frozenAtMs) },
		stateColors() { this.updateStatusColors() },
		alarmCount() { this.updateStatusColors() },
		running() { this.updateStatusColors() },
		productKey() { this.rebuildProducts() }
	},
	methods: {
		initializeScene() {
			try {
				const host = this.$refs.canvasHost
				if (!host) return
				this.scene = new THREE.Scene()
				this.scene.background = new THREE.Color(0xeaf1f6)
				this.scene.fog = new THREE.Fog(0xeaf1f6, 18, 42)
				this.camera = new THREE.PerspectiveCamera(38, host.clientWidth / Math.max(host.clientHeight, 1), .1, 100)
				this.camera.position.set(14, 12, 18)
				this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
				this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
				this.renderer.setSize(host.clientWidth, host.clientHeight)
				this.renderer.shadowMap.enabled = true
				this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
				if ('outputColorSpace' in this.renderer) this.renderer.outputColorSpace = THREE.SRGBColorSpace
				host.insertBefore(this.renderer.domElement, host.firstChild)
				this.controls = new OrbitControls(this.camera, this.renderer.domElement)
				this.controls.enableDamping = true
				this.controls.dampingFactor = .07
				this.controls.minDistance = 10
				this.controls.maxDistance = 34
				this.controls.maxPolarAngle = Math.PI * .48
				this.controls.target.set(0, 1.4, 0)
				this.controls.addEventListener('change', this.renderStatic)
				this.raycaster = new THREE.Raycaster()
				this.pointer = new THREE.Vector2()
				this.clock = new THREE.Clock()
				if (this.paused) this.frozenTime = (this.runtime.frozenAtMs || Date.now()) / 1000
				this.buildEnvironment()
				this.buildStage()
				this.resizeObserver = new ResizeObserver(() => this.resize())
				this.resizeObserver.observe(host)
				this.animate()
			} catch (error) {
				this.webglError = error.message || '浏览器不支持 WebGL'
			}
		},
		buildEnvironment() {
			const floor = new THREE.Mesh(new THREE.PlaneGeometry(32, 17), new THREE.MeshStandardMaterial({ color: 0xd9e5ed, roughness: .86, metalness: .18 }))
			floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; this.scene.add(floor)
			const grid = new THREE.GridHelper(32, 32, 0x8eacc2, 0xc5d6e2); grid.position.y = .012; this.scene.add(grid)
			const safety = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(29, .02, 14)), new THREE.LineBasicMaterial({ color: 0x5b91ba })); safety.position.y = .04; this.scene.add(safety)
			const ambient = new THREE.HemisphereLight(0xffffff, 0x9fb6c8, 1.55); this.scene.add(ambient)
			const key = new THREE.DirectionalLight(0xffffff, 1.45); key.position.set(8, 15, 9); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); this.scene.add(key)
			const fill = new THREE.DirectionalLight(0x73a7cf, .42); fill.position.set(-12, 7, -8); this.scene.add(fill)
			if (['AGV_TRANSPORT', 'WAREHOUSE_INBOUND'].includes(this.stage.code)) this.buildLogisticsRoute()
			else if (this.stage.code === 'BEVERAGE_READY') this.buildProcessPipe()
			else this.buildConveyor()
		},
		buildProcessPipe() {
			const pipe = this.cylinder(.42, .42, 25, 24, 0x52646a); pipe.rotation.z = Math.PI / 2; pipe.position.y = .72; this.scene.add(pipe)
			const liquid = this.cylinder(.27, .27, 24.8, 20, 0x31859a, { transparent: true, opacity: .65 }); liquid.rotation.z = Math.PI / 2; liquid.position.y = .72; this.scene.add(liquid)
			for (let x = -10; x <= 10; x += 5) { const support = this.box(.3, 1.1, 1.3, 0x697377); support.position.set(x, .3, 0); this.scene.add(support) }
		},
		buildLogisticsRoute() {
			const lane = this.box(25, .04, 4.6, 0x343b3e); lane.position.y = .04; this.scene.add(lane)
			for (let x = -11; x <= 11; x += 2) { const mark = this.box(.85, .025, .12, 0x5b91ba); mark.position.set(x, .08, 0); this.scene.add(mark) }
		},
		buildConveyor() {
			const group = new THREE.Group()
			const belt = this.box(25, .32, 2.1, 0x3a4347); belt.position.y = .72; belt.receiveShadow = true; group.add(belt)
			for (let x = -11.5; x <= 11.5; x += 1.25) { const roller = this.cylinder(.22, .22, 2.25, 12, 0x697377); roller.rotation.x = Math.PI / 2; roller.position.set(x, .73, 0); group.add(roller); this.animated.push({ object: roller, kind: 'rotate', axis: 'z', speed: 2.8 }) }
			for (const z of [-1.22, 1.22]) { const rail = this.box(25.5, .25, .16, 0x8a9396); rail.position.set(0, 1.03, z); group.add(rail) }
			this.scene.add(group)
		},
		buildStage() {
			this.deviceGroups = []; this.productGroups = []; this.statusMarkers = []; this.productMarkers = []; this.movers = []; this.animated = this.animated.filter(item => item.kind === 'rotate')
			this.stage.devices.forEach((device, index) => {
				const spec = this.visual.devices[index] || { visual: 'plc', x: 20 + index * 15, y: 40, scale: 1 }
				const animationStart = this.animated.length
				const group = this.createDevice(spec.visual)
				this.animated.slice(animationStart).forEach(item => { item.deviceIndex = index; item.triggered = TRIGGERED_VISUALS.has(spec.visual) })
				group.position.set((spec.x - 50) * .27, 0, (spec.y - 50) * .13)
				group.scale.setScalar(spec.scale || 1)
				this.addStatusMarker(group, this.deviceState(index), this.statusMarkers)
				group.userData.deviceIndex = index
				group.traverse(object => { object.userData.deviceIndex = index; if (object.isMesh) { object.castShadow = true; object.receiveShadow = true } })
				this.scene.add(group); this.deviceGroups.push(group)
			})
			this.buildMaterials()
			if (this.stage.code === 'PACKING') this.buildPackingArea()
			if (this.stage.code === 'WAREHOUSE_INBOUND') this.buildWarehouseArea()
			if (['APPEARANCE_INSPECTION', 'SECONDARY_INSPECTION'].includes(this.stage.code)) this.buildScanArea()
		},
		deviceState(index) { const value = this.deviceStates[index]; if (value) return value === 'alarm' ? 'rejected' : value === 'standby' ? 'neutral' : value; return this.alarmCount && index === this.stage.devices.length - 1 ? 'rejected' : this.running ? 'running' : 'neutral' },
		deviceIsTriggered(index) { const spec = this.visual.devices[index] || {}; return TRIGGERED_VISUALS.has(spec.visual) },
		deviceIsActive(index) { return this.deviceState(index) === 'running' && (!this.deviceIsTriggered(index) || Number(this.deviceActivity[index]) > .02) },
		deviceOperationLabel(index) { const state = this.deviceState(index); if (state === 'rejected') return '报警停机'; if (state === 'neutral' || !this.running) return '待机'; if (!this.deviceIsTriggered(index)) return '连续运行'; return this.deviceIsActive(index) ? '联动动作' : '等待物料' },
		statusColor(status) { if (!this.stateColors) return 0x6c8799; return { running: 0x238b5a, hold: 0xd89016, rejected: 0xc83f49, passed: 0x1f7acb }[status] || 0x6c8799 },
		addStatusMarker(group, status, collection) { const material = this.material(this.statusColor(status), { emissive: this.statusColor(status), emissiveIntensity: .25 }); const ring = new THREE.Mesh(new THREE.TorusGeometry(1.05,.07,8,28),material);ring.rotation.x=Math.PI/2;ring.position.y=.08;group.add(ring);collection.push({material,status}) },
		updateStatusColors() { this.statusMarkers.forEach((item,index)=>{item.status=this.deviceState(index);const color=this.statusColor(item.status);item.material.color.setHex(color);item.material.emissive.setHex(color)});this.productMarkers.forEach(item=>{const color=this.statusColor(item.status);item.material.color.setHex(color);item.material.emissive.setHex(color)});this.renderStatic() },
		createDevice(type) {
			if (type === 'conveyor' || type === 'positioner') return this.makeConveyorUnit(type)
			if (type === 'washer' || type === 'mixer') return this.makeTank(type)
			if (type === 'fan') return this.makeFan()
			if (['plc', 'dispatch', 'printer', 'rack'].includes(type)) return this.makeCabinet(type)
			if (type === 'chamber') return this.makeChamber()
			if (['sensor', 'sensor-temp', 'sensor-hum', 'sensor-voc', 'sensor-smoke', 'level-sensor', 'ultrasonic', 'flowmeter', 'odometer', 'load-cell', 'counter', 'location-light'].includes(type)) return this.makeSensor(type)
			if (type === 'pump') return this.makePump()
			if (type === 'beacon') return this.makeBeacon()
			if (type.indexOf('camera') === 0) return this.makeCamera(type)
			if (type.indexOf('light') === 0) return this.makeLight(type)
			if (type === 'reject') return this.makeReject()
			if (type === 'heater') return this.makeHeater()
			if (type === 'filler') return this.makeFiller()
			if (type === 'robot') return this.makeRobot()
			if (type === 'gripper') return this.makeGripper()
			if (type === 'agv') return this.makeAgv()
			return this.makeCabinet('plc')
		},
		makeConveyorUnit(type) {
			const g = new THREE.Group(); const base = this.box(3.3, .55, 2.6, 0x596469); base.position.y = 1; g.add(base)
			for (let i = -1; i <= 1; i++) { const roller = this.cylinder(.18, .18, 2.8, 12, 0xe9aa24); roller.rotation.x = Math.PI / 2; roller.position.set(i, 1.32, 0); g.add(roller); this.animated.push({ object: roller, kind: 'rotate', axis: 'z', speed: 3 }) }
			if (type === 'positioner') { for (const z of [-.8,.8]) { const guide = this.box(2.8,.45,.18,0xd4d9da); guide.position.set(0,1.75,z); g.add(guide) } }
			return g
		},
		makeTank(type) {
			const g = new THREE.Group(); const tank = this.cylinder(1.25, 1.25, 2.7, 28, 0x6a7579); tank.position.y = 2.15; g.add(tank)
			const liquid = this.cylinder(1.12, 1.12, .65, 28, type === 'washer' ? 0x2c8396 : 0xd98e2a, { transparent: true, opacity: .68 }); liquid.position.y = 1.35; g.add(liquid); this.animated.push({ object: liquid, kind: 'pulseY', base: 1.35, amplitude: .13, speed: 1.4 })
			const rim = new THREE.Mesh(new THREE.TorusGeometry(1.23,.08,10,28), this.material(0xe9aa24)); rim.rotation.x=Math.PI/2; rim.position.y=3.52; g.add(rim)
			if (type === 'mixer') { const shaft=this.cylinder(.09,.09,3.2,10,0xe9aa24); shaft.position.y=3; g.add(shaft); const blade=this.box(1.8,.12,.28,0xe9aa24); blade.position.y=1.55; g.add(blade); this.animated.push({object:blade,kind:'rotate',axis:'y',speed:2.4}) }
			return g
		},
		makeFan() {
			const g=new THREE.Group(); const housing=this.cylinder(1.05,1.05,.55,24,0x596469); housing.rotation.x=Math.PI/2; housing.position.y=1.8; g.add(housing)
			const rotor=new THREE.Group(); rotor.position.set(0,1.8,.32); for(let i=0;i<4;i++){const blade=this.box(.22,1.25,.12,0xe9aa24);blade.position.y=.45;blade.rotation.z=i*Math.PI/2;rotor.add(blade)}g.add(rotor);this.animated.push({object:rotor,kind:'rotate',axis:'z',speed:5});return g
		},
		makeCabinet(type) {
			const g=new THREE.Group(); const color=type==='rack'?0x596469:0x4f595d; const body=this.box(type==='rack'?3:1.7,type==='rack'?4:3.1,type==='rack'?1.3:1.35,color);body.position.y=type==='rack'?2:1.55;g.add(body)
			if(type==='rack'){for(const y of [.8,1.8,2.8,3.8]){const shelf=this.box(3.2,.12,1.45,0xe9aa24);shelf.position.y=y;g.add(shelf)}for(let y=.9;y<3.8;y+=1){for(let x=-.8;x<=.8;x+=.8){const carton=this.box(.55,.55,.8,0x9b6e32);carton.position.set(x,y,0);g.add(carton)}}}
			else { const screen=this.box(1.15,.65,.06,0x213b30);screen.position.set(0,2.2,.71);g.add(screen);const lamp=this.sphere(.11,0x55c178);lamp.position.set(-.45,1.45,.72);g.add(lamp);this.animated.push({object:lamp,kind:'pulseScale',speed:2}) }
			if(type==='printer'){const paper=this.box(1.15,.08,.9,0xe6e8e8);paper.position.set(0,.75,.8);g.add(paper);this.animated.push({object:paper,kind:'pulseZ',base:.8,amplitude:.35,speed:1.4})}return g
		},
		makeChamber() {
			const g=new THREE.Group(); const frameMat=this.material(0x7b8589); for(const x of [-1.4,1.4])for(const z of [-1.2,1.2]){const post=this.box(.13,3.6,.13,0x7b8589);post.position.set(x,1.8,z);g.add(post)}
			const shell=this.box(2.9,3.4,2.5,0x5c9aa5,{transparent:true,opacity:.17});shell.position.y=1.8;g.add(shell);const door=this.box(2.2,2.7,.08,0x91c8d0,{transparent:true,opacity:.26});door.position.set(0,1.7,1.25);g.add(door);return g
		},
		makeSensor(type) {
			const g=new THREE.Group(); const post=this.cylinder(.12,.18,2.2,12,0x697377);post.position.y=1.1;g.add(post);const color=type.includes('smoke')?0xd85b52:type.includes('hum')?0x4c94ad:0xe9aa24;const head=this.sphere(.38,color);head.position.y=2.4;g.add(head);this.animated.push({object:head,kind:'pulseScale',speed:1.8});if(type==='ultrasonic'){const cone=new THREE.Mesh(new THREE.ConeGeometry(.8,2.4,20,1,true),this.material(0x55b7c4,{transparent:true,opacity:.18}));cone.rotation.z=-Math.PI/2;cone.position.set(1.4,2.4,0);g.add(cone)}return g
		},
		makePump() {
			const g=new THREE.Group();const body=this.cylinder(.7,.7,1.2,20,0x596469);body.rotation.z=Math.PI/2;body.position.y=1.15;g.add(body);const wheel=new THREE.Mesh(new THREE.TorusGeometry(.58,.12,10,24),this.material(0xe9aa24));wheel.rotation.y=Math.PI/2;wheel.position.set(-.7,1.15,0);g.add(wheel);this.animated.push({object:wheel,kind:'rotate',axis:'x',speed:3});return g
		},
		makeBeacon() { const g=new THREE.Group();const post=this.cylinder(.1,.16,2.5,10,0x697377);post.position.y=1.25;g.add(post);for(let i=0;i<3;i++){const light=this.cylinder(.34,.34,.38,16,[0x55b977,0xe9aa24,0xd9544d][i],{transparent:true,opacity:.8});light.position.y=2.55+i*.4;g.add(light);this.animated.push({object:light,kind:'pulseScale',speed:1.4+i*.2,phase:i})}return g },
		makeCamera(type) { const g=new THREE.Group();const stand=this.box(.16,2.8,.16,0x7b8589);stand.position.y=1.4;g.add(stand);const body=this.box(1,.7,.75,0x4e585c);body.position.set(type==='camera-top'?0: .5,2.65,0);g.add(body);const lens=this.cylinder(.25,.32,.42,18,0x2b8999);lens.rotation.x=Math.PI/2;lens.position.set(body.position.x,2.65,.58);g.add(lens);const beam=new THREE.Mesh(new THREE.ConeGeometry(.9,3.2,20,1,true),this.material(0x4cb5c4,{transparent:true,opacity:.12}));beam.rotation.x=Math.PI;beam.position.set(body.position.x,1.05,.6);g.add(beam);this.animated.push({object:beam,kind:'pulseScale',speed:1.5});return g },
		makeLight(type) { const g=new THREE.Group();if(type==='light-ring'){const ring=new THREE.Mesh(new THREE.TorusGeometry(1,.17,12,32),this.material(0xe9aa24,{emissive:0x6f4c00,emissiveIntensity:.6}));ring.position.y=2.2;g.add(ring);this.animated.push({object:ring,kind:'pulseScale',speed:1.7})}else{const panel=this.box(1.8,2.7,.16,0xe9aa24,{emissive:0x5a3d00,emissiveIntensity:.55});panel.position.y=1.65;g.add(panel);this.animated.push({object:panel,kind:'pulseScale',speed:1.6})}return g },
		makeReject() { const g=new THREE.Group();const base=this.box(2.2,.65,1.2,0x596469);base.position.y=.85;g.add(base);const rod=this.cylinder(.13,.13,2.4,12,0xe9aa24);rod.rotation.z=Math.PI/2;rod.position.set(0,1.45,0);g.add(rod);const plate=this.box(.18,1.1,1,0xd9544d);plate.position.set(1.2,1.45,0);g.add(plate);this.animated.push({object:plate,kind:'pulseX',base:1.2,amplitude:.75,speed:1.7});return g },
		makeHeater() { const g=new THREE.Group();const tunnel=this.box(3,2.5,2.4,0x4e585c);tunnel.position.y=1.45;g.add(tunnel);const opening=this.box(2.1,1.45,.08,0xd76532,{emissive:0x6b210c,emissiveIntensity:.7});opening.position.set(0,1.35,1.22);g.add(opening);this.animated.push({object:opening,kind:'pulseScale',speed:1.4});return g },
		makeFiller() { const g=new THREE.Group();for(const x of [-1.25,1.25]){const post=this.box(.18,3.7,.18,0x7b8589);post.position.set(x,1.85,0);g.add(post)}const beam=this.box(2.8,.3,1.5,0x596469);beam.position.y=3.65;g.add(beam);for(let x=-.9;x<=.9;x+=.6){const nozzle=this.cylinder(.1,.16,1.35,12,0xe9aa24);nozzle.position.set(x,2.8,0);g.add(nozzle);this.animated.push({object:nozzle,kind:'pulseY',base:2.8,amplitude:.35,speed:1.5,phase:x})}return g },
		makeRobot() { const g=new THREE.Group();const base=this.cylinder(.8,1, .7,24,0x596469);base.position.y=.35;g.add(base);const shoulder=new THREE.Group();shoulder.position.y=.7;g.add(shoulder);const arm1=this.box(.48,2.7,.55,0xe9aa24);arm1.position.y=1.35;shoulder.add(arm1);const elbow=new THREE.Group();elbow.position.y=2.7;shoulder.add(elbow);const joint=this.sphere(.48,0x596469);elbow.add(joint);const arm2=this.box(2.3,.42,.5,0xe9aa24);arm2.position.x=1.05;elbow.add(arm2);this.animated.push({object:shoulder,kind:'robotShoulder',speed:.8});this.animated.push({object:elbow,kind:'robotElbow',speed:.8});return g },
		makeGripper() { const g=new THREE.Group();const mount=this.cylinder(.32,.38,.65,16,0x596469);mount.position.y=2.1;g.add(mount);for(const x of [-.35,.35]){const finger=this.box(.18,1.2,.22,0xe9aa24);finger.position.set(x,1.25,0);g.add(finger);this.animated.push({object:finger,kind:'grip',base:x,amplitude:.12,speed:1.5})}return g },
		makeAgv() { const g=new THREE.Group();const body=this.box(3.2,.75,2.2,0xe9aa24);body.position.y=.75;g.add(body);const top=this.box(2.55,.35,1.7,0x596469);top.position.y=1.3;g.add(top);for(const x of [-1.1,1.1])for(const z of [-1.05,1.05]){const wheel=this.cylinder(.34,.34,.28,16,0x1f2527);wheel.rotation.x=Math.PI/2;wheel.position.set(x,.42,z);g.add(wheel);this.animated.push({object:wheel,kind:'rotate',axis:'z',speed:3})}this.animated.push({object:g,kind:'agvMove',base:0,amplitude:1.4,speed:.55});return g },
		buildMaterials() { this.products.slice(0,6).forEach((product,index)=>{const type=product.productType||(['AGV_TRANSPORT','WAREHOUSE_INBOUND'].includes(this.stage.code)?'box':this.stage.code==='BEVERAGE_READY'?'liquid':'bottle');const item=this.makeProduct(type,product.visualStatus);item.position.set(-12,type==='box'?.55:type==='liquid'?.72:1.32,0);item.userData.productIndex=index;item.traverse(object=>{object.userData.productIndex=index;if(object.isMesh){object.castShadow=true;object.receiveShadow=true}});this.scene.add(item);this.productGroups.push(item);this.movers.push({object:item,index,status:product.visualStatus})}) },
		makeProduct(type,status) { const group=new THREE.Group();if(type==='box')group.add(this.makeCarton());else if(type==='liquid')group.add(this.sphere(.23,0x45a3b6,{transparent:true,opacity:.82}));else group.add(this.makeBottle());this.addStatusMarker(group,status,this.productMarkers);return group },
		clearProducts() { if(!this.scene)return;this.productGroups.forEach(group=>{this.scene.remove(group);group.traverse(object=>{if(object.geometry)object.geometry.dispose();if(object.material){const materials=Array.isArray(object.material)?object.material:[object.material];materials.forEach(item=>item.dispose())}})});this.productGroups=[];this.productMarkers=[];this.movers=[] },
		rebuildProducts() { if(!this.scene)return;this.clearProducts();this.buildMaterials();this.renderStatic() },
		makeBottle() { const g=new THREE.Group();const body=this.cylinder(.24,.32,.86,16,0xcfe1dd,{transparent:true,opacity:.72});body.position.y=.45;g.add(body);const neck=this.cylinder(.13,.18,.26,14,0xcfe1dd,{transparent:true,opacity:.72});neck.position.y=1.01;g.add(neck);const cap=this.cylinder(.16,.16,.16,14,0xe9aa24);cap.position.y=1.22;g.add(cap);return g },
		makeCarton() { const g=new THREE.Group();const box=this.box(1.25,.9,1,0x9b6e32);box.position.y=.45;g.add(box);const tape=this.box(.15,.92,1.02,0xe9aa24);tape.position.y=.47;g.add(tape);return g },
		buildPackingArea() { const box=this.box(3.5,1.3,3.2,0x8d632e,{transparent:true,opacity:.55});box.position.set(9,1,-3.5);this.scene.add(box) },
		buildWarehouseArea() { for(let z=-4;z<=4;z+=4){const rack=this.makeCabinet('rack');rack.position.set(9,0,z);rack.scale.setScalar(.85);this.scene.add(rack)} },
		buildScanArea() { const beam=new THREE.Mesh(new THREE.PlaneGeometry(5,3.4),this.material(0x4bb1c0,{transparent:true,opacity:.08,side:THREE.DoubleSide}));beam.position.set(0,2,0);beam.rotation.y=Math.PI/2;this.scene.add(beam);this.animated.push({object:beam,kind:'scanMove',base:-2.2,amplitude:4.4,speed:.7}) },
		box(w,h,d,color,options={}) { return new THREE.Mesh(new THREE.BoxGeometry(w,h,d),this.material(color,options)) },
		cylinder(rt,rb,h,segments,color,options={}) { return new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,segments),this.material(color,options)) },
		sphere(radius,color,options={}) { return new THREE.Mesh(new THREE.SphereGeometry(radius,18,12),this.material(color,options)) },
		material(color,options={}) { return new THREE.MeshStandardMaterial({ color, roughness:.58, metalness:.28, ...options }) },
		animate() { if(!this.renderer||!this.scene)return;this.renderFrame(this.paused?this.frozenTime:Date.now()/1000);if(!this.paused)this.frameId=requestAnimationFrame(this.animate);else this.frameId=null },
		renderFrame(time) {
			const safeTime = Number(time) || Date.now() / 1000
			const timeMs = safeTime * 1000
			const motion = this.runtime.running ? (this.runtime.motionScale || 1) : 0
			for (const item of this.animated) {
				const speed = item.speed || 1
				const activity = item.triggered && Number.isInteger(item.deviceIndex) ? Number(this.deviceActivity[item.deviceIndex] || 0) : 1
				const itemMotion = motion * activity
				const t = safeTime * speed * motion + (item.phase || 0)
				if (item.kind === 'rotate') { const axis=item.axis||'y';if(item.baseRotation===undefined)item.baseRotation=item.object.rotation[axis];item.object.rotation[axis]=item.baseRotation+safeTime*speed*1.4*itemMotion }
				else if(item.kind==='pulseY')item.object.position.y=(item.base||0)+Math.sin(t)*(item.amplitude||.1)*itemMotion
				else if(item.kind==='pulseX')item.object.position.x=(item.base||0)+(Math.sin(t)+1)*.5*(item.amplitude||.2)*itemMotion
				else if(item.kind==='pulseZ')item.object.position.z=(item.base||0)+(Math.sin(t)+1)*.5*(item.amplitude||.2)*itemMotion
				else if(item.kind==='pulseScale'){const s=1+(Math.sin(t)+1)*.035*itemMotion;item.object.scale.setScalar(s)}
				else if(item.kind==='robotShoulder')item.object.rotation.z=(-.25+Math.sin(t)*.28)*itemMotion
				else if(item.kind==='robotElbow')item.object.rotation.z=(.2+Math.sin(t+1)*.35)*itemMotion
				else if(item.kind==='grip')item.object.position.x=item.base+Math.sin(t)*(item.amplitude||.1)*itemMotion
				else if(item.kind==='agvMove'){const progress=runtimeProgressAt(this.runtime,timeMs);item.object.position.x=-8+progress*16}
				else if(item.kind==='scanMove'){const progress=runtimeProgressAt(this.runtime,timeMs);item.object.position.x=item.base+progress*(item.amplitude||4)}
			}
			const count = Math.max(1, this.movers.length)
			for (const mover of this.movers) {
				if (mover.status === 'hold') mover.object.position.x = 2
				else if (mover.status === 'rejected') mover.object.position.x = 8
				else mover.object.position.x = runtimeProductProgressAt(this.runtime, timeMs, this.products[mover.index] || {}, mover.index, count) * 24 - 12
			}
			this.controls.update();this.renderer.render(this.scene,this.camera)
		},
		setPaused(value, frozenAtMs) { if(!this.renderer)return;if(value){this.frozenTime=(frozenAtMs||Date.now())/1000;if(this.frameId)cancelAnimationFrame(this.frameId);this.frameId=null;this.renderFrame(this.frozenTime)}else{this.frozenTime=null;if(!this.frameId)this.animate()} },
		pauseVisual(frozenAtMs) { this.setPaused(true, frozenAtMs); return Promise.resolve() },
		renderStatic() { if(this.renderer&&this.scene&&this.camera)this.renderer.render(this.scene,this.camera) },
		rememberPointer(event) { this.pointerDown = { x: event.clientX, y: event.clientY } },
		selectFromScene(event) { if(!this.renderer||!this.camera)return;if(this.pointerDown&&Math.hypot(event.clientX-this.pointerDown.x,event.clientY-this.pointerDown.y)>6)return;const rect=this.renderer.domElement.getBoundingClientRect();this.pointer.x=((event.clientX-rect.left)/rect.width)*2-1;this.pointer.y=-((event.clientY-rect.top)/rect.height)*2+1;this.raycaster.setFromCamera(this.pointer,this.camera);const hit=this.raycaster.intersectObjects([...this.productGroups,...this.deviceGroups],true).find(item=>Number.isInteger(item.object.userData.productIndex)||Number.isInteger(item.object.userData.deviceIndex));if(!hit)return;if(Number.isInteger(hit.object.userData.productIndex)){const index=hit.object.userData.productIndex;this.$emit('select-product',this.products[index]);return}const index=hit.object.userData.deviceIndex;this.$emit('select-device',this.stage.devices[index],index) },
		resize() { const host=this.$refs.canvasHost;if(!host||!this.renderer||!this.camera)return;const width=host.clientWidth,height=Math.max(host.clientHeight,1);this.camera.aspect=width/height;this.camera.updateProjectionMatrix();this.renderer.setSize(width,height) },
		disposeScene() { if(this.frameId)cancelAnimationFrame(this.frameId);if(this.resizeObserver)this.resizeObserver.disconnect();if(this.controls){this.controls.removeEventListener('change',this.renderStatic);this.controls.dispose()}if(this.scene)this.scene.traverse(object=>{if(object.geometry)object.geometry.dispose();if(object.material){const materials=Array.isArray(object.material)?object.material:[object.material];materials.forEach(item=>item.dispose())}});if(this.renderer){const canvas=this.renderer.domElement;if(this.renderer.renderLists)this.renderer.renderLists.dispose();this.renderer.dispose();this.renderer.forceContextLoss();if(canvas&&canvas.parentNode)canvas.parentNode.removeChild(canvas)}this.frameId=null;this.resizeObserver=null;this.controls=null;this.renderer=null;this.scene=null;this.camera=null;this.clock=null;this.raycaster=null;this.pointer=null;this.pointerDown=null;this.frozenTime=null;this.deviceGroups=[];this.productGroups=[];this.statusMarkers=[];this.productMarkers=[];this.movers=[];this.animated=[] }
	}
}
</script>

<style scoped>
.three-view { color:#dce1e2;background:#111719 }.three-toolbar{display:flex;justify-content:space-between;align-items:center;min-height:48px;padding:0 15px;border-bottom:1px solid #4a5357;background:#20272a}.three-toolbar b,.three-toolbar span{display:block}.three-toolbar b{font-size:13px}.three-toolbar span,.three-toolbar small{margin-top:3px;color:#8e999d;font-size:9px}.three-host{position:relative;width:100%;height:clamp(470px,55vw,650px);min-height:470px;overflow:hidden;background:#111719}.three-host canvas{display:block;width:100%;height:100%;cursor:grab}.three-host canvas:active{cursor:grabbing}.scene-status{position:absolute;z-index:3;top:13px;left:13px;display:flex;align-items:center;gap:7px;padding:7px 10px;color:#dbe0e1;border:1px solid #566064;background:rgba(23,30,33,.88);font-size:9px;pointer-events:none}.scene-status i{width:7px;height:7px;border-radius:50%;background:#54b975}.scene-status i.stopped{background:#7c878a}.scene-status i.alarm{background:#e05a52}.scene-legend{position:absolute;z-index:3;right:13px;bottom:13px;display:flex;gap:12px;padding:7px 10px;color:#a9b2b5;background:rgba(23,30,33,.88);font-size:8px;pointer-events:none}.scene-legend span{display:flex;align-items:center;gap:5px}.scene-legend i{width:8px;height:8px}.scene-legend .material{border-radius:50%;background:#dce8e5}.scene-legend .machine{background:#e9aa24}.scene-legend .safety{border:1px solid #e9aa24}.three-device-strip{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));border-top:1px solid #4a5357;border-bottom:1px solid #4a5357;background:#20272a}.three-device-strip button{display:grid;grid-template-columns:24px 1fr;gap:3px 7px;min-height:53px;padding:8px;color:#dce1e2;text-align:left;border:0;border-right:1px solid #465054;background:transparent;cursor:pointer}.three-device-strip button:hover{background:#2a3235}.three-device-strip span{grid-row:1/span 2;color:#e9aa24;font:8px Consolas,monospace}.three-device-strip b{font-size:9px}.three-device-strip small{color:#818c8f;font:7px Consolas,monospace}.webgl-error{position:absolute;z-index:5;inset:0;display:grid;place-content:center;text-align:center;background:#111719}.webgl-error b,.webgl-error span{display:block}.webgl-error span{margin-top:7px;color:#8d989b;font-size:10px}@media(max-width:700px){.three-toolbar{align-items:flex-start;flex-direction:column;padding:10px 12px}.three-host{height:480px}.scene-legend{left:10px;right:auto;flex-wrap:wrap}.three-device-strip{grid-template-columns:repeat(2,1fr)}}
</style>

<style scoped>
.scene-status i.paused { background: #8f999c; }
.scene-legend .running { border-radius: 50%; background: #54b975; }.scene-legend .hold { border-radius: 50%; background: #e9aa24; }.scene-legend .rejected { border-radius: 50%; background: #df5a52; }.scene-legend .passed { border-radius: 50%; background: #4c94ad; }
.three-device-strip button { position: relative; }.three-device-strip button > i { position: absolute; top: 9px; right: 9px; width: 7px; height: 7px; border-radius: 50%; background: #8f999c; }.three-device-strip button.running > i { background: #54b975; }.three-device-strip button.rejected > i { background: #df5a52; }.three-device-strip button.hold > i { background: #e9aa24; }.three-device-strip button.passed > i { background: #4c94ad; }
.three-device-strip button em { grid-column: 2; color: #788387; font-size: 8px; font-style: normal; }.three-device-strip button.linked-active em { color: #e9aa24; }.three-device-strip button.linked-active { box-shadow: inset 0 -2px 0 #e9aa24; }
.three-product-strip { display: grid; grid-template-columns: repeat(auto-fit,minmax(190px,1fr)); border: 1px solid #4a5357; border-top: 0; background: #171e21; }.three-product-strip button { display: grid; grid-template-columns: 9px minmax(0,1fr); gap: 8px; align-items: center; min-height: 46px; padding: 8px 10px; color: #dce1e2; text-align: left; border: 0; border-right: 1px solid #3f484c; background: transparent; cursor: pointer; }.three-product-strip button:hover { background: #242c2f; }.three-product-strip button > i { width: 8px; height: 24px; background: #8f999c; }.three-product-strip button > i.running { background: #54b975; }.three-product-strip button > i.hold { background: #e9aa24; }.three-product-strip button > i.rejected { background: #df5a52; }.three-product-strip button > i.passed { background: #4c94ad; }.three-product-strip span,.three-product-strip b,.three-product-strip small { display: block; min-width: 0; }.three-product-strip b { overflow: hidden; font: 8px Consolas,monospace; text-overflow: ellipsis; white-space: nowrap; }.three-product-strip small { margin-top: 4px; color: #899397; font-size: 8px; }
@media(max-width:700px){.three-product-strip{grid-template-columns:1fr 1fr}.three-product-strip button{min-width:0}}
</style>

<style scoped>
.three-view { color:#16324a; background:#f4f8fb; }.three-toolbar { border-color:#c8d6e2; background:#fff; }.three-toolbar b { color:#123a5b; }.three-toolbar span,.three-toolbar small { color:#61788b; }
.three-host { background:#eaf1f6; }.scene-status { color:#16324a; border-color:#a7bdcc; background:rgba(255,255,255,.9); }.scene-status i { background:#238b5a; }.scene-status i.stopped,.scene-status i.paused { background:#8296a5; }.scene-status i.alarm { background:#c83f49; }.scene-legend { color:#47677d; border:1px solid #c8d6e2; background:rgba(255,255,255,.92); }.scene-legend .material { background:#6c8799; }.scene-legend .machine { background:#1f7acb; }.scene-legend .safety { border-color:#5b91ba; }.scene-legend .running { background:#238b5a; }.scene-legend .hold { background:#d89016; }.scene-legend .rejected { background:#c83f49; }.scene-legend .passed { background:#1f7acb; }
.three-device-strip { border-color:#c8d6e2; background:#fff; }.three-device-strip button { color:#16324a; border-right-color:#dce6ed; }.three-device-strip button:hover { background:#edf5fa; }.three-device-strip span { color:#1f7acb; }.three-device-strip small,.three-device-strip button em { color:#718798; }.three-device-strip button.linked-active em { color:#1f7acb; }.three-device-strip button.linked-active { box-shadow:inset 0 -2px 0 #1f7acb; }.three-device-strip button > i { background:#8499a8; }.three-device-strip button.running > i { background:#238b5a; }.three-device-strip button.rejected > i { background:#c83f49; }.three-device-strip button.hold > i { background:#d89016; }.three-device-strip button.passed > i { background:#1f7acb; }
.three-product-strip { border-color:#c8d6e2; background:#f7fafc; }.three-product-strip button { color:#16324a; border-right-color:#dce6ed; }.three-product-strip button:hover { background:#edf5fa; }.three-product-strip button > i { background:#8499a8; }.three-product-strip button > i.running { background:#238b5a; }.three-product-strip button > i.hold { background:#d89016; }.three-product-strip button > i.rejected { background:#c83f49; }.three-product-strip button > i.passed { background:#1f7acb; }.three-product-strip small { color:#718798; }.webgl-error { background:#eaf1f6; }.webgl-error b { color:#123a5b; }.webgl-error span { color:#61788b; }
@media(min-width:1100px){.three-host{height:380px;min-height:380px}.three-toolbar{min-height:40px;padding:0 11px}.three-device-strip button{min-height:44px;padding:6px}.three-product-strip button{min-height:39px;padding:5px 8px}}
</style>
