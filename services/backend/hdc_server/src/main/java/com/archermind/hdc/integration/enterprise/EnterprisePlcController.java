package com.archermind.hdc.integration.enterprise;

import com.archermind.hdc.api.result.Result;
import com.archermind.hdc.dto.MqttHelper;
import com.archermind.hdc.integration.enterprise.dto.EnterpriseLampCommandRequest;
import com.archermind.hdc.integration.enterprise.dto.EnterprisePlcStatus;
import com.archermind.hdc.service.MqttClientService;
import com.archermind.hdc.util.GsonUtil;
import org.eclipse.paho.client.mqttv3.MqttException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/enterprise/plc")
public class EnterprisePlcController {
    private final EnterprisePlcRuntimeAdapter runtimeAdapter;
    private final MqttClientService mqttClientService;

    public EnterprisePlcController(EnterprisePlcRuntimeAdapter runtimeAdapter,
                                   MqttClientService mqttClientService) {
        this.runtimeAdapter = runtimeAdapter;
        this.mqttClientService = mqttClientService;
    }

    @GetMapping("/status")
    public Result<EnterprisePlcStatus> status() {
        return Result.success(runtimeAdapter.snapshot(mqttClientService.isConnected()));
    }

    @PostMapping("/lamps/{index}")
    public Result<Map<String, Object>> changeLamp(@PathVariable int index,
                                                   @RequestBody EnterpriseLampCommandRequest request) {
        EnterprisePlcStatus status = runtimeAdapter.snapshot(mqttClientService.isConnected());
        if (!status.isMqttConnected()) return Result.message("MQTT Broker 未连接，未发送控制命令");
        if (!status.isOnline()) return Result.message("PLC 适配器不在线，未发送控制命令");
        if (request == null || request.getAction() == null
                || (request.getAction() != 0 && request.getAction() != 1)) {
            return Result.message("action 只能为 0 或 1");
        }
        if (index < 0 || index >= status.getLamps().size()) {
            return Result.message("灯位 index 超出 PLC 当前上报范围");
        }

        MqttHelper.OrderAdapterLampsDto payload = new MqttHelper.OrderAdapterLampsDto();
        payload.setSn(status.getAdapterSn());
        payload.setIndex(index);
        payload.setAction(request.getAction());
        try {
            mqttClientService.sendToMqtt(MqttHelper.ORDER_ADAPTER_LAMPS.getTopic(),
                    GsonUtil.getInstance().toJson(payload));
        } catch (MqttException exception) {
            return Result.message("PLC 灯控命令发送失败：" + exception.getMessage());
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("status", "SENT");
        result.put("adapterSn", status.getAdapterSn());
        result.put("index", index);
        result.put("action", request.getAction());
        result.put("message", "命令已发送，最终状态以 PLC 后续上报为准");
        return Result.success(result);
    }
}
