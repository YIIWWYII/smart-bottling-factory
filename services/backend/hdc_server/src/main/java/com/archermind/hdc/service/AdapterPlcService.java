package com.archermind.hdc.service;

import com.alibaba.fastjson.JSONObject;
import com.archermind.hdc.api.result.Result;
import com.archermind.hdc.dto.*;
import com.archermind.hdc.entity.Device;
import com.archermind.hdc.entity.GroupDevice;
import com.archermind.hdc.entity.ProductWebHelperDao;
import com.archermind.hdc.log.XLog;
import com.archermind.hdc.mapper.*;
import com.archermind.hdc.scheduled.Config;
import com.archermind.hdc.service.ws.CommonWebSocketService;
import com.archermind.hdc.util.DateUtil;
import com.archermind.hdc.util.GsonUtil;
import com.archermind.hdc.util.UUID;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import org.eclipse.paho.client.mqttv3.MqttException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.ObjectUtils;

import javax.annotation.PostConstruct;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

import static com.archermind.hdc.dto.MqttHelper.*;

@Service
public class AdapterPlcService implements MqttHelper.RegisterMessage {
    @Autowired
    MqttClientService mqttClientService;
    @Autowired
    DeviceMapper deviceMapper;
    @Autowired
    ProductMapper productMapper;
    @Autowired
    ProductStoreMapper productStoreMapper;

    @Autowired
    private GroupDeviceMapper groupDeviceMapper;
    @Autowired
    private GroupService groupService;

    @Autowired
    private DeviceService deviceService;


    /**
     * 依次：机械手、机床、流水线、巡检车
     */
//    private List<Integer> switches = Arrays.asList(0, 0, 0, 0);
//    private List<Integer> lamps = Arrays.asList(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);


    // 分组的plc状态，groupId为key，同组内各类设备只能有一台
    // plc调试台灯
    private Map<String,List<Integer>> lampsMapByGroup = new HashMap<>();
    // plc调试台开关：4个
    private Map<String, List<Integer>> switchesByGroup = new HashMap<>();
    private Map<String, PlcInfo> infoMapByGroup = new HashMap<>();

    public Map<String, List<Integer>> getLampsMapByGroup() {
        return lampsMapByGroup;
    }

    public Map<String, List<Integer>> getSwitchesByGroup() {
        return switchesByGroup;
    }

    public Map<String, PlcInfo> getInfoMapByGroup() {
        return infoMapByGroup;
    }

    // 基于组、适配器sn的两级map，可实现多分组、分组内多适配器(同类设备多台)
//    private Map<Long, Map<String,List<Integer>>> lamMapByGroup = new HashMap<>();
//    private Map<Long, Map<String,Integer>> switchesByGroup = new HashMap<>();

    @PostConstruct
    public void init() {
        mqttClientService.setRegisterMessage(this);
    }


    @Override
    public void deviceNetworkOnline(MqttHelper.DeviceNetworkOnlineDto dto) throws MqttException {
        if (ObjectUtils.isEmpty(dto)) {
            XLog.warn("解析数据为空");
            return;
        }
        String sn = dto.getSn();
        if (ObjectUtils.isEmpty(sn)) {
            return;
        }
        Device device = deviceMapper.findDeviceBySn(sn);
        if (ObjectUtils.isEmpty(device)) {
            XLog.warn("SN：" + sn + "，数据库中不存在,新建设备。");
            device = new Device();
            device.setSn(sn);
            device.setState(1);
            device.setLastOnlineTime(LocalDateTime.now());
            deviceMapper.insert(device);
        } else {
            deviceMapper.changeDevice(null, new Date(), 1, sn);
        }
        // 给数字孪生发发送上线消息
        GroupDevice groupDevice = groupDeviceMapper.selectWithDetails(sn);
        if (groupDevice !=null){
            simulationDeviceState(groupDevice.getGroupId(),groupDevice.getDeviceInfo().getType(), 1);
        }
    }

    @Override
    public void connectComplete() {
        new Thread() {
            @Override
            public void run() {
                super.run();
                try {
                    sleep(1000);
                    orderAdapterSync();
                } catch (MqttException | InterruptedException mqttException) {
                    XLog.error(mqttException);
                }
            }
        }.start();
    }

    @Override
    public void listGroupDevces(MqttHelper.DeviceInfoDto dto) throws MqttException {
        String sn = dto.getSn();
        //给当前设备返回所在分组的全部设备list，方便其自组网
        sendSnlistInGroup(sn);
    }

    //接收全量数据
    @Override
    public void orderServiceSync(MqttHelper.OrderServiceSyncDto dto) {
        if (ObjectUtils.isEmpty(dto)) {
            XLog.warn("解析数据为空");
            return;
        }
        // 自动添加设备type
        String sn = dto.getSn();
        GroupDevice groupDevice = getGroupBySn(sn);
        if (ObjectUtils.isEmpty(groupDevice)) {
            XLog.warn("适配器未分配到组中，SN：" + sn);
            return ;
        }
        Long groupId = groupDevice.getGroupId();
        //接收适配器的同步状态
        List<Integer> device = dto.getDevice();
        if (device != null && device.size() == 4) {
            switchesByGroup.put(String.valueOf(groupId), device);
        } else {
            XLog.warn("开关信息同步失败");
        }
        List<Integer> lamps = dto.getLamps();
        if (lamps != null && !lamps.isEmpty()) {
            XLog.info("上报全量数据时初始化灯数组。groupId=" +groupId + ",sn=" + sn + ",lamps=" + lamps);
            lampsMapByGroup.put(String.valueOf(groupId), lamps);
            pushLamps2Web(groupId);
        } else {
            XLog.warn("灯泡信息同步失败");
        }
        String version = dto.getVersion();
        if (!ObjectUtils.isEmpty(version)) {
            XLog.info("收到设备信息。sn:"+sn+",version:"+version);
            PlcInfo plcInfo = infoMapByGroup.get(String.valueOf(groupId));
            if (plcInfo == null) {
                plcInfo = new PlcInfo();
                infoMapByGroup.put(String.valueOf(groupId),plcInfo);
            }
            plcInfo.setVersion(version);
            pushInfo2Web(groupId);
        }
        //同步给数字孪生
        simulationSyncData(groupId);
    }

    @Override
    public void orderServiceSwitch(MqttHelper.OrderServiceSwitchDto dto) throws MqttException {
        //接收适配器的开关命令
        if (ObjectUtils.isEmpty(dto)) {
            XLog.warn("解析数据为空");
            return;
        }
        String sn = dto.getSn();
        Integer index = dto.getIndex();
        Integer action = dto.getAction();
        Boolean validated = validateData("switch", sn, index, action);
        if (!validated) {
            return;
        }
        GroupDevice groupDevice = getGroupBySn(sn);
        if (ObjectUtils.isEmpty(groupDevice)) {
            XLog.warn("适配器未分配到组中，SN：" + sn);
            return ;
        }
        Long groupId = groupDevice.getGroupId();
        List<Integer> switches = switchesByGroup.computeIfAbsent(String.valueOf(groupId), k -> Arrays.asList(0, 0, 0, 0));
        switches.set(index, action);
        simulationSwitchState(groupId,index, action);
    }

    @Override
    public void orderServiceLamps(OrderServiceLampsDto dto) throws MqttException {
        if (ObjectUtils.isEmpty(dto)) {
            XLog.warn("解析数据为空");
            return;
        }
        String sn = dto.getSn();
        Integer index = dto.getIndex();
        Integer action = dto.getAction();
        Boolean validated = validateData("lamps", sn, index, action);
        if (!validated) {
            return;
        }
        Integer totalLamps = dto.getTotalLamps();
        if (totalLamps == null) {
            XLog.error("sn:"+sn+",缺少参数totalLamps");
            return;
        }
        if (totalLamps <= index){
            XLog.error("sn:"+sn+",灯的index越界了");
            return;
        }
        GroupDevice groupDevice = getGroupBySn(sn);
        if (ObjectUtils.isEmpty(groupDevice)) {
            XLog.warn("适配器未分配到组中，SN：" + sn);
            return ;
        }


        Long groupId = groupDevice.getGroupId();
        List<Integer> lamps = lampsMapByGroup.get(String.valueOf(groupId));
        if (lamps == null || lamps.size() != totalLamps) {
            lamps = new ArrayList<>();
            for (int i = 0; i < totalLamps; i++) {
                lamps.add(0);
            }
            XLog.info("控制柜推送灯数据时初始化灯数组。groupId=" +groupId + ",sn=" + sn);
            lampsMapByGroup.put(String.valueOf(groupId), lamps);
        }
        lamps.set(index, action);
        pushLamps2Web(groupId);
    }

    public void pushLamps2Web(Long groupId){
        List<Integer> lamps = lampsMapByGroup.get(String.valueOf(groupId));
        if (lamps != null ){
            WsPlcResponseDto<List<Integer>> responseDto = new WsPlcResponseDto<>();
            responseDto.setCode(WsPlcResponseDto.Code.SUCCESS.code);
            responseDto.setType(WsPlcResponseDto.Type.LAMP.name().toLowerCase());
            responseDto.setData(lamps);
            String message = JSONObject.toJSONString(responseDto);
            CommonWebSocketService.sentMessageByGroupId(groupId, message);
        }
    }

    public void pushInfo2Web(Long groupId){
        MqttHelper.PlcInfo plcInfo = infoMapByGroup.get(String.valueOf(groupId));
        if (plcInfo != null){
            WsPlcResponseDto<MqttHelper.PlcInfo> responseDto = new WsPlcResponseDto<>();
            responseDto.setCode(WsPlcResponseDto.Code.SUCCESS.code);
            responseDto.setType(WsPlcResponseDto.Type.INFO.name().toLowerCase());
            responseDto.setData(plcInfo);
            String message = JSONObject.toJSONString(responseDto);
            CommonWebSocketService.sentMessageByGroupId(groupId, message);
        }
    }

    private Boolean validateData(String type, String sn, Integer index, Integer action) {
        if (ObjectUtils.isEmpty(index)) {
            XLog.warn("sn:"+sn+"##"+type+"##索引为空");
            return false;
        }
        if (index > 4 || index < 0) {
            XLog.warn("sn:"+sn+"##"+type+"##索引异常 index:" + index);
            return false;
        }
        if (ObjectUtils.isEmpty(action)) {
            XLog.warn("sn:"+sn+"##"+type+"##action 为空");
            return false;
        }
        if (action != 0 && action != 1) {
            XLog.warn("sn:"+sn+"##"+type+"##动作异常 action:" + action);
            return false;
        }
        return true;
    }

    private GroupDevice getGroupBySn(String sn) {
        Device deviceBySn = deviceMapper.findDeviceBySn(sn);
        if (deviceBySn != null && (deviceBySn.getType() == null || deviceBySn.getType().isEmpty())) {
            deviceBySn.setType("adapter");
            deviceMapper.updateById(deviceBySn);
        }
        return groupDeviceMapper.selectWithDetails(sn);
    }

//    public void simulationPrintPAD() throws MqttException {
//        simulationPrint("pad");
//    }

//    public void simulationPrintPDA() throws MqttException {
//        simulationPrint("pda");
//    }


    public boolean hasTheProduct(String barCode) {
//        return !ObjectUtils.isEmpty(productMapper.findProductByBarCode(barCode));
        return true;
    }

    public void changeLamps(Long groupId,String sn, int index, int action) throws MqttException {
        List<Integer> lamps = lampsMapByGroup.get(String.valueOf(groupId));
        lamps.set(index, action);
        orderAdapterAction(sn,index, action);
    }

    //适配器 询问心跳
    public void checkOnline() throws MqttException {
        // todo 开启设备在线状态巡检
        LocalDateTime now = LocalDateTime.now();
        QueryWrapper<Device> queryWrapper = new QueryWrapper<>();
        queryWrapper.lambda().eq(Device::getState,1).orderBy(true,false,Device::getCreateTime);
        for (Device device : deviceMapper.selectList(queryWrapper)) {
            LocalDateTime lastOnlineTime = device.getLastOnlineTime();
            if (ObjectUtils.isEmpty(lastOnlineTime)) {
                continue;
            }
            String type = device.getType();
            String sn = device.getSn();
            if (ObjectUtils.isEmpty(sn)) {
                continue;
            }
            if (ObjectUtils.isEmpty(type)) {
                continue;
            }
            if (Duration.between(lastOnlineTime,now).toMillis() > Config.CHECK_ONLINE_RATE) {
                deviceMapper.changeDevice(null, null, 0, sn);
                //todo 给数字孪生发消息
                Result<GroupDto> groupDtoResult = deviceService.inWhichGroup(device.getSn());
                if (groupDtoResult.isSuccess()){
                    simulationDeviceState(groupDtoResult.getData().getId(),type, 0);
                }
            }
        }
    }

    //适配器 询问心跳
    public void syncOnline() throws MqttException {
        MqttHelper.OrderSyncOnlineDto orderSyncOnlineDto = new MqttHelper.OrderSyncOnlineDto();
        orderSyncOnlineDto.setSyncId(UUID.getUUID());
        mqttClientService.sendToMqtt(SERVICE_SYNC_ONLINE.getTopic(), GsonUtil.getInstance().toJson(orderSyncOnlineDto));
    }

    //适配器 同步数据请求
    private void orderAdapterSync() throws MqttException {
        MqttHelper.OrderAdapterSyncDto orderAdapterSyncDto = new MqttHelper.OrderAdapterSyncDto();
        orderAdapterSyncDto.setSyncId(UUID.getUUID());
        mqttClientService.sendToMqtt(DEVICE_ADAPTER_SYNC.getTopic(), GsonUtil.getInstance().toJson(orderAdapterSyncDto));
    }

    //适配器 控制灯泡
    private void orderAdapterAction(String sn,Integer index, Integer action) throws MqttException {
        MqttHelper.OrderAdapterLampsDto lampsDto = new MqttHelper.OrderAdapterLampsDto();
        lampsDto.setSn(sn);
        lampsDto.setIndex(index);
        lampsDto.setAction(action);
        mqttClientService.sendToMqtt(ORDER_ADAPTER_LAMPS.getTopic(), GsonUtil.getInstance().toJson(lampsDto));
    }

    private void sendSnlistInGroup(String sn) throws MqttException {
        List4GroupDevicesDto groupDevicesDto = new List4GroupDevicesDto();
        Result<GroupDto> inWhichGroup = deviceService.inWhichGroup(sn);
        if (inWhichGroup.isSuccess()){
            Result<List<DeviceDto>> listResult = groupService.listDevice(inWhichGroup.getData().getId());
            List<DeviceDto> deviceDtoList = listResult.getData();
            if (listResult.isSuccess() && deviceDtoList != null && deviceDtoList.size() > 0){
                List<String> snList = deviceDtoList.stream().map(item -> item.getSn()).collect(Collectors.toList());
                groupDevicesDto.setList(snList);
                mqttClientService.sendToMqtt(DEVICE_INFO_GROUP.getTopic()+sn,GsonUtil.getInstance().toJson(groupDevicesDto));
            }
        }
    }

    //数字孪生 设备上线下线
    private void simulationDeviceState(Long groupId,String device, int online) throws MqttException {
        XLog.info("simulationDeviceState.groupId="+groupId+",device="+device+",online="+online);
        MqttHelper.SimulationDeviceStateDto deviceStateDto = new MqttHelper.SimulationDeviceStateDto();
        deviceStateDto.setDevice(device);
        deviceStateDto.setOnline(online);
        mqttClientService.sendToMqtt("simulation/device/state/"+groupId, GsonUtil.getInstance().toJson(deviceStateDto));
    }

    //数字孪生 显示开关
    private void simulationSwitchState(Long groupId,Integer index, Integer action) throws MqttException {
        MqttHelper.SimulationSwitchStateDto switchStateDto = new MqttHelper.SimulationSwitchStateDto();
        switchStateDto.setIndex(index);
        switchStateDto.setAction(action);
        mqttClientService.sendToMqtt("simulation/switch/state/"+groupId, GsonUtil.getInstance().toJson(switchStateDto));
    }

    //数字孪生 控制打印pad
    public void simulationPrintPad(Long groupId,String barCode) throws MqttException {
        simulationPrintPAD(groupId);
        MqttHelper.SimulationPrintPadDto printDto = new MqttHelper.SimulationPrintPadDto();
        ProductWebHelperDao dao = productMapper.findProductWebHelperForPrint(barCode);
        printDto.setBarCode(dao.getBarCode());
        printDto.setCreateAt(DateUtil.formatChinaDayDate(dao.getCreateAt()));
        printDto.setCount(1);
        printDto.setProductType(dao.getModelName());
        printDto.setProductName("ARCHERMIND" + dao.getTypeName());
        mqttClientService.sendToMqtt("simulation/print/pad/"+groupId, GsonUtil.getInstance().toJson(printDto));
    }

    //数字孪生 控制打印pda
    public void simulationPrintPda(Long groupId,int action) throws MqttException {
        simulationPrintPDA(groupId);
        MqttHelper.SimulationPrintPdaDto printPdaDto=new MqttHelper.SimulationPrintPdaDto();
        printPdaDto.setAction(action);
        List<MqttHelper.SimulationPrintPdaItemDto> payloadContent = new ArrayList<>();
        printPdaDto.setList(payloadContent);
        List<BarListDto> list = productStoreMapper.findProductStorePrintNoPage();
        MqttHelper.SimulationPrintPdaItemDto printDto = null;
        for (BarListDto dao : list) {
            printDto = new MqttHelper.SimulationPrintPdaItemDto();
            switch (action) {//@ApiModelProperty(value = "出入库，入库：1，出库：0")
                case 0:
                    printDto.setAction("出库");
                    break;
                case 1:
                    printDto.setAction("入库");
                    break;
            }
            printDto.setDate(dao.getDate());
            printDto.setBarCode(dao.getBarCode());
            printDto.setProductType(dao.getProductType());
            printDto.setProductModel(dao.getProductModel());
            payloadContent.add(printDto);
        }
        mqttClientService.sendToMqtt("simulation/print/pda/"+groupId, GsonUtil.getInstance().toJson(printPdaDto));
    }

    //数字孪生 控制打印
    private void simulationPrint(Long groupId,String deviceType) throws MqttException {
        MqttHelper.SimulationPrintDto printDto = new MqttHelper.SimulationPrintDto();
        printDto.setDevice(deviceType);
        mqttClientService.sendToMqtt("simulation/print/"+groupId, GsonUtil.getInstance().toJson(printDto));
    }

    //同步数据到数字孪生
    private void simulationSyncData(Long groupId) {
        List<Integer> switches = switchesByGroup.get(String.valueOf(groupId));
        for (int i = 0; i < switches.size(); i++) {
            try {
                simulationSwitchState(groupId,i, switches.get(i));
            } catch (MqttException mqttException) {
                XLog.error(mqttException);
            }
        }
    }

    public void simulationPrintPAD(Long groupId) throws MqttException {
        simulationPrint(groupId,"pad");
    }

    public void simulationPrintPDA(Long groupId) throws MqttException {
        simulationPrint(groupId,"pda");
    }

    public List<Integer> getSwitches(Long groupId) {
        return switchesByGroup.computeIfAbsent(String.valueOf(groupId), k -> Arrays.asList(0, 0, 0, 0));
    }

    public List<Integer> getLamps(Long groupId) {
//        return lampsMapByGroup.computeIfAbsent(groupId, k -> Arrays.asList(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0));
        return lampsMapByGroup.get(String.valueOf(groupId));
    }

    public void onMessage4Websocket(String message) {
        try {
            WsPlcRequestDto wsPlcRequestDto = JSONObject.parseObject(message, WsPlcRequestDto.class);
            Long groupId = wsPlcRequestDto.getGroupId();
            String type = wsPlcRequestDto.getType();
            Integer index = wsPlcRequestDto.getIndex();
            Integer action = wsPlcRequestDto.getAction();

            WsPlcResponseDto<List<Integer>> wsPlcResponseDto = new WsPlcResponseDto<>();

            Result<List<DeviceDto>> listResult = groupService.listDevice(groupId);
            List<DeviceDto> deviceDtoList = listResult.getData();
            if (deviceDtoList.isEmpty()) {
                wsPlcResponseDto.setCode(WsPlcResponseDto.Code.ERROR.code);
                wsPlcResponseDto.setMsg("当前展会中无设备，请稍后重试");
                String errorMessage = JSONObject.toJSONString(wsPlcResponseDto);
                CommonWebSocketService.sentMessageByGroupId(groupId,errorMessage);
                return;
            }
            DeviceDto deviceDto = deviceDtoList.stream().filter(item -> item != null && "adapter".equals(item.getType())).findFirst().orElse(null);

            List<Integer> lamps = lampsMapByGroup.get(String.valueOf(groupId));
            if (deviceDto == null || deviceDto.getState() == 0 || lamps == null) {
                wsPlcResponseDto.setCode(WsPlcResponseDto.Code.ERROR.code);
                wsPlcResponseDto.setMsg("设备未在线或未同步过数据，请稍后重试");
                String errorMessage = JSONObject.toJSONString(wsPlcResponseDto);
                CommonWebSocketService.sentMessageByGroupId(groupId,errorMessage);
                return;
            }

            // todo 根据设备类型

            //if (lamps != null && lamps.size() == 16) {
            //    wsPlcResponseDto.setCode(WsPlcResponseDto.Code.ERROR.code);
            //    wsPlcResponseDto.setMsg("PLC设备类型不符");
            //    String errorMessage = JSONObject.toJSONString(wsPlcResponseDto);
            //    CommonWebSocketService.sentMessageByGroupId(groupId,errorMessage);
            //    return;
            //}

            if (index == null || action == null || (action != 0 && action != 1) || index < 0 ){
                wsPlcResponseDto.setCode(WsPlcResponseDto.Code.ERROR.code);
                wsPlcResponseDto.setMsg("参数错误");
                wsPlcResponseDto.setData(lampsMapByGroup.get(String.valueOf(groupId)));
                String errorMessage = JSONObject.toJSONString(wsPlcResponseDto);
                CommonWebSocketService.sentMessageByGroupId(groupId,errorMessage);
                return;
            }
            changeLamps(groupId,deviceDto.getSn(),index,action);

        }catch (Exception e) {
            e.printStackTrace();
        }

    }




}
