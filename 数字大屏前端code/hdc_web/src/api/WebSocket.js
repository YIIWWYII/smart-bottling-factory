import {
	Notification
} from "element-ui";
import Local from '@/store/localSave.js'

var socket = null; //实例对象
var lockReconnect = false; //是否真正建立连接
var timeout = 20 * 1000; //20秒一次心跳
var timeoutObj = null; //心跳倒计时
var serverTimeoutObj = null; //服务心跳倒计时
var timeoutnum = null; //断开 重连倒计时
var id = 0; // 城市id

const initWebSocket = async () => {
	id = Local.getId()
	console.log(`initWebSocket id=${id}`)
	if ("WebSocket" in window) {
		// const wsUrl = `ws://192.168.31.42:8088/plc/3`;
				const wsUrl = `ws://localhost:8088/hdc/api/plc/${id}`;

		//const wsUrl = `wss://sandtable-industrial.archermind.com/hdc/api/plc/${id}`;
		socket = new WebSocket(wsUrl);
		socket.onerror = webSocketOnError;
		socket.onmessage = webSocketOnMessage;
		socket.onclose = closeWebsocket;
		socket.onopen = openWebsocket;
	} else {
		Notification.error({
			title: "错误",
			message: "您的浏览器不支持websocket，请更换Chrome或者Firefox",
		});
	}
}

//建立连接
const openWebsocket = (e) => {
	console.log('openWebsocket')
	console.log(`socket.readyState=${socket.readyState}`)
	if (socket.readyState == 1) {
		//如果连接正常
		console.log('openWebsocket success')
		sendWebsocket('ping')
	} else {
		//否则重连
		console.log('openWebsocket reconnect')
		reconnect();
	}
}

const start = () => {
	//开启心跳
	timeoutObj && clearTimeout(timeoutObj);
	serverTimeoutObj && clearTimeout(serverTimeoutObj);
	timeoutObj = setTimeout(function() {
		//这里发送一个心跳，后端收到后，返回一个心跳消息
		console.log(`socket.readyState start=${socket.readyState}`)
		if (socket.readyState == 1) {
			//如果连接正常
			sendWebsocket('ping')
		} else {
			//否则重连
			reconnect();
		}
		serverTimeoutObj = setTimeout(function() {
			//超时关闭
			socket.close();
		}, timeout);
	}, timeout);
}

//重新连接
const reconnect = () => {
	if (lockReconnect) {
		return;
	}
	lockReconnect = true;
	//没连接上会一直重连，设置延迟避免请求过多
	timeoutnum && clearTimeout(timeoutnum);
	timeoutnum = setTimeout(function() {
		//新连接
		initWebSocket();
		lockReconnect = false;
	}, 1000);
}

//重置心跳
const reset = () => {
	//清除时间
	clearTimeout(timeoutObj);
	clearTimeout(serverTimeoutObj);
	//重启心跳
	start();
}

const sendWebsocket = (e) => {
	socket.send(e);
}

const webSocketOnError = (e) => {
	console.log(`webSocketOnError=${JSON.stringify(e)}`)
}

//服务器返回的数据
const webSocketOnMessage = (e) => {
	console.log(e)
	// console.log(`webSocketOnMessage=${JSON.stringify(e.data)}`)
	// 判断心跳pong正常
	if (e.data == 'pong') {
		console.log('连接正常')
	} else {
		//window自定义事件
		window.dispatchEvent(
			new CustomEvent("onmessageWS", {
				detail: {
					data: e.data,
				},
			})
		);
	}
	reset();
}

const closeWebsocket = (e) => {
	console.log(`closeWebsocket=${JSON.stringify(e)}`)
}

const getSocket = () => {
	return socket
}

//断开连接
const close = () => {
	socket.close();
	//清除时间
	clearTimeout(timeoutObj);
	clearTimeout(serverTimeoutObj);
	clearTimeout(timeoutnum);
}
//具体问题具体分析,把需要用到的方法暴露出去
export default {
	initWebSocket,
	sendWebsocket,
	webSocketOnMessage,
	close,
	getSocket
};
