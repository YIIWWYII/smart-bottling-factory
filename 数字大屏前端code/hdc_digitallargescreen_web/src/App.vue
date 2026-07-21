<template>
	<div id="app">
		<router-view />
	</div>
</template>

<script>
	export default {}
</script>

<style>
html, body, #app { min-height: 100%; margin: 0; }

	#app {
		font-family: 'Avenir', Helvetica, Arial, sans-serif;
		-webkit-font-smoothing: antialiased;
		-moz-osx-font-smoothing: grayscale;
		/* text-align: center; */
		background-color: #ebebeb;
	}

	* {
		margin: 0;
		padding: 0;
		box-sizing: border-box;
	}

	body { overflow-x: hidden; overflow-y: auto; }
</style>
