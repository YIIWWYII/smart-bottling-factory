export const FACTORY_VISUALS = {
	PRETREATMENT: {
		title: '瓶体预处理单元', material: 'PLA 瓶', output: '洁净干燥瓶',
		devices: [
			{ visual: 'conveyor', x: 12, y: 60, scale: 1.1 },
			{ visual: 'washer', x: 36, y: 42, scale: 1.15 },
			{ visual: 'fan', x: 62, y: 38, scale: 1 },
			{ visual: 'plc', x: 84, y: 24, scale: .88 }
		]
	},
	GAS_INSPECTION: {
		title: '密封气体检测单元', material: '预处理瓶', output: '气体安全瓶',
		devices: [
			{ visual: 'chamber', x: 25, y: 45, scale: 1.25 },
			{ visual: 'sensor', x: 50, y: 26, scale: .9 },
			{ visual: 'pump', x: 70, y: 56, scale: .9 },
			{ visual: 'beacon', x: 87, y: 22, scale: .8 }
		]
	},
	APPEARANCE_INSPECTION: {
		title: '多视角外观检测单元', material: '待检空瓶', output: '外观合格瓶',
		devices: [
			{ visual: 'camera-top', x: 27, y: 18, scale: .82 },
			{ visual: 'camera-side', x: 34, y: 50, scale: .82 },
			{ visual: 'camera-bottom', x: 52, y: 72, scale: .82 },
			{ visual: 'light-ring', x: 52, y: 38, scale: 1 },
			{ visual: 'reject', x: 82, y: 52, scale: .92 }
		]
	},
	BEVERAGE_READY: {
		title: '饮料调配与杀菌单元', material: '饮料原料', output: '已杀菌饮料',
		devices: [
			{ visual: 'mixer', x: 21, y: 42, scale: 1.25 },
			{ visual: 'heater', x: 50, y: 47, scale: 1.1 },
			{ visual: 'sensor-temp', x: 73, y: 28, scale: .82 },
			{ visual: 'sensor-hum', x: 86, y: 60, scale: .82 }
		]
	},
	FILLING: {
		title: '定量灌装单元', material: '空瓶 + 饮料', output: '灌装完成瓶',
		devices: [
			{ visual: 'positioner', x: 13, y: 58, scale: .88 },
			{ visual: 'pump', x: 30, y: 25, scale: .86 },
			{ visual: 'filler', x: 50, y: 38, scale: 1.2 },
			{ visual: 'flowmeter', x: 71, y: 24, scale: .8 },
			{ visual: 'level-sensor', x: 87, y: 58, scale: .82 }
		]
	},
	SECONDARY_INSPECTION: {
		title: '成品二次检测单元', material: '灌装完成瓶', output: '装箱合格瓶',
		devices: [
			{ visual: 'camera-side', x: 24, y: 30, scale: .9 },
			{ visual: 'camera-level', x: 48, y: 50, scale: .9 },
			{ visual: 'light-panel', x: 65, y: 24, scale: .9 },
			{ visual: 'reject', x: 84, y: 56, scale: .95 }
		]
	},
	PACKING: {
		title: '机械臂自动装箱单元', material: '二检合格瓶 + 纸箱', output: '成品箱',
		devices: [
			{ visual: 'robot', x: 35, y: 42, scale: 1.4 },
			{ visual: 'gripper', x: 48, y: 18, scale: .72 },
			{ visual: 'camera-top', x: 64, y: 24, scale: .8 },
			{ visual: 'printer', x: 82, y: 34, scale: .9 },
			{ visual: 'counter', x: 84, y: 67, scale: .76 }
		]
	},
	AGV_TRANSPORT: {
		title: 'AGV 物流运输单元', material: '已装满成品箱', output: '仓储到货箱',
		devices: [
			{ visual: 'agv', x: 32, y: 50, scale: 1.35 },
			{ visual: 'ultrasonic', x: 49, y: 48, scale: .76 },
			{ visual: 'odometer', x: 62, y: 68, scale: .72 },
			{ visual: 'load-cell', x: 37, y: 25, scale: .8 },
			{ visual: 'dispatch', x: 84, y: 25, scale: .95 }
		]
	},
	WAREHOUSE_INBOUND: {
		title: '智能仓储入库单元', material: 'AGV 到货箱', output: '在库成品',
		devices: [
			{ visual: 'sensor-voc', x: 18, y: 25, scale: .82 },
			{ visual: 'sensor-smoke', x: 36, y: 25, scale: .82 },
			{ visual: 'location-light', x: 63, y: 32, scale: .78 },
			{ visual: 'rack', x: 82, y: 48, scale: 1.3 }
		]
	}
}

export function findFactoryVisual(stageCode) {
	return FACTORY_VISUALS[stageCode] || FACTORY_VISUALS.PRETREATMENT
}
