import axios from 'axios'
import Local from '@/store/localSave.js'
import { Message } from 'element-ui'

export const URL = 'http://localhost:8088/hdc'
const TIME_OUT = 120000

const createService = (method, contentType) => axios.create({
	timeout: TIME_OUT,
	baseURL: URL,
	method,
	headers: { 'Content-Type': contentType }
})

export const Service = createService('post', 'application/json;charset=UTF-8')
export const ServiceGet = createService('get', 'application/x-www-form-urlencoded')
export const ServiceDownload = createService('post', 'application/json;charset=UTF-8')
export const ServiceUpload = createService('post', 'multipart/form-data')

function attachRequestInterceptor(instance) {
	instance.interceptors.request.use(config => {
		const token = Local.getToken()
		if (token) config.headers.Authorization = `Bearer ${token}`
		return config
	})
}

function unwrapResponse(response) {
	const res = response.data
	if (!res || typeof res.code === 'undefined') return res
	if (res.code === 0 || res.code === 1) return res.data
	if (res.code === 2004) {
		Local.clearAuth()
		if (!window.location.hash.startsWith('#/login')) window.location.hash = '#/login'
	}
	const error = new Error(res.message || '请求失败')
	error.code = res.code
	throw error
}

function handleError(error) {
	const response = error.response
	if (response && response.status === 401) {
		Local.clearAuth()
		if (!window.location.hash.startsWith('#/login')) window.location.hash = '#/login'
	}
	const message = response && response.data && response.data.message
		? response.data.message
		: error.message || '网络错误'
	Message({ message, type: 'error', duration: 3000 })
	return Promise.reject(error)
}

[Service, ServiceGet, ServiceDownload, ServiceUpload].forEach(instance => {
	attachRequestInterceptor(instance)
	instance.interceptors.response.use(unwrapResponse, handleError)
})
