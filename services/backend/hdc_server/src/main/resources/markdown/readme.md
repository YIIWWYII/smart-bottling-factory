# 说明文档
- 说明：为方便说明HDC项目多端（PAD/PAD/适配器/WEB <=> 服务端）通讯，特拟定该文档。如有疑问，可通过以下方式进行沟通。
- 本文档在线地址
> 地址：http://localhost:8088/doc.html#/home
- 集控中心地址
> 地址：http://localhost:8080/hdc/web/#/home/PLCControl
- 数据大屏
> 地址：http://localhost:8081/#/dataOverview
>  
> 用户名/密码：archermind/archermind


## 1.整体架构
    说明：根据HDC2023项目整理、升级，去除数字孪生相关功能

    1 系统参与者分为三个部分：设备终端、MQTT服务、后台服务，设备终端又分为：PAD、PDA、适配器；
    2 同一分组中，只能同时存在一个适配器（类型为：adapter），并且适配器加入分组和退出分组只能在该页面调用接口；
    3 通讯方式有http和mq消息两种。http主要支持智能终端和web端的数据交互；MQTT主要支持适配器数据交互和设备端底层通讯使用，如：设备上/下线，心跳检查等。
    4 为支持多地多设备使用的情况，特加入分组控制，终端设备在使用前需加入相应的分组后再进行后续操作，所以在操作步骤上会新增“入组”操作，通讯时消息中需增加设备唯一标识信息
    5 接口中的 sn 参数代表终端设备的唯一标识
     

    实验步骤：
        1.新建分组。展示前先在后台管理页建组，设置组名、入组口令，根据实际使用地（组）分发入组口令，（入组口令功能目前未开始使用）
        2.创建设备。新设备上报 online 心跳后会自动创建设备信息并入库。也可以调用本页面“设备管理-设备创建”接口作为备用方案
        3.设备加入分组。 若设备已经在一个分组内，加入新分组后会自动从旧分组中剔除（原则：一台设备同时只存在于一个分组中）
            2.1 pad和pda在各自页面选择地区、分组（展会）后，点击加入展会。
            2.2 适配器因无法输入，可使用后台设置方式入组（调用“设备管理-设备加入分组”）
        4.数据大屏上其他演示数据的生成
          4.1 产量相关：调用 “产量管理模块-生产计划：批量创建”
          4.2 设备故障相关：调用“设备故障管理-批量创建产线设备故障”
          4.3 产品出入库相关：调用“产品出入库管理-生产测试数据”
        5.其他：
          5.1 集控中心展示的为 适配器上报的 灯 状态
          5.2 数据大屏 4 个机床 展示的为 适配器上报的 开关 状态（数字孪生也是这个）
          5.3 在以下场景，适配器会上报全量数据（灯+开关）
            5.3.1 适配器重启，主动上报全量数据
            5.3.2 服务端重启，会询问适配器，要求上报全量数据
            5.3.2 pad上（展示机床和灯的）应用开启并选择分组后，会询问适配器，要求上报全量数据
          
          



## 2.服务器信息
> 域名:
>> xx-xx.xx.com

> MQTT服务地址
>> mqtt://xx.xx.xx.xx:xx


## 3.接口信息
1 http接口见左侧

2 mqtt通讯

2.1 终端设备与服务器

- 终端监听到服务端消息后需根据sn判断是否为发给自己的消息，不是的直接抛弃即可

>所有终端 与 服务端
>> 询问设备状态: 服务端 --> 终端，终端收到消息后上报状态，所有终端均需处理
>> ```
>>topic  sync/online
>>message   {
>>               "syncId" : ""
>>           }
>> ```
>
>> 设备上报状态: 终端 --> 服务端
>> ```
>>topic  device/network/online
>>message   {
>>               "sn" : ""
>>           }
>> ```

> 适配器 与 服务端
>>1、同步PLC全量数据指令，服务端 --》终端。终端收到消息后上报plc全量状态，所有终端均需处理
>> ````
>>topic    order/adapter/sync
>>
>>message  {
>>             "syncId":"xxxxx"
>>         }
>>````
>
>>2、终端上报plc全量状态， 适配器 --》服务端。
>> ````
>>topic    order/service/sync
>>
>>message  {
>>             "sn":"", 
>>             "device":[0,1,1,0],//依次：机械手、机床、流水线、巡检车，0：关闭，1：开启
>>             "totalLamps":4,//灯的数量，目前有3、4、16两种
>>             "lamps":[0,1,1,1],//灯状态，数组元素数量同totalLamps，0：关灯状态，1：开灯状态
>>             "version":"0.00"
>>          }
>>````
>
>>3、控制PLC关灯，服务端 --》终端。判断sn为自己就处理，其他就抛弃。
>> ````
>>topic    order/adapter/action
>>
>>message  {
>>             "sn":"",    
>>             "index":0,//0、1、2、3、4、5...15，从0开始
>>             "action":"0"//0:关灯、1：开灯
>>         }
>>````
>
>>4、终端上报灯状态指令，适配器 --》服务端。
>> ````
>>topic    order/service/lamps
>>
>>message  {
>>             "sn":"",    
>>             "index":0,//0、1、2、3、4、5...15，从0开始
>>             "totalLamps":3,//灯的数量，目前有3、16两种
>>             "action":"0"//0:关灯、1：开灯
>>         }
>>````
>
>>5、终端上报开关指令， 适配器 --》服务端。
>> ````
>>topic    order/service/switch
>>
>>message  {
>>             "sn":"", 
>>             "index":0,//0、1、2、3，依次：机械手、机床、流水线、巡检车
>>             "action":1//0：关闭指令，1：开启指令
>>         }
>>````
>
>>6、终端请求本组设备指令， 终端 --》服务端。终端询问所在分组全部设备list
>> ````
>>topic    softbus/request/groupconn
>>
>>message  {
>>             "sn": "sn001"
>>         }
>>````
>>7、终端监听本组设备指令， 服务端 --》终端。服务端监听到消息6后自动发送此消息
>> ````
>>topic    softbus/groupconn/{sn001}
>>
>>message  {
>>             "list": ["sn001","sn002"]
>>         }
>>````

2.2 websocket 
> 地址：ws://xx.xx.com/hdc/api/dataScreen/{groupId}

>返回的数据格式
>> 访客数据 左上角区域
>>```json5
>> {
>>  "data": {
>>    "today": {  // 今日
>>      "visitor": 0, // 访客
>>      "employee": 0 // 员工
>>    },
>>    "last3Hours": 0, // 最近3小时人数
>>    "thisYear": { // 今年
>>      "visitor": 8, 
>>      "employee": 0 
>>    }
>>  },
>>  "groupId": 1,
>>  "type": "visitor" // 数据类型：访客数据
>>}
>>```
>> 设备数据
>>```json5
>>{
>>	"data": {
>>		"failureMap": { // 设备告警清单，右上角区域
>>			"MG400": [ // key为设备型号
>>				{
>>					"failureLevel": "普通", // 告警级别
>>					"failureName": "设备无信号", // 故障原因
>>					"failureRecoverTimeStr": "17:40:03", //恢复时间
>>					"failureTimeStr": "17:38:13", //故障时间
>>					"groupId": 1,
>>					"machineName": "机械臂",
>>                  "machineType": "MG400"
>>				},
>>				{
>>					"failureLevel": "普通",
>>					"failureName": "数据丢失",
>>					"failureRecoverTimeStr": "11:13:22",
>>					"failureTimeStr": "11:12:59",
>>					"groupId": 1,
>>					"machineName": "机械臂",
>>                  "machineType": "MG400"
>>				},
>>				{
>>					"failureLevel": "紧急",
>>					"failureName": "机械故障",
>>					"failureRecoverTimeStr": "10:10:23",
>>					"failureTimeStr": "09:38:11",
>>					"groupId": 1,
>>					"machineName": "机械臂",
>>                  "machineType": "MG400"
>>				},
>>				{
>>					"failureLevel": "普通",
>>					"failureName": "未到恢复时间",
>>					"failureRecoverTimeStr": "待处理",
>>					"failureTimeStr": "08:38:13",
>>					"groupId": 1,
>>					"machineName": "机械臂",
>>                  "machineType": "MG400"
>>				}
>>			]
>>		},
>>		"switches": [ //设备运行状态，中间上部区域
>>			0, // 1号机床运行状态（0是待机；1是运行，下同）
>>			0, // 2号机床
>>			0, // 3号机床
>>			0  // 4号机床
>>		],
>>		"machineInfo": { // 运行时长数据和其他数据 设备运行状态下方
>>			"efficiency": "78%", // 设备效率
>>			"runTime": "00:00:00", // 运行时长，格式HH:mm:ss
>>			"waitTime": "418:15:57", // 待机时长，格式HH:mm:ss
>>			"operator": "张小明", // 负责人
>>			"qualityRate": "89%" // 质量合格率
>>		}
>>	},
>>	"groupId": 1,
>>	"type": "equipment" // 数据类型：设备数据
>>}
>>```
>> 产品产量、出入库数据
>>```json5
>>{
>>	"data": {
>>		"store4Today": { //今日出入库
>>			"in": { //入库
>>				"total": 0, //总数
>>				"rate": {
>>					"X60-PRO": "100.00" //各型号占比
>>				}
>>			},
>>			"out": {
>>				"total": 0,
>>				"rate": {
>>					"X50": "100.00",
>>					"X60-PRO": "50.00"
>>				}
>>			}
>>		},
>>		"productionByTypeAndModel": { // 产品产量统计
>>			"T9527": { //产品类型
>>				"X50": { //产品型号
>>					"actual": 557, //实际产量
>>					"rate": 19, //完成率
>>					"planned": 2821 //计划产量
>>				}
>>			}
>>		},
>>		"productionByMonth": { // 年度产量总览
>>			"08": { // 8月
>>				"actual": 0, //实际产量
>>				"planned": 500 //计划产量
>>			},
>>			"07": {
>>				"actual": 0,
>>				"planned": 250
>>			},
>>			"06": {
>>				"actual": 0,
>>				"planned": 200
>>			},
>>			"05": {
>>				"actual": 0,
>>				"planned": 150
>>			},
>>			"04": {
>>				"actual": 0,
>>				"planned": 321
>>			},
>>			"03": {
>>				"actual": 169,
>>				"planned": 190
>>			},
>>			"12": {
>>				"actual": 0,
>>				"planned": 200
>>			},
>>			"02": {
>>				"actual": 199,
>>				"planned": 210
>>			},
>>			"01": {
>>				"actual": 189,
>>				"planned": 200
>>			},
>>			"10": {
>>				"actual": 0,
>>				"planned": 200
>>			},
>>			"11": {
>>				"actual": 0,
>>				"planned": 200
>>			},
>>			"09": {
>>				"actual": 0,
>>				"planned": 200
>>			}
>>		},
>>		"materialCompletionRate": { // 材料齐套率
>>			"m1": "1233", //配件1 数量
>>			"m2": "232", //配件2 数量
>>			"rate": "29.3", // 齐套率
>>			"m3": "320",
>>			"m4": "248"
>>		},
>>		"qualityPassRate": { //之间通过率
>>			"countPass": 0, // 通过数量
>>			"rate": 0, //通过率
>>			"countTotal": 5 //受检量
>>		}
>>	},
>>	"groupId": 1,
>>	"type": "product" // // 数据类型：产量数据
>>}
>>```
## 4.数据大屏
```text
一个展会的数据大屏只支持一个终端，多个web页打开同一个展会数据大屏时，只有最后一个打开的能接收数据
```
### 模拟数据
    说明：数据大屏需要内置一些模拟数据（基于手机产品的4种型号X50/X50-PRO/X60/X60-PRO），用于展示。共涉及3项
- 4.1 产品产量
    - 接口： 产量管理模块-生产计划：批量创建
    - 模板数据：需根据展会月份调整每个型号的数据，也可增加完成后使用接口进行修改：产量管理模块-修改生产计划
  ```json
  [
      {
          "groupId": 1,
          "productType": "T9527",
          "productModel": "X50",
          "plannedProduction": 200,
          "actualProduction": 189,
          "date": "2024-01"
      },
      {
          "groupId": 1,
          "productType": "T9527",
          "productModel": "X50",
          "plannedProduction": 210,
          "actualProduction": 199,
          "date": "2024-02"
      },
      {
          "groupId": 1,
          "productType": "T9527",
          "productModel": "X50",
          "plannedProduction": 190,
          "actualProduction": 169,
          "date": "2024-03"
      },
      {
          "groupId": 1,
          "productType": "T9527",
          "productModel": "X50",
          "plannedProduction": 321,
          "actualProduction": 0,
          "date": "2024-04"
      },
      {
          "groupId": 1,
          "productType": "T9527",
          "productModel": "X50",
          "plannedProduction": 150,
          "actualProduction": 0,
          "date": "2024-05"
      },
      {
          "groupId": 1,
          "productType": "T9527",
          "productModel": "X50",
          "plannedProduction": 200,
          "actualProduction": 0,
          "date": "2024-06"
      },
      {
          "groupId": 1,
          "productType": "T9527",
          "productModel": "X50",
          "plannedProduction": 250,
          "actualProduction": 0,
          "date": "2024-07"
      },
      {
          "groupId": 1,
          "productType": "T9527",
          "productModel": "X50",
          "plannedProduction": 500,
          "actualProduction": 0,
          "date": "2024-08"
      },
      {
          "groupId": 1,
          "productType": "T9527",
          "productModel": "X50",
          "plannedProduction": 200,
          "actualProduction": 0,
          "date": "2024-09"
      },
      {
          "groupId": 1,
          "productType": "T9527",
          "productModel": "X50",
          "plannedProduction": 200,
          "actualProduction": 0,
          "date": "2024-10"
      },
      {
          "groupId": 1,
          "productType": "T9527",
          "productModel": "X50",
          "plannedProduction": 200,
          "actualProduction": 0,
          "date": "2024-11"
      },
      {
          "groupId": 1,
          "productType": "T9527",
          "productModel": "X50",
          "plannedProduction": 200,
          "actualProduction": 0,
          "date": "2024-12"
      },
      {
          "groupId": 1,
          "productType": "T9527",
          "productModel": "X50-PRO",
          "plannedProduction": 300,
          "actualProduction": 299,
          "date": "2024-01"
      },
      {
          "groupId": 1,
          "productType": "T9527",
          "productModel": "X50-PRO",
          "plannedProduction": 250,
          "actualProduction": 250,
          "date": "2024-02"
      },
      {
          "groupId": 1,
          "productType": "T9527",
          "productModel": "X50-PRO",
          "plannedProduction": 250,
          "actualProduction": 220,
          "date": "2024-03"
      },
      {
          "groupId": 1,
          "productType": "T9527",
          "productModel": "X50-PRO",
          "plannedProduction": 200,
          "actualProduction": 190,
          "date": "2024-04"
      },
      {
          "groupId": 1,
          "productType": "T9527",
          "productModel": "X50-PRO",
          "plannedProduction": 120,
          "actualProduction": 0,
          "date": "2024-05"
      },
      {
          "groupId": 1,
          "productType": "T9527",
          "productModel": "X50-PRO",
          "plannedProduction": 220,
          "actualProduction": 0,
          "date": "2024-06"
      },
      {
          "groupId": 1,
          "productType": "T9527",
          "productModel": "X50-PRO",
          "plannedProduction": 140,
          "actualProduction": 0,
          "date": "2024-07"
      },
      {
          "groupId": 1,
          "productType": "T9527",
          "productModel": "X50-PRO",
          "plannedProduction": 150,
          "actualProduction": 0,
          "date": "2024-08"
      },
      {
          "groupId": 1,
          "productType": "T9527",
          "productModel": "X50-PRO",
          "plannedProduction": 200,
          "actualProduction": 0,
          "date": "2024-09"
      },
      {
          "groupId": 1,
          "productType": "T9527",
          "productModel": "X50-PRO",
          "plannedProduction": 220,
          "actualProduction": 0,
          "date": "2024-10"
      },
      {
          "groupId": 1,
          "productType": "T9527",
          "productModel": "X50-PRO",
          "plannedProduction": 160,
          "actualProduction": 0,
          "date": "2024-11"
      },
      {
          "groupId": 1,
          "productType": "T9527",
          "productModel": "X50-PRO",
          "plannedProduction": 200,
          "actualProduction": 0,
          "date": "2024-12"
      },
      {
          "groupId": 1,
          "productType": "T9527",
          "productModel": "X60",
          "plannedProduction": 180,
          "actualProduction": 180,
          "date": "2024-01"
      },
      {
          "groupId": 1,
          "productType": "T9527",
          "productModel": "X60",
          "plannedProduction": 250,
          "actualProduction": 219,
          "date": "2024-02"
      },
      {
          "groupId": 1,
          "productType": "T9527",
          "productModel": "X60",
          "plannedProduction": 120,
          "actualProduction": 120,
          "date": "2024-03"
      },
      {
          "groupId": 1,
          "productType": "T9527",
          "productModel": "X60",
          "plannedProduction": 100,
          "actualProduction": 100,
          "date": "2024-04"
      },
      {
          "groupId": 1,
          "productType": "T9527",
          "productModel": "X60",
          "plannedProduction": 120,
          "actualProduction": 0,
          "date": "2024-05"
      },
      {
          "groupId": 1,
          "productType": "T9527",
          "productModel": "X60",
          "plannedProduction": 220,
          "actualProduction": 0,
          "date": "2024-06"
      },
      {
          "groupId": 1,
          "productType": "T9527",
          "productModel": "X60",
          "plannedProduction": 140,
          "actualProduction": 0,
          "date": "2024-07"
      },
      {
          "groupId": 1,
          "productType": "T9527",
          "productModel": "X60",
          "plannedProduction": 150,
          "actualProduction": 0,
          "date": "2024-08"
      },
      {
          "groupId": 1,
          "productType": "T9527",
          "productModel": "X60",
          "plannedProduction": 200,
          "actualProduction": 0,
          "date": "2024-09"
      },
      {
          "groupId": 1,
          "productType": "T9527",
          "productModel": "X60",
          "plannedProduction": 220,
          "actualProduction": 0,
          "date": "2024-10"
      },
      {
          "groupId": 1,
          "productType": "T9527",
          "productModel": "X60",
          "plannedProduction": 160,
          "actualProduction": 0,
          "date": "2024-11"
      },
      {
          "groupId": 1,
          "productType": "T9527",
          "productModel": "X60",
          "plannedProduction": 200,
          "actualProduction": 0,
          "date": "2024-12"
      },
      {
          "groupId": 1,
          "productType": "T9527",
          "productModel": "X60-PRO",
          "plannedProduction": 100,
          "actualProduction": 89,
          "date": "2024-01"
      },
      {
          "groupId": 1,
          "productType": "T9527",
          "productModel": "X60-PRO",
          "plannedProduction": 150,
          "actualProduction": 119,
          "date": "2024-02"
      },
      {
          "groupId": 1,
          "productType": "T9527",
          "productModel": "X60-PRO",
          "plannedProduction": 120,
          "actualProduction": 120,
          "date": "2024-03"
      },
      {
          "groupId": 1,
          "productType": "T9527",
          "productModel": "X60-PRO",
          "plannedProduction": 100,
          "actualProduction": 10,
          "date": "2024-04"
      },
      {
          "groupId": 1,
          "productType": "T9527",
          "productModel": "X60-PRO",
          "plannedProduction": 120,
          "actualProduction": 0,
          "date": "2024-05"
      },
      {
          "groupId": 1,
          "productType": "T9527",
          "productModel": "X60-PRO",
          "plannedProduction": 220,
          "actualProduction": 0,
          "date": "2024-06"
      },
      {
          "groupId": 1,
          "productType": "T9527",
          "productModel": "X60-PRO",
          "plannedProduction": 140,
          "actualProduction": 0,
          "date": "2024-07"
      },
      {
          "groupId": 1,
          "productType": "T9527",
          "productModel": "X60-PRO",
          "plannedProduction": 150,
          "actualProduction": 0,
          "date": "2024-08"
      },
      {
          "groupId": 1,
          "productType": "T9527",
          "productModel": "X60-PRO",
          "plannedProduction": 200,
          "actualProduction": 0,
          "date": "2024-09"
      },
      {
          "groupId": 1,
          "productType": "T9527",
          "productModel": "X60-PRO",
          "plannedProduction": 220,
          "actualProduction": 0,
          "date": "2024-10"
      },
      {
          "groupId": 1,
          "productType": "T9527",
          "productModel": "X60-PRO",
          "plannedProduction": 160,
          "actualProduction": 0,
          "date": "2024-11"
      },
      {
          "groupId": 1,
          "productType": "T9527",
          "productModel": "X60-PRO",
          "plannedProduction": 200,
          "actualProduction": 0,
          "date": "2024-12"
      }
  ]
  ```

  - 4.2 设备故障
    - 接口：设备故障模块-批量创建产线设备故障
    - 模板数据：注意恢复时间要在发送时间之后
    ```json5
    [
      {
          "failureLevel": "普通", // 故障等级
          "failureName": "设备无信号", //故障名称
          "failureRecoverTimeStr": "17:40:03", // 恢复时间
          "failureTimeStr": "17:38:13", //发生时间
          "groupId": 1, //所属展会
          "machineName": "机械臂" //设备名称
      },
      {
          "failureLevel": "紧急",
          "failureName": "机械故障",
          "failureRecoverTimeStr": "10:10:23",
          "failureTimeStr": "09:38:11",
          "groupId": 1,
          "machineName": "机械臂"
      },
      {
          "failureLevel": "普通",
          "failureName": "数据丢失",
          "failureRecoverTimeStr": "11:13:22",
          "failureTimeStr": "11:12:59",
          "groupId": 1,
          "machineName": "机械臂"
      },
      {
          "failureLevel": "普通",
          "failureName": "未到发生事件",
          "failureRecoverTimeStr": "20:40:03",
          "failureTimeStr": "20:17:12",
          "groupId": 1,
          "machineName": "机械臂"
      },
      {
          "failureLevel": "普通",
          "failureName": "未到恢复时间",
          "failureRecoverTimeStr": "23:40:03",
          "failureTimeStr": "08:38:13",
          "groupId": 1,
          "machineName": "机械臂"
      }
    ]
    ```
- 4.3 今日出入库
  - 接口：产品出入库管理-生成测试数据

- 4.4 产线设备运行时长和待机时长
  ```text
  说明：两个时间的计算基于展会分组的machineBaseTime属性，所以在创建分组的时候需要设置此属性，若未设置，默认使用展会开始时间
  ```

