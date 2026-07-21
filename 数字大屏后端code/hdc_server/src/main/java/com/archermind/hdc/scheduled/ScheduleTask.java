package com.archermind.hdc.scheduled;

import com.archermind.hdc.api.result.Result;
import com.archermind.hdc.dto.GroupDto;
import com.archermind.hdc.log.XLog;
import com.archermind.hdc.service.AdapterPlcService;
import com.archermind.hdc.service.DataScreenService;
import com.archermind.hdc.service.GroupService;
import org.eclipse.paho.client.mqttv3.MqttException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class ScheduleTask {
    @Autowired
    AdapterPlcService adapterPlcService;

    @Autowired
    private DataScreenService dataScreenService;

    @Autowired
    private GroupService groupService;

    @Scheduled(fixedDelay = Config.NOTICE_SYNC_RATE)
    public void noticeSyncCheck() throws MqttException {
        adapterPlcService.syncOnline();
    }

    @Scheduled(fixedDelay = Config.CHECK_ONLINE_RATE)
    public void checkOnline() throws MqttException {
        XLog.info("--------开始巡航检测--------");
        adapterPlcService.checkOnline();
        XLog.info("--------结束巡航检测--------");
    }

    @Scheduled(fixedDelay = Config.PUSH_MACHINEINFO_RATE)
    public void pushMachineInfo() throws MqttException {
        List<GroupDto> groupDtoList = groupService.listGroupWhichOngoing().getData();
        groupDtoList.forEach(groupDto -> dataScreenService.pushMachineData2Screen(groupDto.getId()));
    }

}
