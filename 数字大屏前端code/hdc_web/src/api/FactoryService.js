import { Service, ServiceGet } from './Service.js'

export const getFactoryDashboard = () => ServiceGet.get('/api/factory/dashboard')

export const runFactoryScenario = (scenario, traceCode) =>
	Service.post('/api/factory/runs/scenario', {
		scenario,
		traceCode,
		bottleType: 'PLA-500'
	})
