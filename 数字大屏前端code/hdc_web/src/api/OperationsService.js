import { Service, ServiceGet } from './Service.js'

export const getOperationsOverview = () => ServiceGet.get('/api/operations/overview')
export const getLogisticsOverview = () => ServiceGet.get('/api/logistics/overview')

export const acknowledgeAlarm = alarmId => Service.post(`/api/operations/alarms/${alarmId}/ack`)

export const getFactoryRuntime = (stageCode = '') =>
	ServiceGet.get(`/api/factory/runtime${stageCode ? `?stageCode=${stageCode}` : ''}`)

export const getFactoryIncidents = (status = '') =>
	ServiceGet.get(`/api/factory/runtime/incidents${status ? `?status=${status}` : ''}`)

export const reportFactoryIncident = form => Service.post('/api/factory/runtime/incidents', form)

export const resolveFactoryIncident = (incidentId, form) =>
	Service.post(`/api/factory/runtime/incidents/${incidentId}/resolve`, form)

export const requestAiRecipe = (traceCode, bottleType, autoApply = false) =>
	Service.post('/api/operations/ai/decide', {
		traceCode,
		bottleType,
		stage: 'FILLING',
		observations: {},
		autoApply
	})
