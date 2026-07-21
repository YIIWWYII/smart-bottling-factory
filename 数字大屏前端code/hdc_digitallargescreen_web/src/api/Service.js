import axios from 'axios'
import Local from '@/store/localSave.js'
import router from '@/router'

import qs from 'qs'
import {
	Message,
	Loading
} from 'element-ui'
let loadingInstance = null //这里是loading

export const URL = 'http://localhost:8088/'

// export const URL = window.setURL.URL
const TIME_OUT = 120000
//使用create方法创建axios实例
export const Service = axios.create({
	timeout: TIME_OUT, // 请求超时时间
	baseURL: URL,
	method: 'post',
	headers: {
		'Content-Type': 'application/json;charset=UTF-8'
	}
})
export const ServiceGet = axios.create({
	timeout: TIME_OUT, // 请求超时时间
	baseURL: URL,
	method: 'get',
	headers: {
		'Content-Type': 'application/x-www-form-urlencoded'
	},
})
export const ServiceDownload = axios.create({
	timeout: TIME_OUT, // 请求超时时间
	baseURL: URL,
	method: 'post',
	headers: {
		'Content-Type': 'application/json;charset=UTF-8',
	}
})
export const ServiceUpload = axios.create({
	timeout: TIME_OUT, // 请求超时时间
	baseURL: URL,
	method: 'post',
	headers: {
		'Content-Type': 'multipart/form-data',
	}
})
// 添加请求拦截器
Service.interceptors.request.use(config => {
	if (Local.getToken()) {
		config.headers['Authorization'] = Local.getToken() // 让每个请求携带自定义token 请根据实际情况自行修改
	}
	console.log("request->", config)
	return config
})
// 添加响应拦截器
Service.interceptors.response.use(response => {
	// loadingInstance.close()
	var res = response.data
	console.log("response->", response)
	var code = res.code
	if (code != 2004) {
		//增加大写，做一下兼容
		if (response.headers.Authorization) {
			console.log("response->header.Authorization->", response.headers.Authorization)
			Local.saveToken(response.headers.Authorization)
		} else {
			console.log("response->header.Authorization-> null")
		}
		if (response.headers.authorization) {
			console.log("response->header.authorization->", response.headers.authorization)
			Local.saveToken(response.headers.authorization)
		} else {
			console.log("response->header.authorization-> null")
		}
	}

	switch (code) {
		case 0: //成功
			return res.data
		case 1: //消息提示
			Message({
				message: res.message,
				type: 'success',
				duration: 3 * 1000
			})
			return res.data
		case 2001: //用户不存在
			Message(res.message)
			return res;
		case 2002: //用户名或密码错误
			Message(res.message)
			return res;
		case 2003: //无访问权限
			Message(res.message)
			return res;
		case 2004: //回到首页
			// Message(res.message)
			Local.clearNativeInfo()
			return Promise.reject(res.message)
		default: //error提示
			if (res.message) {
				Message({
					message: res.message,
					type: 'error',
					duration: 3 * 1000
				})
			}
			return Promise.reject(res.message)
	}
}, error => {
	console.log('TCL: error', error)
	const msg = error.Message !== undefined ? error.Message : ''
	Message({
		message: '网络错误' + msg,
		type: 'error',
		duration: 3 * 1000
	})
	// loadingInstance.close()
	return Promise.reject(error)
})
ServiceGet.interceptors.request = Service.interceptors.request
ServiceGet.interceptors.response = Service.interceptors.response

ServiceDownload.interceptors.request = Service.interceptors.request
ServiceDownload.interceptors.response.use(response => {
	return response
}, error => {
	console.log('TCL: error', error)
	const msg = error.Message !== undefined ? error.Message : ''
	Message({
		message: '网络错误' + msg,
		type: 'error',
		duration: 3 * 1000
	})
	return Promise.reject(error)
})

ServiceUpload.interceptors.request = Service.interceptors.request
ServiceUpload.interceptors.response = Service.interceptors.response
