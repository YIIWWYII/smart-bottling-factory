package com.archermind.hdc.dto;

import lombok.Data;
import org.eclipse.paho.client.mqttv3.MqttException;

import java.util.Arrays;
import java.util.List;

public class MqttHelper {
    private static MqttHelper instance = null;
    public static final TopicHelper SERVICE_SYNC_ONLINE = new TopicHelper("服务端发送心跳检测消息", "sync/online");
    public static final TopicHelper DEVICE_NETWORK_ONLINE = new TopicHelper("服务端接收设备在线指令", "device/network/online");
    public static final TopicHelper DEVICE_ADAPTER_SYNC = new TopicHelper("服务端发送同步plc全量状态消息", "order/adapter/sync");
    public static final TopicHelper ORDER_SERVICE_SYNC = new TopicHelper("服务端接收plc全量状态", "order/service/sync");
    public static final TopicHelper ORDER_SERVICE_SWITCH = new TopicHelper("服务端接收开关指令", "order/service/switch");
    public static final TopicHelper ORDER_ADAPTER_LAMPS = new TopicHelper("web端操作后，服务端发送plc灯状态消息", "order/adapter/action");
    public static final TopicHelper ORDER_SERVICE_LAMPS = new TopicHelper("服务端接收plc灯状态消息", "order/service/lamps");


    /**
     * 监听到此消息后返回分组信息（topic：softbus/groupconn/{mac}）
     */
    public static final TopicHelper SERVICE_INFO_GROUP = new TopicHelper("服务端接收plc灯状态消息", "softbus/request/groupconn");

    /**
     * 设备登录后返回组内设备信息，方便其软总线自组网
     */
    public static final TopicHelper DEVICE_INFO_GROUP = new TopicHelper("服务端发送分组及组内设备信息", "softbus/groupconn/");

    private MqttHelper() {

    }

    public synchronized static MqttHelper getInstance() {
        if (instance == null) {
            instance = new MqttHelper();
        }
        return instance;
    }

    public static class TopicHelper {
        private String desc;
        private String topic;

        public TopicHelper(String desc, String topic) {
            this.desc = desc;
            this.topic = topic;
        }

        public String getDesc() {
            return desc;
        }

        public String getTopic() {
            return topic;
        }
    }

    public interface RegisterMessage {
        void orderServiceSync(OrderServiceSyncDto dto);

        void orderServiceSwitch(OrderServiceSwitchDto dto) throws MqttException;

        void orderServiceLamps(OrderServiceLampsDto dto) throws MqttException;

        void deviceNetworkOnline(DeviceNetworkOnlineDto dto) throws MqttException;

        void connectComplete() throws MqttException;

        void listGroupDevces(DeviceInfoDto dto) throws MqttException;
    }


    // 监听的topic
    private List<TopicHelper> registerTopics = Arrays.asList(
            DEVICE_NETWORK_ONLINE,
            ORDER_SERVICE_SYNC,
            ORDER_SERVICE_SWITCH,
            ORDER_SERVICE_LAMPS,
            SERVICE_INFO_GROUP);

    public List<TopicHelper> getRegisterTopics() {
        return registerTopics;
    }

    @Data
    public class DeviceInfoDto{
        private String sn;
    }

    @Data
    public class DeviceNetworkOnlineDto {
        private String sn;
        private String ip;
        private String protocolType;
    }


    @Data
    public class OrderServiceSyncDto {
        private String sn;
        private List<Integer> device;   //开关状态
        private List<Integer> lamps;    //灯状态
        private Integer toatlLamps;     //灯的数量
        private String version; //设备版本信息
    }

    @Data
    public static class PlcInfo{
//        {"model":"HongZ-PLC-0001","version":"0.00","xx":"诚迈（南京）科技股份有限公司"}
        private String model="HongZ-PLC-0001";
        private String version;
        private String manufacturers="诚迈（南京）科技股份有限公司";
    }

    @Data
    public class OrderServiceSwitchDto {
        private String sn;
        private Integer index;
        private Integer action;
    }

    /**
     * 询问在线设备 收到请回答
     */
    @Data
    public static class OrderSyncOnlineDto {
        private String syncId;
    }

    @Data
    public static class OrderAdapterSyncDto {
        private String syncId;
    }

    @Data
    public static class OrderAdapterLampsDto {
        private String sn;
        private Integer index;
        private Integer action;
    }
    @Data
    public static class List4GroupDevicesDto {
        private List<String> list;
    }
    @Data
    public static class OrderServiceLampsDto {
        private String sn;
        private Integer index;
        private Integer totalLamps;
        private Integer action;
    }

    @Data
    public static class OrderServiceInfoDto {
        private String sn;
        private String info;
    }

    /**
     * 数字孪生 控制开关
     * "device":"pad",//pad、pda、adapter(适配器)
     * "online":0,//0:下线、1:上线
     */
    @Data
    public static class SimulationDeviceStateDto {
        private Long groupId;
        private String sn;
        private String device;
        private Integer online;
    }

    /**
     * 数字孪生 控制开关
     * "index":0,//0机械手、1机床、2流水线、3巡检车
     * "action":1,//0:关闭、1:开启
     */
    @Data
    public static class SimulationSwitchStateDto {
        private String sn;
        private Integer index;
        private Integer action;
    }

    /**
     * 数字孪生 打印
     * "device":"pad",//pad、pda,
     */
    @Data
    public static class SimulationPrintDto {
        private String sn;
        private String device;
    }

    @Data
    public static class SimulationPrintPadDto {
        //         "productName":"ARCHEMIND空调",//产品名称
//                 "productType":"KFR-26GW",//产品型号
//                 "count":1,//数量
//                 "createAt":"2023年6 月 19 日",//生产日期
//                 "barCode":"A66300005"//条码
        private String sn;
        private String productName;
        private String productType;
        private int count;
        private String createAt;
        private String barCode;
    }

    @Data
    public static class SimulationPrintPdaDto {
        private String sn;
        int action;
        List<SimulationPrintPdaItemDto> list;
    }

    @Data
    public static class SimulationPrintPdaItemDto {
        private String sn;
        String barCode;
        String action;
        String date;
        String productType;
        String productModel;
    }

}

