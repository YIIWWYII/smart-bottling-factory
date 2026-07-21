<template>
	<div class="auth-page">
		<section class="auth-brand">
			<div class="brand-mark"><img src="../../assets/hdc_demo.png" alt="系统标志"><div><b>智慧装瓶生产线</b><span>工业监测与控制平台</span></div></div>
			<div class="brand-main"><span class="plate">FACTORY CONTROL</span><h1>生产运营<br>后台管理系统</h1><p>统一管理产线运行、设备状态、质量报警、物料仓储和人员权限。</p></div>
			<div class="system-strip"><div><i></i><span>后端服务</span><b>8088</b></div><div><i></i><span>实时通道</span><b>MQTT</b></div><div><i></i><span>运行模式</span><b>SIMULATION</b></div></div>
		</section>
		<section class="auth-workspace">
			<div class="auth-form-wrap">
				<div class="auth-heading"><span>AUTHORIZED PERSONNEL ONLY</span><h2>账号登录</h2><p>使用已注册的管理端账号进入系统。</p></div>
				<el-form ref="form" :model="form" :rules="rules" @submit.native.prevent="submit">
					<el-form-item prop="username"><label>用户名</label><el-input v-model.trim="form.username" prefix-icon="el-icon-user" autocomplete="username" placeholder="请输入用户名" @keyup.enter.native="submit"></el-input></el-form-item>
					<el-form-item prop="password"><label>密码</label><el-input v-model="form.password" prefix-icon="el-icon-lock" type="password" show-password autocomplete="current-password" placeholder="请输入密码" @keyup.enter.native="submit"></el-input></el-form-item>
					<div class="form-options"><el-checkbox v-model="remember">记住用户名</el-checkbox><button type="button" @click="$router.push('/register')">注册只读账号</button></div>
					<el-button class="submit-button" type="primary" native-type="submit" :loading="loading">登录系统</el-button>
				</el-form>
				<div class="demo-account"><b>账号安全</b><span>初始凭据由项目负责人保管</span><small>首次登录后请创建正式管理员与操作员账号。</small></div>
			</div>
		</section>
	</div>
</template>

<script>
import auth from '@/store/auth.js'
export default {
	data() { return { loading: false, remember: true, form: { username: localStorage.getItem('hdcRememberUser') || 'admin', password: '' }, rules: { username: [{ required: true, message: '请输入用户名', trigger: 'blur' }], password: [{ required: true, message: '请输入密码', trigger: 'blur' }] } } },
	methods: {
		submit() { this.$refs.form.validate(async valid => { if (!valid || this.loading) return; this.loading = true; try { await auth.signIn(this.form); if (this.remember) localStorage.setItem('hdcRememberUser', this.form.username); else localStorage.removeItem('hdcRememberUser'); this.$message.success('登录成功'); this.$router.replace(this.$route.query.redirect || '/dashboard') } catch (error) { if (!error.response) this.$message.error(error.message || '登录失败') } finally { this.loading = false } }) }
	}
}
</script>

<style scoped>
.auth-page { display: grid; grid-template-columns: minmax(480px, 1.15fr) minmax(440px, .85fr); min-height: 100%; background: #12191c; }
.auth-brand { display: flex; flex-direction: column; min-height: 100vh; padding: 36px 52px; color: #eef1f1; overflow: hidden; border-right: 1px solid #475156; background-color: #172025; background-image: linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px); background-size: 32px 32px; }
.brand-mark { display: flex; align-items: center; gap: 12px; }.brand-mark img { width: 38px; height: 38px; object-fit: contain; }.brand-mark b, .brand-mark span { display: block; }.brand-mark b { font-size: 15px; }.brand-mark span { margin-top: 3px; color: #919da1; font-size: 10px; }
.brand-main { margin: auto 0; }.plate { display: inline-block; padding: 5px 8px; color: #172025; background: #e9aa24; font: bold 10px Consolas, monospace; }.brand-main h1 { margin: 18px 0 16px; font-size: 46px; line-height: 1.22; letter-spacing: 0; }.brand-main p { max-width: 560px; margin: 0; color: #aeb7ba; font-size: 14px; line-height: 1.8; }
.system-strip { display: grid; grid-template-columns: repeat(3, 1fr); border: 1px solid #4b565b; }.system-strip > div { display: grid; grid-template-columns: 8px 1fr; gap: 5px 8px; padding: 12px; border-left: 1px solid #4b565b; }.system-strip > div:first-child { border-left: 0; }.system-strip i { width: 7px; height: 7px; margin-top: 2px; border-radius: 50%; background: #55b977; }.system-strip span { color: #929da1; font-size: 9px; }.system-strip b { grid-column: 2; font: 11px Consolas, monospace; }
.auth-workspace { display: grid; place-items: center; min-height: 100vh; padding: 36px; background: #eef0f1; }.auth-form-wrap { width: min(390px, 100%); }.auth-heading span { color: #937019; font: bold 9px Consolas, monospace; letter-spacing: 1px; }.auth-heading h2 { margin: 9px 0 6px; color: #20292d; font-size: 27px; }.auth-heading p { margin: 0 0 25px; color: #788287; font-size: 12px; }.auth-form-wrap label { display: block; margin-bottom: 7px; color: #3d474b; font-size: 11px; font-weight: bold; }.auth-form-wrap :deep(.el-input__inner) { height: 43px; border-color: #aeb6b9; border-radius: 2px; }.form-options { display: flex; justify-content: space-between; align-items: center; margin: 4px 0 18px; }.form-options button { color: #7b5d13; border: 0; background: transparent; cursor: pointer; }.submit-button { width: 100%; height: 43px; border-color: #bc8618; border-radius: 2px; background: #c99220; font-weight: bold; }.submit-button:hover { border-color: #a97916; background: #ae7c19; }.demo-account { display: grid; grid-template-columns: auto 1fr; gap: 7px 11px; margin-top: 20px; padding: 12px; color: #465156; border-left: 3px solid #c99220; background: #dfe3e4; font-size: 10px; }.demo-account small { grid-column: 1 / -1; color: #7c868a; }
@media (max-width: 900px) { .auth-page { grid-template-columns: 1fr; }.auth-brand { min-height: 280px; padding: 24px; }.brand-main { margin: 34px 0; }.brand-main h1 { font-size: 34px; }.auth-workspace { min-height: auto; padding: 34px 20px; } }
</style>
