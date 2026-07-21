<!-- Use preprocessors via the lang attribute! e.g. <template lang="pug"> -->
<template>
  <div id="app">
    <div class="crayon-clock">
      <div class="crayon-clock-time">{{ date }} {{ time }} </div>
      <div class="crayon-clock-date">
        <!-- <span style="width: 500px; white-space: nowrap; ">{{ date }}{{ week }}</span> -->
        <!-- <span class="week"></span> -->
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: "CrayonClock",
  components: {},
  data() {
    return {
      time: "",
      date: "",
      week: "",
      timerHelper: false
    };
  },
  mounted() {
    this.timerHelper = setInterval(this.updateTime, 1000);
  },
  beforeDestroy() {
    if (this.timerHelper) {
      clearInterval(this.timerHelper);
      this.timerHelper = false;
    }
  },
  methods: {
    zeroPadding(num, digit) {
      let zero = "";
      for (let i = 0; i < digit; i++) {
        zero += "0";
      }
      return (zero + num).slice(-digit);
    },
    updateTime() {
      const week = [
        "星期日",
        "星期一",
        "星期二",
        "星期三",
        "星期四",
        "星期五",
        "星期六"
      ];
      const cd = new Date();
      this.time =
        this.zeroPadding(cd.getHours(), 2) +
        ":" +
        this.zeroPadding(cd.getMinutes(), 2) +
        ":" +
        this.zeroPadding(cd.getSeconds(), 2);
      this.date =
        this.zeroPadding(cd.getFullYear(), 4) +
        "年" +
        this.zeroPadding(cd.getMonth() + 1, 2) +
        "月" +
        this.zeroPadding(cd.getDate(), 2) +
		"日";

      this.week = week[cd.getDay()];
    }
  }
};
</script>

<!-- Use preprocessors via the lang attribute! e.g. <style lang="scss"> -->
<style lang="less" scoped>
html,
body {
  // height: 100%;
  margin: 0;
}
body {
  background: #0f3854;
  background: radial-gradient(ellipse at center, #0a2e38 0%, #000000 70%);
  // background-size: 100%;
}
#app {
	display: flex;
	flex-direction: row;
	align-items: center;
	position: absolute;
	/* 设置绝对定位 */
	// top: 50%;
	/* 调整文本的垂直位置 */
	// left: 50%;
	/* 调整文本的水平位置 */
	// transform: translate(-50%, -50%);
	
	
  text-align: center;
  color: #2c3e50;
  // margin-top: 60px;
  // width: 300px;
   height: 20px;
   // margin-bottom: 20px;
   // margin-right: 1000px;
   //todo
   margin-left: 1600px;
   margin-top: -40px;
}

.crayon-clock {
  // font-family:  -apple-system, BlinkMacSystemFont, Roboto, Open Sans, Helvetica Neue, sans-serif;
  font-family: 'myfont';
  color: #fff;
  text-align: center;
  position: absolute;
  // left: 50%;
  // top: 50%;
  // -webkit-transform: translate(-50%, -50%);
  // transform: translate(-50%, -50%);
  color: #daf6ff;
  text-shadow: 0 0 20px #0aafe6, 0 0 20px rgba(10, 175, 230, 0);
  width: 400px;
}
.crayon-clock-time {
  letter-spacing: 0.05em;
  font-size: 12px;
  text-align: left;
  // padding: 20px 0 0;
}
.crayon-clock-date {
  letter-spacing: 0.1em;
  font-size: 12px;
  // width: 600px;
}
</style>
