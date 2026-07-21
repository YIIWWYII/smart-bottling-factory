<template>
	<div class="divroot">
		<ScaleScreen :width="1920" :height="1137" :selfAdaption="true" :alignTop="false">
			<div class="root">
				<div style="display: flex; flex-direction: column; height:48px;">
					<div style='position: relative;'>
						<div style="position:absolute; margin-top: 24px; height:48px;">
							<img style='position:absolute; width:1920px; height:74px;'
								src="../assets/dataOverview/title.png"></img>
							<img style="position:absolute; margin-top: 55px; margin-left: 25px;"
								src="../assets/dataOverview/address.png">
							</img>
							<div @click="SetClick()"
								style="position:absolute; margin-top: 55px; margin-left: 60px; width:300px; font-size: 16px; color: white; opacity:0.5;">
								{{cityValue}}
							</div>
							<CrayonClock style="position:absolute; margin-top: 55px; margin-left: 1615px;">
							</CrayonClock>
						</div>
					</div>
				</div>

				<div style="position:relative; margin-left: 25px;">
					<img style="position:absolute; width: 610px; margin-top: 60px;"
						src="../assets/dataOverview/plate_1.png"></img>
					<div
						style="position:absolute; margin-top: 75px; margin-left: 20px; font-family: 'myfont'; color: white;">
						入场统计</div>
					<img style="position:absolute; margin-top: 75px; margin-left: 110px;"
						src="../assets/dataOverview/titleanim.webp"></img>
					<img style="position:absolute; margin-top: 67px; margin-left: 470px;"
						src="../assets/dataOverview/mini_tab.png"></img>
					<div
						style="position:absolute; margin-top: 72px; margin-left: 490px; font-size: 14px; color: white;">
						今日</div>
					<div
						style="position:absolute; margin-top: 72px; margin-left: 553px; font-size: 14px; color: white; opacity:0.5;">
						本月</div>
					<img style="position:absolute; height:140px; width:140px; margin-top: 150px; margin-left: 27px;"
						src="../assets/dataOverview/guest.png"></img>
					<div
						style="position:absolute; margin-top: 150px; margin-left: 167px; font-size: 20px; color: white; opacity:0.5;">
						访客</div>
					<div
						style="position:absolute; margin-top: 200px; margin-left: 167px; font-family: 'myfont'; font-size: 45px; color: white;">
						{{dataVisitor.data.today.visitor}}
					</div>
					<div
						style="position:absolute; margin-top: 225px; margin-left: 266px; font-size: 20px; color: white; opacity:0.5;">
						次</div>

					<img style="position:absolute; height:140px; width:140px; margin-top: 150px; margin-left: 305px;"
						src="../assets/dataOverview/production.png"></img>
					<div
						style="position:absolute; margin-top: 150px; margin-left: 450px; font-size: 20px; color: white; opacity:0.5;">
						生产员</div>
					<div
						style="position:absolute; margin-top: 200px; margin-left: 450px; font-family: 'myfont'; font-size: 45px; color: white;">
						{{dataVisitor.data.today.employee}}
					</div>
					<div
						style="position:absolute; margin-top: 225px; margin-left: 547px; font-size: 20px; color: white; opacity:0.5;">
						次</div>
					<div
						style="position:absolute; margin-top: 300px; margin-left: 32px; font-size: 18px; color: white; opacity:0.5;">
						最近3小时内入场人数：{{dataVisitor.data.last3Hours}}</div>
				</div>
				<div style="position:relative; margin-left: 1285px; margin-top: 0px;">
					<img style="position:absolute; width: 610px; margin-top: 60px;"
						src="../assets/dataOverview/plate_4.png"></img>
					<div
						style="position:absolute; margin-top: 75px; margin-left: 20px; font-family: 'myfont'; color: white;">
						设备告警清单</div>
					<img style="position:absolute; margin-top: 75px; margin-left: 150px;"
						src="../assets/dataOverview/titleanim.webp"></img>
					<img style="position:absolute; margin-top: 67px; margin-left: 510px;"
						src="../assets/dataOverview/selector.png"></img>
					<div
						style="position:absolute; margin-top: 70px; margin-left: 525px; font-size: 16px; color: #73B1F9; opacity: 0.8;">
						机械臂</div>
					<div
						style="position:absolute; margin-top: 120px; margin-left: 52px; font-size: 16px; color: #FFFFFF;">
						故障原因</div>
					<div
						style="position:absolute; margin-top: 120px; margin-left: 201px; font-size: 16px; color: #FFFFFF;">
						告警级别</div>
					<div
						style="position:absolute; margin-top: 120px; margin-left: 355px; font-size: 16px; color: #FFFFFF;">
						故障时间</div>
					<div
						style="position:absolute; margin-top: 120px; margin-left: 503px; font-size: 16px; color: #FFFFFF;">
						恢复时间</div>

					<ul infinite-scroll-disabled="disabled"
						style="list-style-type: none; position:absolute; margin-top: 140px;">
						<li v-for="(i, index) in dataEquipment.data.failureMap.MG400" :key="index"
							style="width: 590px; height:55px;">

							<div v-show="index < 5 ? true : false" style=" width: 590px; height:55px;">
								
								<div
									style="position:absolute; margin-top:25px; margin-left: 50px; font-size: 18px; color: #FFFFFF; opacity: 0.6;">
									{{i.failureName}}
								</div>
								<div style="position:absolute;margin-top:25px; margin-left: 200px; font-size: 18px; color: #FFFFFF; opacity: 1.0;"
									:style="{color: getColor(i.failureLevel)}">
									{{i.failureLevel}}
								</div>
								<div
									style="position:absolute;margin-top:25px; margin-left: 350px; font-size: 18px; color: #FFFFFF; opacity: 0.6;">
									{{i.failureTimeStr}}
								</div>
								<div
									style="position:absolute;margin-top:25px; margin-left: 500px; font-size: 18px; color: #FFFFFF; opacity: 0.6;">
									{{i.failureRecoverTimeStr}}
								</div>
								<div v-show="index % 2==0 ? true : false"
									style="position:absolute; margin-top:12.5px; margin-left:10px; width: 590px; height:55px; background: #FFFFFF; opacity:0.04;">
								</div>
							</div>
						</li>
					</ul>
				</div>
				<div style="position:relative; margin-top: 310px; margin-left: 25px;">
					<img style="position:absolute; width: 290px; margin-top: 60px;"
						src="../assets/dataOverview/plate_2.png"></img>
					<div
						style="position:absolute; margin-top: 75px; margin-left: 20px; font-family: 'myfont'; color: white;">
						质检通过率</div>
					<img style="position:absolute; margin-top: 75px; margin-left: 130px;"
						src="../assets/dataOverview/titleanim.webp"></img>
					<img style="position:absolute; margin-left:70px; margin-top: 140px;"
						src="../assets/dataOverview/chart_circle_bg.png"></img>
					<div
						style="position:absolute; margin-top: 200px; margin-left: 84px; font-family: 'myfont'; font-size:30px; color: white; width: 85px; text-align: right;">
						{{dataProduct.data.qualityPassRate.rate}}
					</div>
					<div
						style="position:absolute; margin-top: 210px; margin-left: 175px; font-family: 'myfont'; font-size:20px; color: white;">
						%</div>
					<div id="deviceChart"
						style="margin-left:60px; margin-top: 130px; width:180px; height:180px;float:left;">
					</div>
					<div
						style="position:absolute; margin-top: 330px; margin-left: 66px;font-size:14px; color: white; opacity: 0.5;">
						受检量：</div>
					<div
						style="position:absolute; margin-top: 328px; margin-left: 150px; font-family: 'myfont'; font-size:18px; color: white;">
						{{dataProduct.data.qualityPassRate.countTotal}}
					</div>
					<div
						style="position:absolute; margin-top: 330px; margin-left: 220px;font-size:14px; color: white; opacity: 0.5;">
						件</div>
					<div
						style="position:absolute; margin-top: 370px; margin-left: 66px;font-size:14px; color: white; opacity: 0.5;">
						通过量：</div>
					<div
						style="position:absolute; margin-top: 368px; margin-left: 150px; font-family: 'myfont'; font-size:18px; color: #38D9EE;">
						{{dataProduct.data.qualityPassRate.countPass}}
					</div>
					<div
						style="position:absolute; margin-top: 370px; margin-left: 220px;font-size:14px; color: white; opacity: 0.5;">
						件</div>
				</div>
				<div style="position:relative; margin-left: 340px; margin-top: 310px;">
					<img style="position:absolute; width: 290px; margin-top: 60px;"
						src="../assets/dataOverview/plate_2.png"></img>
					<div
						style="position:absolute; margin-top: 75px; margin-left: 20px; font-family: 'myfont'; color: white;">
						物料齐套率</div>
					<img style="position:absolute; margin-top: 75px; margin-left: 130px;"
						src="../assets/dataOverview/titleanim.webp"></img>
					<img style="position:absolute; width:163px; height: 128px; margin-top: 130px; margin-left: 70px;"
						src="../assets/dataOverview/base.webp"></img>
					<div
						style="position:absolute; margin-top: 155px; margin-left: 95px; font-family: 'myfont'; font-size:31px; color: white;">
						{{dataProduct.data.materialCompletionRate.rate}}
					</div>
					<div
						style="position:absolute; margin-top: 165px; margin-left: 195px; font-family: 'myfont'; font-size:20px; color: white;">
						%</div>
					<img style="position:absolute; width:17px; height: 17px; margin-left: 40px; margin-top: 280px;"
						src="../assets/dataOverview/part1.png">
					<img style="position:absolute; width:17px; height: 17px; margin-left: 171px; margin-top: 280px;"
						src="../assets/dataOverview/part1.png">
					<img style="position:absolute; width:17px; height: 17px; margin-left: 40px; margin-top: 350px;"
						src="../assets/dataOverview/part2.png">
					<img style="position:absolute; width:17px; height: 17px; margin-left: 171px; margin-top: 350px;"
						src="../assets/dataOverview/part2.png">

					<div
						style="position:absolute; margin-top: 280px; margin-left: 70px;font-size:14px; color: white; opacity: 0.5;">
						配件1</div>
					<div
						style="position:absolute; margin-top: 280px; margin-left: 200px;font-size:14px; color: white; opacity: 0.5;">
						配件3</div>
					<div
						style="position:absolute; margin-top: 350px; margin-left: 70px;font-size:14px; color: white; opacity: 0.5;">
						配件2</div>
					<div
						style="position:absolute; margin-top: 350px; margin-left: 200px;font-size:14px; color: white; opacity: 0.5;">
						配件4</div>

					<div
						style="position:absolute; margin-top: 305px; margin-left: 70px;font-family: 'myfont';font-size:18px; color: white;">
						{{dataProduct.data.materialCompletionRate.m1}}
					</div>
					<div
						style="position:absolute; margin-top: 305px; margin-left: 200px;font-family: 'myfont';font-size:18px; color: white;">
						{{dataProduct.data.materialCompletionRate.m2}}
					</div>
					<div
						style="position:absolute; margin-top: 375px; margin-left: 70px;font-family: 'myfont';font-size:18px; color: white;">
						{{dataProduct.data.materialCompletionRate.m3}}
					</div>
					<div
						style="position:absolute; margin-top: 375px; margin-left: 200px;font-family: 'myfont';font-size:18px; color: white;">
						{{dataProduct.data.materialCompletionRate.m4}}
					</div>
				</div>
				<div style="position:relative; margin-left: 1285px; margin-top: 400px;">
					<img style="position:absolute; width: 610px; margin-top: 60px;"
						src="../assets/dataOverview/plate_1.png"></img>
					<div
						style="position:absolute; margin-top: 75px; margin-left: 20px; font-family: 'myfont'; color: white;">
						今日出入库</div>
					<img style="position:absolute; margin-top: 75px; margin-left: 130px;"
						src="../assets/dataOverview/titleanim.webp"></img>
					<img style="position:absolute; margin-top: 67px; margin-left: 470px;"
						src="../assets/dataOverview/mini_tab.png"></img>
					<div
						style="position:absolute; margin-top: 72px; margin-left: 490px; font-size: 14px; color: white;">
						入库</div>
					<div
						style="position:absolute; margin-top: 72px; margin-left: 553px; font-size: 14px; color: white; opacity:0.5;">
						出库</div>
					<div id="deviceChart2"
						style="position:absolute; margin-left:40px; margin-top: 120px; width:213px; height:213px;float:left;">
					</div>
					<div
						style="position:absolute; margin-top: 202px; margin-left: 110px;font-family: 'myfont';font-size:26px; color: white;text-align: center; width:70px;">
						{{dataProduct.data.store4Today.in.total}}
					</div>
					<div
						style="position:absolute; margin-top: 232px; margin-left: 119px; font-size: 14px; color: white; opacity:0.6;">
						总入库量</div>
					<div
						style="position:absolute;margin-top: 170px; margin-left: 288px; width: 15px; height: 15px; background: #FFA200; border-radius: 7px 8px 8px 8px;">
					</div>
					<div
						style="position:absolute; margin-top: 168px; margin-left: 315px; font-size: 14px; color: white; opacity:0.6;">
						{{this.keys.length > 0 ? this.keys[0] : ''}}
					</div>
					<div
						style="position:absolute; margin-top: 198px; margin-left: 315px; font-family: 'myfont'; font-size: 14px; color: white;">
						{{keys.length > 0 ? dataProduct.data.store4Today.in.rate[keys[0]]:0}} %
					</div>
					<div
						style="position:absolute;margin-top: 250px; margin-left: 288px; width: 15px; height: 15px; background: #38EE44; border-radius: 7px 8px 8px 8px;">
					</div>
					<div
						style="position:absolute; margin-top: 168px; margin-left: 480px; font-size: 14px; color: white; opacity:0.6;">
						{{this.keys.length > 1 ? this.keys[1] : ''}}
					</div>
					<div
						style="position:absolute; margin-top: 198px; margin-left: 480px; font-family: 'myfont'; font-size: 14px; color: white;">
						{{keys.length > 1 ? dataProduct.data.store4Today.in.rate[keys[1]]:0}}%
					</div>
					<div
						style="position:absolute;margin-top: 170px; margin-left: 453px; width: 15px; height: 15px; background: #3AA4D4; border-radius: 7px 8px 8px 8px;">
					</div>
					<div
						style="position:absolute; margin-top: 248px; margin-left: 315px; font-size: 14px; color: white; opacity:0.6;">
						{{this.keys.length > 2 ? this.keys[2] : ''}}
					</div>
					<div
						style="position:absolute; margin-top: 278px; margin-left: 315px; font-family: 'myfont'; font-size: 14px; color: white;">
						{{keys.length > 2 ? dataProduct.data.store4Today.in.rate[keys[2]]:0}}%
					</div>
					<div
						style="position:absolute;margin-top: 250px; margin-left: 453px; width: 15px;height: 15px;background: #8D38EE;border-radius: 7px 8px 8px 8px;">
					</div>
					<div
						style="position:absolute; margin-top: 248px; margin-left: 480px; font-size: 14px; color: white; opacity:0.6;">
						{{this.keys.length > 3 ? this.keys[3] : ''}}
					</div>
					<div
						style="position:absolute; margin-top: 278px; margin-left: 480px; font-family: 'myfont'; font-size: 14px; color: white;">
						{{keys.length > 3 ? dataProduct.data.store4Today.in.rate[keys[3]]:0}}%
					</div>
				</div>
				<div v-show="true" style="position:relative; margin-top: 710px; margin-left: 25px;">
					<img style="position:absolute; width: 927px; margin-top: 60px;"
						src="../assets/dataOverview/plate_5.png"></img>
					<div
						style="position:absolute; margin-top: 75px; margin-left: 20px; font-family: 'myfont'; color: white;">
						产品产量统计</div>
					<img style="position:absolute; margin-top: 67px; margin-left: 810px;"
						src="../assets/dataOverview/selector.png"></img>
					<div
						style="position:absolute; margin-top: 70px; margin-left: 830px; font-size: 16px; color: #73B1F9; opacity: 0.8;">
						电视</div>
					<img style="position:absolute; margin-top: 75px; margin-left: 150px;"
						src="../assets/dataOverview/titleanim.webp"></img>
					<div id="deviceChart4"
						style="position:absolute; margin-left:45px; margin-top: 75px; width:550px; height:330px;float:left;">
					</div>

					<div
						style="position:absolute; margin-top: 110px; margin-left: 565px; font-size: 14px; color: #FFFFFF; opacity: 0.6;">
						计划产量</div>
					<div
						style="position:absolute; margin-top: 110px; margin-left: 693px; font-size: 14px; color: #FFFFFF; opacity: 0.6;">
						完成产量</div>
					<div
						style="position:absolute; margin-top: 110px; margin-left: 817px; font-size: 14px; color: #FFFFFF; opacity: 0.6;">
						完成率</div>
					<div
						style="position:absolute; margin-top: 110px; margin-left: 817px; font-size: 14px; color: #FFFFFF; opacity: 0.6;">
						完成率</div>
					<div
						style="position:absolute; margin-top: 150px; margin-left: 581px; font-size: 14px; color: #FFFFFF; opacity: 0.6;">
						{{keysForTypeModel.length>0 ? dataProduct.data.productionByTypeAndModel.T9527[keysForTypeModel[0]].planned : 0}}
					</div>
					<div
						style="position:absolute; margin-top: 150px; margin-left: 706px; font-size: 14px; color: #FFFFFF; opacity: 0.6;">
						{{keysForTypeModel.length>0?dataProduct.data.productionByTypeAndModel.T9527[keysForTypeModel[0]].actual:0}}
					</div>
					<div
						style="position:absolute; margin-top: 150px; margin-left: 813px; font-family: 'myfont'; font-size: 16px; color: #FFFFFF; opacity: 0.6;">
						{{keysForTypeModel.length>0?dataProduct.data.productionByTypeAndModel.T9527[keysForTypeModel[0]].rate:0}}%
					</div>
					<div
						style="position:absolute; margin-top: 200px; margin-left: 581px; font-size: 14px; color: #FFFFFF; opacity: 0.6;">
						{{keysForTypeModel.length>1 ? dataProduct.data.productionByTypeAndModel.T9527[keysForTypeModel[1]].planned : 0}}
					</div>
					<div
						style="position:absolute; margin-top: 200px; margin-left: 706px; font-size: 14px; color: #FFFFFF; opacity: 0.6;">
						{{keysForTypeModel.length>1?dataProduct.data.productionByTypeAndModel.T9527[keysForTypeModel[1]].actual:0}}
					</div>
					<div
						style="position:absolute; margin-top: 200px; margin-left: 813px; font-family: 'myfont'; font-size: 16px; color: #FFFFFF; opacity: 0.6;">
						{{keysForTypeModel.length>1?dataProduct.data.productionByTypeAndModel.T9527[keysForTypeModel[1]].rate:0}}%
					</div>
					<div
						style="position:absolute; margin-top: 250px; margin-left: 581px; font-size: 14px; color: #FFFFFF; opacity: 0.6;">
						{{keysForTypeModel.length>2 ? dataProduct.data.productionByTypeAndModel.T9527[keysForTypeModel[2]].planned : 0}}
					</div>
					<div
						style="position:absolute; margin-top: 250px; margin-left: 706px; font-size: 14px; color: #FFFFFF; opacity: 0.6;">
						{{keysForTypeModel.length>2?dataProduct.data.productionByTypeAndModel.T9527[keysForTypeModel[2]].actual:0}}
					</div>
					<div
						style="position:absolute; margin-top: 250px; margin-left: 813px; font-family: 'myfont'; font-size: 16px; color: #FFFFFF; opacity: 0.6;">
						{{keysForTypeModel.length>2?dataProduct.data.productionByTypeAndModel.T9527[keysForTypeModel[2]].rate:0}}%
					</div>
					<div
						style="position:absolute; margin-top: 300px; margin-left: 581px; font-size: 14px; color: #FFFFFF; opacity: 0.6;">
						{{keysForTypeModel.length>3 ? dataProduct.data.productionByTypeAndModel.T9527[keysForTypeModel[3]].planned : 0}}
					</div>
					<div
						style="position:absolute; margin-top: 300px; margin-left: 706px; font-size: 14px; color: #FFFFFF; opacity: 0.6;">
						{{keysForTypeModel.length>3?dataProduct.data.productionByTypeAndModel.T9527[keysForTypeModel[3]].actual:0}}
					</div>
					<div
						style="position:absolute; margin-top: 300px; margin-left: 813px; font-family: 'myfont'; font-size: 16px; color: #FFFFFF; opacity: 0.6;">
						{{keysForTypeModel.length>3?dataProduct.data.productionByTypeAndModel.T9527[keysForTypeModel[3]].rate:0}}%
					</div>
					<img style="position:absolute; margin-top:180px; margin-left:40px; width: 850px; height: 1px;"
						src="../assets/dataOverview/divider.png"></img>
					<img style="position:absolute; margin-top:230px; margin-left:40px; width: 850px; height: 1px;"
						src="../assets/dataOverview/divider.png"></img>
					<img style="position:absolute; margin-top:280px; margin-left:40px; width: 850px; height: 1px;"
						src="../assets/dataOverview/divider.png"></img>
				</div>
				<div style="position:relative; margin-left: 972px; margin-top: 710px;">
					<img style="position:absolute; width: 927px; margin-top: 60px;"
						src="../assets/dataOverview/plate_5.png"></img>
					<div
						style="position:absolute; margin-top: 75px; margin-left: 20px; font-family: 'myfont'; color: white;">
						年度产量总览</div>
					<img style="position:absolute; margin-top: 75px; margin-left: 150px;"
						src="../assets/dataOverview/titleanim.webp"></img>
					<div id="deviceChart3"
						style="position:absolute; margin-left:45px; margin-top: 110px; width:920px; height:300px;float:left;">
					</div>
					<div
						style="position:absolute; margin-left: 730px; margin-top: 120px; width: 16px; height: 15px; background: #6CE0F8; border-radius: 1px 1px 1px 1px;">
					</div>
					<div
						style="position:absolute; margin-left: 750px; margin-top: 120px; font-size: 12px; color: rgba(255,255,255,0.6);">
						计划产量
					</div>
					<div
						style="position:absolute; margin-left: 839px; margin-top: 120px; width: 16px; height: 15px; background: #2DDEB0; border-radius: 1px 1px 1px 1px;">
					</div>
					<div
						style="position:absolute; margin-left: 859px; margin-top: 120px; font-size: 12px; color: rgba(255,255,255,0.6);">
						实际产量
					</div>
				</div>
				<div style="position:relative; margin-left: 655px; margin-top: -700px;">
					<img style="position:absolute; width: 610px; margin-top: 60px;"
						src="../assets/dataOverview/plate_3.png"></img>
					<div
						style="position:absolute; margin-top: 75px; margin-left: 20px; font-family: 'myfont'; color: white;">
						产线运行状态</div>
					<img style="position:absolute; margin-top: 75px; margin-left: 150px;"
						src="../assets/dataOverview/titleanim.webp"></img>
					<img style="position:absolute; margin-top: 67px; margin-left: 510px;"
						src="../assets/dataOverview/selector.png"></img>
					<div
						style="position:absolute; margin-top: 70px; margin-left: 525px; font-size: 16px; color: #73B1F9; opacity: 0.8;">
						产线A</div>

					<img style="position:absolute; height:125px; width:150px; margin-top: 145px; margin-left: 30px;"
						:src="dataEquipment.data.switches[0] == 0 ? require('../assets/dataOverview/machine_off.png') : require('../assets/dataOverview/yunxingzhongjichuang.webp')"></img>
					<img style="position:absolute; height:125px; width:150px; margin-top: 145px; margin-left: 319px;"
						:src="dataEquipment.data.switches[1] == 0 ? require('../assets/dataOverview/machine_off.png') : require('../assets/dataOverview/yunxingzhongjichuang.webp')"></img>
					<img style="position:absolute; height:125px; width:150px; margin-top: 320px; margin-left: 30px;"
						:src="dataEquipment.data.switches[2] == 0 ? require('../assets/dataOverview/machine_off.png') : require('../assets/dataOverview/yunxingzhongjichuang.webp')"></img>
					<img style="position:absolute; height:125px; width:150px; margin-top: 320px; margin-left: 319px;"
						:src="dataEquipment.data.switches[3] == 0 ? require('../assets/dataOverview/machine_off.png') : require('../assets/dataOverview/yunxingzhongjichuang.webp')"></img>
						
					<div
						style="position:absolute; margin-top: 180px; margin-left: 194px; font-size: 20px; color: white; opacity:0.5;">
						1号机床</div>
					<div
						style="position:absolute; margin-top: 180px; margin-left: 483px; font-size: 20px; color: white; opacity:0.5;">
						2号机床</div>
					<div
						style="position:absolute; margin-top: 355px; margin-left: 194px; font-size: 20px; color: white; opacity:0.5;">
						3号机床</div>
					<div
						style="position:absolute; margin-top: 355px; margin-left: 483px; font-size: 20px; color: white; opacity:0.5;">
						4号机床</div>

					<div style="position:absolute; margin-top: 210px; margin-left: 194px; font-size: 20px; color: #38D9EE;"
						:style="{color: getSwitchesColor(dataEquipment.data.switches[0])}">
						{{dataEquipment.data.switches[0] == 0 ? '待机' : '运行中'}}
					</div>
					<div style="position:absolute; margin-top: 210px; margin-left: 483px; font-size: 20px; color: #38D9EE;"
						:style="{color: getSwitchesColor(dataEquipment.data.switches[1])}">
						{{dataEquipment.data.switches[1] == 0 ? '待机' : '运行中'}}
					</div>
					<div style="position:absolute; margin-top: 385px; margin-left: 194px; font-size: 20px; color: #E67E15;"
						:style="{color: getSwitchesColor(dataEquipment.data.switches[2])}">
						{{dataEquipment.data.switches[2] == 0 ? '待机' : '运行中'}}
					</div>
					<div style="position:absolute; margin-top: 385px; margin-left: 483px; font-size: 20px; color: #38D9EE;"
						:style="{color: getSwitchesColor(dataEquipment.data.switches[3])}">
						{{dataEquipment.data.switches[3] == 0 ? '待机' : '运行中'}}
					</div>
					<img style="position:absolute; margin-top: 500px; margin-left: 30px;"
						src="../assets/dataOverview/kuang.png"></img>
					<img style="position:absolute; margin-top: 430px; margin-left: 17px;"
						src="../assets/dataOverview/ani_chanxian_bg.png"></img>
					<img style="position:absolute; margin-top: 588px; margin-left: 8px;"
						src="../assets/dataOverview/chanxian_bg.png"></img>
					<img style="position:absolute; margin-top: 500px; margin-left: 30px;"
						src="../assets/dataOverview/kuang.png"></img>
					<img style="position:absolute; margin-top: 500px; margin-left: 227px;"
						src="../assets/dataOverview/kuang.png"></img>
					<img style="position:absolute; margin-top: 500px; margin-left: 424px;"
						src="../assets/dataOverview/kuang.png"></img>
					<img style="position:absolute; margin-top: 525px; margin-left: 51px;"
						src="../assets/dataOverview/ic_run_time.png"></img>
					
					<div style="position:absolute; margin-top: 470px; margin-left: 50px; background: #143647; height: 1px; width: 200px; opacity: 1;"></div>
					<div style="position:absolute; margin-top: 470px; margin-left: 370px; background: #143647; height: 1px; width: 200px; opacity: 1;"></div>
					
					<div
						style="position:absolute; margin-top: 460px; margin-left: 284px; font-size: 17px; color: white; opacity: 0.6;">
						1号机床</div>
					
					<div
						style="position:absolute; margin-top: 515px; margin-left: 88px; font-size: 16px; color: white; opacity: 0.6;">
						运行总时长</div>
					<div
						style="position:absolute; margin-top: 545px; margin-left: 88px; font-size: 14px; font-family: 'myfont'; color: white;">
						{{dataEquipment.data.machineInfo.runTime}}
					</div>

					<img style="position:absolute; margin-top: 525px; margin-left: 251px;"
						src="../assets/dataOverview/ic_standby_time.png"></img>
					<div
						style="position:absolute; margin-top: 515px; margin-left: 284px; font-size: 16px; color: white; opacity: 0.6;">
						待机时长</div>
					<div
						style="position:absolute; margin-top: 545px; margin-left: 284px; font-size: 14px; font-family: 'myfont'; color: white;">
						{{dataEquipment.data.machineInfo.waitTime}}
					</div>

					<img style="position:absolute; margin-top: 525px; margin-left: 465px;"
						src="../assets/dataOverview/ic_responsible.png"></img>
					<div
						style="position:absolute; margin-top: 515px; margin-left: 502px; font-size: 16px; color: white; opacity: 0.6;">
						负责人</div>
					<div
						style="position:absolute; margin-top: 545px; margin-left: 502px; font-size: 14px; font-family: 'myfont'; color: white;">
						{{dataEquipment.data.machineInfo.operator}}
					</div>
					<img style="position:absolute; margin-top: 640px; margin-left: 38px;"
						src="../assets/dataOverview/line_efficency.png"></img>
					<div
						style="position:absolute; margin-top: 640px; margin-left: 98px; font-size: 14px; color: white; opacity: 0.6;">
						产线设备效率</div>
					<div
						style="position:absolute; margin-top: 665px; margin-left: 98px; font-size: 22px; font-family: 'myfont'; color: white;">
						{{dataEquipment.data.machineInfo.efficiency}}
					</div>
					<img style="position:absolute; margin-top: 640px; margin-left: 223px;"
						src="../assets/dataOverview/line_quality.png"></img>
					<div
						style="position:absolute; margin-top: 640px; margin-left: 288px; font-size: 14px; color: white; opacity: 0.6;">
						质量合格率</div>
					<div
						style="position:absolute; margin-top: 665px; margin-left: 288px; font-size: 22px; font-family: 'myfont'; color: white;">
						{{dataEquipment.data.machineInfo.qualityRate}}
					</div>
					<img style="position:absolute; margin-top: 640px; margin-left: 426px;"
						src="../assets/dataOverview/text.png"></img>
					<img style="position:absolute; margin-top: 665px; margin-left: 433px;"
						src="../assets/dataOverview/mini_tab.png"></img>
					<div
						style="position:absolute; margin-top: 670px; margin-left: 454px; font-size: 14px; color: white;">
						本周</div>
					<div
						style="position:absolute; margin-top: 670px; margin-left: 516px; font-size: 14px; color: white; opacity:0.5;">
						本月</div>
				</div>

			</div>
		</ScaleScreen>
	</div>
</template>

<script>
	// 引入组件
	import VueGridLayout from 'vue-grid-layout'
	import ScaleScreen from '@/views/scale-screen.vue'
	import Utils from '../utils/Utils.ts'
	import DataOverviewData from '../utils/DataOverviewData.ts'
	import {
		Service,
		ServiceGet,
		ServiceDownload,
		ServiceUpload
	} from '@/api/Service.js';
	import Local from '@/store/localSave.js'
	import CrayonClock from './clock.vue'
	export default {
		components: {
			ScaleScreen,
			GridLayout: VueGridLayout.GridLayout,
			GridItem: VueGridLayout.GridItem,
			CrayonClock,
		},
		methods: {
			async initWebSocket() {
				// 获取id 保存成功，初始化websocket
				console.log('Local.getId() =' + Local.getId())
				console.log('Local.getCity() =' + Local.getCity())
				if (Local.getId() !== null) {
					this.$websocket.initWebSocket();
					// 监听数据
					window.addEventListener("onmessageWS", this.getSocketData);
					this.cityValue = Local.getCity() + "  " + Local.getRegion()
				} else {
					this.cityValue = '请设置展区'
				}

			},

			getSocketData(res) {
				console.info(res)
				let data0 = JSON.parse(res.detail.data)
				// console.log('getSocketData1:', res.detail.data)
				// TODO 更新界面
				if (data0.type == "visitor") {
					console.log("getSocketData=visitor", res.detail.data);
					this.dataVisitor = data0
				}
				if (data0.type == "equipment") {
					console.log("getSocketData=equipment", res.detail.data);
					this.dataEquipment = data0
				}
				if (data0.type == "product") {
					console.log("getSocketData=product", res.detail.data);
					this.dataProduct = data0
					this.initStore4Today();
					this.initProductionByMonth();
					this.initProductionByTypeAndModel();
				}
			},

			initProductionByTypeAndModel() {
				this.keysForTypeModel = Object.keys(this.dataProduct.data.productionByTypeAndModel.T9527);
				const pathSymbols4 = {
					green: 'image://data:image/png;base64,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',
				};

				const labelSetting4 = {
					show: false,
					position: 'right',
					offset: [10, 0],
					fontSize: 16
				};
				let option4 = {
					title: {
						text: ''
					},

					tooltip: {
						trigger: 'axis',
						axisPointer: {
							type: 'shadow'
						}
					},
					grid: {
						containLabel: true,
						left: 0
					},
					yAxis: {
						data: [
							// 'X50', 'X50-PRO', 'X60', 'X60-PRO'
						],
						inverse: true,
						axisLine: {
							show: false
						},
						axisTick: {
							show: false
						},
						axisLabel: {
							margin: 30,
							fontSize: 14
						},
						axisPointer: {
							label: {
								show: true,
								margin: 30
							}
						}
					},
					xAxis: {
						splitLine: {
							show: false
						},
						axisLabel: {
							show: false
						},
						axisTick: {
							show: false
						},
						axisLine: {
							show: false
						}
					},
					series: [{
							name: '',
							type: 'pictorialBar',
							label: labelSetting4,
							symbolRepeat: false,
							symbolSize: ['100%', '50%'],
							barCategoryGap: '40%',
							symbol: 'rgba(180, 180, 180, 1)',
							showBackground: true,
							backgroundStyle: {
								color: 'rgba(180, 180, 180, 0.5)'
							},
							data: []
						},
						{
							name: '',
							type: 'pictorialBar',
							label: labelSetting4,
							symbolRepeat: false,
							symbolSize: ['80%', '50%'],
							barCategoryGap: '40%',
							symbol: pathSymbols4.green,
							showBackground: true,
							backgroundStyle: {
								color: 'rgba(180, 180, 180, 0.5)'
							},
							data: [
								// 12, 24, 48, 49
							]
						}
					]
				};
				for (let i = 0; i < 4; i++) {
					if (i < this.keysForTypeModel.length) {
						option4.yAxis.data.push(this.keysForTypeModel[i])
						option4.series[0].data.push({
							value: 100,
							itemStyle: {
								color: '#FFFFFF',
								opacity: '0.1'
							}
						})
						option4.series[1].data.push(this.dataProduct.data.productionByTypeAndModel.T9527[this
							.keysForTypeModel[i]].rate)
					} else {
						option4.yAxis.data.push('')
						option4.series[0].data.push({
							value: 100,
							itemStyle: {
								color: '#FFFFFF',
								opacity: '0.1'
							}
						})
						option4.series[1].data.push(0)
					}
				}

				this.$echarts.init(document.getElementById('deviceChart4'), null, {
					devicePixelRatio: 2
				}).setOption(option4);
			},

			initStore4Today() {
				console.log("initStore4Today");
				// this.dataProduct.data.store4Today.in.rate = {"X60-PRO": "100.00", "X60-PRO2": "10.00"}
				this.keys = Object.keys(this.dataProduct.data.store4Today.in.rate);
				let option2 = {
					color: ['#FFA200', '#3AA4D4', '#38EE44', '#8D38EE'],
					series: [{
						name: 'Access From',
						type: 'pie',
						radius: ['50%', '70%'],
						avoidLabelOverlap: false,
						padAngle: 5,
						itemStyle: {
							borderRadius: 5,
						},
						label: {
							show: false,
							position: 'center'
						},
						emphasis: {
							label: {
								show: false,
								fontSize: 40,
								fontWeight: 'bold'
							}
						},
						labelLine: {
							show: false
						},
						data: []
					}]
				};
				for (let i = 0; i < this.keys.length; i++) {
					option2.series[0].data.push({
						value: this.dataProduct.data.store4Today.in.rate[this.keys[i]],
						name: this.keys[i]
					})
				}
				console.log("option2==", option2)
				this.$echarts.init(document.getElementById('deviceChart2'), null, {
					devicePixelRatio: 1
				}).setOption(option2);
			},


			initProductionByMonth() {

				const pathSymbols = {
					green: 'image://data:image/png;base64,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',
					blue: 'image://data:image/png;base64,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'
				};
				const labelSetting = {
					show: false,
					position: 'right',
					offset: [10, 0],
					fontSize: 16
				};
				let option3 = {
					tooltip: {
						trigger: 'axis',
						axisPointer: {
							type: 'shadow'
						}
					},
					grid: {
						containLabel: true,
						left: 0
					},
					xAxis: {
						data: [
							'1月',
							'2月',
							'3月',
							'4月',
							'5月',
							'6月',
							'7月',
							'8月',
							'9月',
							'10月',
							'11月',
							'12月'
						],
						inverse: false,
						axisLine: {
							show: false,
						},
						axisTick: {
							show: false
						},
						axisLabel: {
							margin: 30,
							fontSize: 14
						},
						axisPointer: {
							label: {
								show: true,
								margin: 30
							}
						},
						axisLabel: {
							show: true
						},
						axisLine: {
							show: true
						}
					},
					yAxis: {
						name: '件       ',
						fontSize: 12,
						splitLine: {
							show: true,
							lineStyle: {
								// 修改为需要的颜色
								color: '#707070'
							}
						},
						axisLabel: {
							show: true
						}
					},
					series: [{
							name: '计划产量',
							type: 'pictorialBar',
							label: labelSetting,
							symbolRepeat: false,
							symbolSize: ['100%', '100%'],
							barCategoryGap: '50%',
							symbol: pathSymbols.blue,
							data: [
								this.dataProduct.data.productionByMonth['01'].planned,
								this.dataProduct.data.productionByMonth['02'].planned,
								this.dataProduct.data.productionByMonth['03'].planned,
								this.dataProduct.data.productionByMonth['04'].planned,
								this.dataProduct.data.productionByMonth['05'].planned,
								this.dataProduct.data.productionByMonth['06'].planned,
								this.dataProduct.data.productionByMonth['07'].planned,
								this.dataProduct.data.productionByMonth['08'].planned,
								this.dataProduct.data.productionByMonth['09'].planned,
								this.dataProduct.data.productionByMonth['10'].planned,
								this.dataProduct.data.productionByMonth['11'].planned,
								this.dataProduct.data.productionByMonth['12'].planned
							]
						},
						{
							name: '实际产量',
							type: 'pictorialBar',
							barGap: '0%',
							label: labelSetting,
							symbolRepeat: false,
							symbolSize: ['100%', '100%'],
							symbol: pathSymbols.green,
							data: [this.dataProduct.data.productionByMonth['01'].actual,
								this.dataProduct.data.productionByMonth['02'].actual,
								this.dataProduct.data.productionByMonth['03'].actual,
								this.dataProduct.data.productionByMonth['04'].actual,
								this.dataProduct.data.productionByMonth['05'].actual,
								this.dataProduct.data.productionByMonth['06'].actual,
								this.dataProduct.data.productionByMonth['07'].actual,
								this.dataProduct.data.productionByMonth['08'].actual,
								this.dataProduct.data.productionByMonth['09'].actual,
								this.dataProduct.data.productionByMonth['10'].actual,
								this.dataProduct.data.productionByMonth['11'].actual,
								this.dataProduct.data.productionByMonth['12'].actual
							]
						}
					]
				};
				this.$echarts.init(document.getElementById('deviceChart3'), null, {
					devicePixelRatio: 2
				}).setOption(option3);


			},
			checkPercentF(num) {
				if (num == 0) {
					num = '00'
				} else if (num < 10) {
					num = num + '0'
				}
				return num;
			},

			// 配置
			SetClick() {
				console.log('SetClick')
				this.$router.push({
					path: '/setting',
				});
			},

			getSwitchesColor(i) {
				if (i == 0) {
					return '#E67E15';
				}
				return '#38D9EE';
			},

			getColor(i) {
				if (i == '紧急') {
					return '#FF4E00'
				}
				return '#2777BB';
			},

		},

		mounted() {
			this.initWebSocket();
			var that = this;
			window.onresize = () => {
				return (() => {
					window.fullHeight = document.documentElement.clientHeight;
					window.fullWidth = document.documentElement.clientWidth;
					that.windowHeight = window.fullHeight; //获取屏幕高度
					that.windowWidth = window.fullWidth; //获取屏幕宽度
					// that.$refs.grid.$forceUpdate();
					that.rowHeight = window.fullWidth
				})()
			};
			const gaugeData = [{
				value: 85,
				detail: {
					show: false,
					valueAnimation: true,
					offsetCenter: ['0%', '-20%']
				}
			}]
			let deviceOption = {
				series: [{
					type: 'gauge',
					startAngle: 90,
					endAngle: -270,
					pointer: {
						show: false
					},
					progress: {
						show: true,
						overlap: false,
						roundCap: true,
						clip: false,
						itemStyle: {
							color: '#38D9EE',
							borderWidth: 1,
							borderColor: '#38D9EE'
						}
					},
					axisLine: {
						show: false,
						lineStyle: {
							width: 10
						}
					},
					splitLine: {
						show: false,
						distance: 0,
						length: 10
					},
					axisTick: {
						show: false
					},
					axisLabel: {
						show: false,
						distance: 50
					},
					data: gaugeData
				}]
			}

			this.$echarts.init(document.getElementById('deviceChart'), null, {
				devicePixelRatio: 1
			}).setOption(deviceOption);


		},

		watch: {
			windowHeight(val) {
				let that = this;
				console.log("实时屏幕高度：", val, that.windowHeight);
			},
			windowWidth(val) {
				let that = this;
				console.log("实时屏幕宽度：", val, that.windowHeight);
			}
		},
		destroyed() {
			// close
			this.$websocket.close();
		},
		data() {
			return {
				tableData: [],
				cityValue: '',
				dataVisitor: {
					data: {
						today: {
							visitor: 0,
							employee: 0
						},
						last3Hours: 0,
						thisYear: {
							visitor: 0,
							employee: 0
						}
					},
					groupId: 1,
					type: "visitor"
				},
				dataEquipment: {
					"data": {
						"failureMap": {
							"MG400": []
						},
						"switches": [0, 0, 0, 0],
						"machineInfo": {
							"efficiency": "0%",
							"runTime": "00:00:00",
							"waitTime": "00:00:00",
							"operator": "",
							"qualityRate": "0%"
						}
					},
					"groupId": 1,
					"type": "equipment"
				},
				keys: [],
				keysForTypeModel: [],
				dataProduct: {
					"data": {
						"store4Today": { //今日出入库
							"in": { //入库
								"total": 0, //总数
								"rate": {
									// "X60-PRO": "0.00", //各型号占比
									// "X50-PRO": "0.00", //各型号占比
									// "X50": "0.00", //各型号占比
									// "X60": "0.00" //各型号占比
								}
							},
							"out": {
								"total": 0,
								"rate": {
									"X50": "100.00",
									"X60-PRO": "50.00"
								}
							}
						},
						"productionByTypeAndModel": { // 产品产量统计
							"T9527": { //产品类型
								// "X50": { //产品型号
								// 	"actual": 557, //实际产量
								// 	"rate": 19, //完成率
								// 	"planned": 2821 //计划产量
								// }
							}
						},
						"productionByMonth": { // 年度产量总览
							// "08": { // 8月
							// 	"actual": 0, //实际产量
							// 	"planned": 500 //计划产量
							// },
							// "07": {
							// 	"actual": 0,
							// 	"planned": 250
							// },
							// "06": {
							// 	"actual": 0,
							// 	"planned": 200
							// },
							// "05": {
							// 	"actual": 0,
							// 	"planned": 150
							// },
							// "04": {
							// 	"actual": 0,
							// 	"planned": 321
							// },
							// "03": {
							// 	"actual": 169,
							// 	"planned": 190
							// },
							// "12": {
							// 	"actual": 0,
							// 	"planned": 200
							// },
							// "02": {
							// 	"actual": 199,
							// 	"planned": 210
							// },
							// "01": {
							// 	"actual": 189,
							// 	"planned": 200
							// },
							// "10": {
							// 	"actual": 0,
							// 	"planned": 200
							// },
							// "11": {
							// 	"actual": 0,
							// 	"planned": 200
							// },
							// "09": {
							// 	"actual": 0,
							// 	"planned": 200
							// }
						},
						"materialCompletionRate": { // 材料齐套率
							"m1": "0", //配件1 数量
							"m2": "0", //配件2 数量
							"rate": "0.0", // 齐套率
							"m3": "0",
							"m4": "0"
						},
						"qualityPassRate": { //之间通过率
							"countPass": 0, // 通过数量
							"rate": 0, //通过率
							"countTotal": 0 //受检量
						}
					},
					"groupId": 1,
					"type": "product" // // 数据类型：产量数据
				}
			}
		}
	}
</script>

<style lang="less" scoped>
	.root {
		position: relative;
		width: 100%;
		height: 100%;
	}

	.divroot {
		background-image: url(../assets/dataOverview/bg.png);
		// background-color: #05181d;
		background-size: 100% 100%;
		width: 100%;
		height: 100%;
		// margin-top: 0px;
	}
</style>