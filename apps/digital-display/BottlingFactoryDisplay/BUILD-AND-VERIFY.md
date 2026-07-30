# 鏁板瓧灞曟澘鏋勫缓涓庨獙璇?
## 鐜

鎵€鏈夊伐鍏枫€丼DK銆佹ā鎷熷櫒銆佺紦瀛樸€佹瀯寤轰骇鐗╁拰鏃ュ織鍧囨斁鍦?`D:\HarmonyOS-Dev`銆傚伐绋嬫簮鐮佷綅浜庯細

```text
D:\HarmonyOS-Dev\Workspaces\bottling-display\apps\digital-display\BottlingFactoryDisplay
```

搴旂敤閫氳繃 `entry/oh-package.json5` 渚濊禆鏈湴 `../../../../packages/harmony-assistant/harmonyassistant`锛孫HPM 鍖呭悕蹇呴』涓?`@bottling/harmony-assistant`锛岀増鏈繀椤讳负 `1.0.1`銆?
## 鏋勫缓

```powershell
& 'D:\HarmonyOS-Dev\npm-global\devecocli.cmd' --version
& 'D:\HarmonyOS-Dev\npm-global\devecocli.cmd' build --modules entry --build-mode debug
```

鏋勫缓鍓嶈繍琛屽伐绋嬮潤鎬佹鏌ワ細

```powershell
& '.\tools\validate-project.ps1'
```

鎴愬姛鏍囧噯鏄?CLI 杈撳嚭 `BUILD SUCCESSFUL`锛屼笖 `entry\build\default\outputs\default\` 涓嬬敓鎴?`.hap`锛屼笉鑳藉彧鍑?ArkTS 绫诲瀷妫€鏌ュ垽鏂畬鎴愩€?
## 鏈嶅姟鍦板潃

`entry/src/main/ets/service/ApiConfig.ets` 閰嶇疆 Spring Boot 涓?AI 涓灑鍦板潃銆傛ā鎷熷櫒鎴栫湡鏈轰笉鑳戒娇鐢?`localhost`锛涚數鑴戦槻鐏蹇呴』鍏佽瀵瑰簲绔彛鍏ョ珯銆傚悗绔笉鍙敤鏃堕〉闈㈠簲鏄剧ず鏄庣‘閿欒鍜?`LOCAL DEMO`锛孉I 涓灑涓嶅彲鐢ㄦ椂鍏变韩鍔╂墜搴旀樉绀烘湇鍔′笉鍙敤锛屼絾涓嶈兘闃诲灞曟澘椤甸潰銆?
## 鏈€浣庨獙鏀?
| 妫€鏌ラ」 | 棰勬湡缁撴灉 |
| --- | --- |
| 鍚姩 | 鏃犻渶鐧诲綍锛岀洿鎺ヨ繘鍏ュ叏灞€鎬昏 |
| 宸ュ簭瀵艰埅 | 涔濆伐搴忓潎鍙粠鎬昏杩涘叆璇︽儏锛岄〉闈㈠彲涓婁笅婊氬姩 |
| 2D | 鍔犺浇 `factory2d/index.html`锛屾樉绀哄钩闈㈣澶囩鍙枫€佸伐鑹鸿矾寰勫拰绉诲姩鐗╂枡锛屼笉鏄?3D 淇瑙?|
| 3D | 鍔犺浇 `factory3d/index.html`锛屼節宸ュ簭璁惧缁勫悎鍜屽姩浣滀笉鍚?|
| 鍚屽揩鐓ц仈鍔?| 涓よ鍥剧殑 `stateVersion`銆佽澶?浜у搧銆侀€熷害銆佽繘搴︺€佹潵婧愪竴鑷?|
| 鏆傚仠/鎭㈠ | 鏆傚仠鍐荤粨褰撳墠甯э紱鎭㈠鍚庡簲鐢ㄦ渶鏂板揩鐓у苟缁х画杩愬姩 |
| 鎬ц兘寮€鍏?| 2D/3D 鍙嫭绔嬪叧闂紱鍏抽棴鍚庡彇娑堝姩鐢诲抚骞堕噴鏀?WebGL |
| 鐘舵€侀鑹?| 鍙叧闂鑹叉槧灏勶紝璁惧鐘舵€佹枃瀛椾粛鏄剧ず |
| 甯冨眬缂栬緫 | 璁惧鍙嫋鎷斤紱鎸夊伐搴忓拰瑙嗗浘淇濆瓨锛岄噸寮€鍚庢仮澶?|
| 閫夋嫨鑱斿姩 | 宸ヤ綅銆佽澶囥€佷骇鍝佷娇鐢ㄧǔ瀹氫笟鍔?ID 鍙戝竷鍏变韩鍔╂墜閫夋嫨锛涚┖鐧界偣鍑诲彂閫?`CLEAR` |
| 鏈嶅姟寮傚父 | 鍚庣/AI 涓嶅彲鐢ㄦ彁绀烘竻妤氾紝椤甸潰涓嶅穿婧冦€佷笉鏄剧ず鍋囨垚鍔?|

Three.js 鍙厛鍦ㄦ祻瑙堝櫒瀵?rawfile 椤甸潰鍋?canvas銆佺偣鍑汇€佹嫋鎷藉拰鎺㈤拡鍥炲綊锛屼絾鏈€缁堝繀椤诲湪 HarmonyOS 妯℃嫙鍣ㄤ腑纭 ArkWeb銆佹湰鍦拌祫婧愩€佹ˉ鎺ュ拰椤甸潰鍒囨崲銆?
