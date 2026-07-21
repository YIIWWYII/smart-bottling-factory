import Vue from 'vue'
export default class DataOverviewData {
	// unknown:未激活;offline:离线;on:开灯;off:关灯;
	static getLineOption(res,title) {
		console.log("params res",res)
		return {
			animation: true, //控制动画示否开启
			animationDuration: 3000,
			animationEasing: "bounceOut", //缓动动画
			animationThreshold: 8, //动画元素的阈值
			tooltip: {
				trigger: "axis",
				backgroundColor: "rgba(0,0,0,.5)",
				axisPointer: {
					type: "cross",
					label: {
						backgroundColor: "rgba(0,0,0,.5)",
					},
				},
				textStyle: {
					color: "#fff",
					fontSize: 14,
				},
				// formatter: '{a} <br/>{a0}'+ ' ' + ' : {c}KWh'
				formatter: (params) => {
				    // 打印确认params是对象还是数组
				    console.log("paramsparams",params)
				    // 对象：取鼠标悬浮当前项索引params.dataIndex
				    // 数组：取鼠标悬浮当前项索引params[0].dataIndex
				    let index = params[0].dataIndex 
				    let obj = res[index] // 通过索引取当前项完整的接口返回值
					console.log("params obj",res, "。。。",index)
				    let str = `${title}<br/>
						        ${obj.date}<br/>
						        ${obj.value + 'KWh'}<br/>`
				    return str
				}
			},
			grid: {
				left: "5%", //图表距边框的距离
				right: "3%",
				top: "15%",
				bottom: "5%",
				containLabel: true,
			},
			xAxis: [{
				// axisLabel:{interval:0},
				nameGap: 3,
				nameTextStyle: {
					color: "rgba(255,255,255,.8)",
					fontSize: 12,
				},
				type: "category",
				data: "",
				boundaryGap: false, //从0开始
				axisLine: {
					onZero: true,
					rotate: 30, //坐标轴内容过长旋转
					interval: 1,
					lineStyle: {
						color: "#636E7C",
					},
				},
				axisLabel: {
					color: "rgba(255,255,255,.8)", //坐标的字体颜色
					fontSize: 12,
				},
				axisTick: {
					//坐标轴刻度颜色  x和y不交叉
					show: false,
				},
			},],
			yAxis: [{
				name: "单位(KWh)",
				nameLocation:"end",
				min: 0,
				max: function (value) {
					return Math.ceil(value.max / 5) * 5;
				},
				splitNumber: 5,
				type: "value",
				nameTextStyle: {
					color: "rgba(255,255,255,.89)",
					fontSize: 12,
				},
				splitLine: {
					// show: true,
					lineStyle: {
						color: "rgba(255,255,255,.25)",
						type: "dashed",
					},
				},
				axisTick: {
					//坐标轴刻度颜色
					show: false,
				},
				axisLine: {
					//坐标轴线颜色
					show: true,
					lineStyle: {
						color: "#636E7C",
					},
				},
				axisLabel: {
					color: "rgba(255,255,255,.8)", //坐标的字体颜色
					fontSize: 12,
				},
			},],
			series: [{
				name: "灯具能耗",
				type: "line",
				smooth: false,
				lineStyle: {
					color: "aqua",
					width: 1.5,
					type: "solid",
					shadowOffsetX: 0, // 折线的X偏移
					shadowOffsetY: 0, // 折线的Y偏移
					shadowBlur: 4, // 折线模糊
					shadowColor: "rgba(255, 255, 255, 0.8)", //设置折线阴影颜色
				},
				showSymbol: false, //是否默认展示圆点
				symbol: "circle", // 默认是空心圆（中间是白色的）
				symbolSize: 7,
				itemStyle: {
					color: "#021E47", //实圆的背景色
					borderWidth: 1,
					borderColor: "aqua",
				},
				areaStyle: {
					color: Vue.prototype.$echarts.graphic.LinearGradient(0, 1, 0, 0, [{
						offset: 1,
						color: "rgba(0, 255, 255, 0.9)",
					},
					{
						offset: 0.5,
						color: "rgba(0, 255, 255, 0.4)",
					},
					{
						offset: 0,
						color: "rgba(220,120,40,0.1)",
					},
					]),
				},
				emphasis: {
					focus: "series",
				},
				data: [0, 20, 40, 60, 80, 100, 120],
			},
			{
				showSymbol: false,
				name: "灯具能耗",
				type: "lines",
				polyline: true,
				smooth: false,
				coordinateSystem: "cartesian2d",
				zlevel: 1,
				effect: {
					show: true,
					smooth: true,
					period: 8,
					symbolSize: 4,
				},
				lineStyle: {
					color: "#fff",
					width: 10,
					opacity: 0,
					curveness: 0,
					cap: "round",
				},
				data: "",
			},
			],
		};
	}
}