-- MG400 单次取放轨迹模板：在 Dobot Studio Pro 的 Lua 脚本工程中使用。
-- 本文件不是通过电脑直接发送的 TCP 指令，也不会自动连接或使能机械臂。
-- 先保持 PREVIEW_ONLY=true 查看流程。示教及校验完成前禁止切换为 false。
-- Studio/控制器版本尚未现场核实，请先在 Studio 中编译检查 API 支持情况。

local PREVIEW_ONLY = true       -- true：只打印步骤，不运动、不改变输出
local SITE_CHECKED = false      -- 确认坐标系、工具、负载、全段路径及急停后才设为 true
local START_AT_P1 = false       -- 实机已经通过人工低速操作停在 P1 后才设为 true
local SPEED_PERCENT = 10        -- 速度比例，不是 mm/s；10% 不保证现场安全

-- 在 Studio 的示教点列表保存下列笛卡尔点，使用一致的用户坐标系、工具坐标系。
-- P1：空载起止点；P2：取瓶点正上方；P3：吸具接触瓶子的取瓶点；
-- P4：经现场核对的中间通行点；P5：放瓶点正上方；P6：瓶子被台面支撑的放瓶点。
-- P2/P3、P5/P6 的 X、Y、R 应分别一致，仅高度不同，以便竖直进退。
-- 每一段直线及整条机械臂扫过的空间都需检查；一个中间点未必足够避障。
-- 不填写演示坐标，防止误把示例值当成现场可运行位置。
local points = {start=P1, pickAbove=P2, pick=P3, transit=P4, placeAbove=P5, place=P6}

-- 仅适用于“单个数字输出控制真空开关”的吸具。
-- 气泵、阀、吸盘接法未知，不能猜 DO 编号或电平。
-- 双阀、带破真空输出或总线吸具，需要先改写下方 setVacuum，不能直接使用。
local VACUUM_DO = nil           -- 查电气接线后填实际数字输出编号
local VACUUM_ON = nil           -- 查接线和 Studio API 后填吸取电平：ON 或 OFF
local VACUUM_OFF = nil          -- 填释放电平：OFF 或 ON
local IO_CHECKED = false        -- 已单独核对输出与实际气路响应
local PICK_WAIT_MS = 500        -- 建立真空等待；不是吸住检测
local RELEASE_WAIT_MS = 500     -- 释放等待；不是已放好检测

-- 所有配置检查都在第一次运动之前完成。
if not PREVIEW_ONLY then
    assert(SITE_CHECKED, "请先核对现场路径、坐标系、工具及负载")
    assert(START_AT_P1, "请人工低速移至 P1，并确认空载；本脚本不从未知位置自动回位")
    for name, point in pairs({
        start={points.start}, pickAbove={points.pickAbove}, pick={points.pick},
        transit={points.transit}, placeAbove={points.placeAbove}, place={points.place}
    }) do
        assert(point[1] ~= nil, "缺少示教点: " .. name)
    end
    assert(IO_CHECKED and type(VACUUM_DO) == "number" and VACUUM_DO >= 1
        and VACUUM_DO % 1 == 0, "请确认吸具类型并配置实际 DO 编号")
    assert(VACUUM_ON ~= nil and VACUUM_OFF ~= nil and VACUUM_ON ~= VACUUM_OFF,
        "请配置并验证吸取/释放电平")
    assert(SPEED_PERCENT >= 1 and SPEED_PERCENT <= 10, "首次调试速度比例限制为 1～10%")
    assert(type(MovL)=="function" and type(Sync)=="function" and type(DO)=="function"
        and type(Wait)=="function" and type(SpeedL)=="function"
        and type(AccL)=="function" and type(CP)=="function", "当前 Studio API 与模板不匹配")
    SpeedL(SPEED_PERCENT)
    AccL(10)
    CP(0)                      -- 关闭轨迹过渡，不切角掠过取放点
end

local function moveTo(point, description)
    print(description)
    if PREVIEW_ONLY then return end
    MovL(point)                -- 末端沿直线到达示教点；不代表整条机械臂已自动避障
    Sync()                     -- 等待队列运动完成，再执行后续步骤
end

local function setVacuum(enabled)
    print(enabled and "打开真空，等待吸取（尚无吸住检测）" or "关闭真空，等待释放（尚无放好检测）")
    if PREVIEW_ONLY then return end
    DO(VACUUM_DO, enabled and VACUUM_ON or VACUUM_OFF)
    Wait(enabled and PICK_WAIT_MS or RELEASE_WAIT_MS)
    Sync()
    -- 若装有真空压力开关，应在提起前增加 DI 检查和超时停止。
    -- 当前未知传感器与阀接线，不能声称这里已确认抓取成功。
end

print(PREVIEW_ONLY and "流程预览：不运动、不操作气路" or "开始单次取放；起点必须为 P1")
-- 起点由人工定位，不从任意位置自动运动到 P1。
setVacuum(false)               -- 仅在已确认空载起始时使用
moveTo(points.pickAbove, "1. 从 P1 移至取瓶上方 P2")
moveTo(points.pick, "2. 竖直下降至取瓶点 P3")
setVacuum(true)
moveTo(points.pickAbove, "3. 抬起回到 P2")
moveTo(points.transit, "4. 经过已核对的中间点 P4")
moveTo(points.placeAbove, "5. 移至放瓶上方 P5")
moveTo(points.place, "6. 竖直下降至放瓶点 P6，瓶子应受到台面支撑")
setVacuum(false)
moveTo(points.placeAbove, "7. 空载抬起回到 P5")
moveTo(points.transit, "8. 经 P4 退回")
moveTo(points.start, "9. 回到起止点 P1")
print(PREVIEW_ONLY and "预览结束" or "单次轨迹结束，请检查实物取放结果")
-- 只做一次，不自动循环、不自动恢复报警、不自动下使能。
-- 异常中止时不自动关闭真空，避免悬空工件掉落；由现场人员按实际情况处理。
