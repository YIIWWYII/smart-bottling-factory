import {
	KEY_TOKEN,
	KEY_ID,
	KEY_ROLE,
	KEY_STORE_ID,
	KEY_CITY,
	KEY_REGION
} from './key'
export default class Local {
	//暴露给外边的localstorage存储接口
	static saveToken(value) {
		localStorage.setItem(KEY_TOKEN, value)
	}
	static getToken() {
		return localStorage.getItem(KEY_TOKEN)
	}
	static saveId(value) {
		localStorage.setItem(KEY_ID, value)
	}
	static getId() {
		return localStorage.getItem(KEY_ID)
	}
	static saveRole(value) {
		localStorage.setItem(KEY_ROLE, value)
	}
	static getRole() {
		return localStorage.getItem(KEY_ROLE)
	}
	static saveStoreId(value) {
		localStorage.setItem(KEY_STORE_ID, value)
	}
	static getStoreId() {
		return localStorage.getItem(KEY_STORE_ID)
	}

	static clearNativeInfo() {
		return localStorage.clear()
	}

	static saveCity(value) {
		localStorage.setItem(KEY_CITY, value)
	}
	static getCity() {
		return localStorage.getItem(KEY_CITY)
	}

	static saveRegion(value) {
		localStorage.setItem(KEY_REGION, value)
	}
	static getRegion() {
		return localStorage.getItem(KEY_REGION)
	}
}
