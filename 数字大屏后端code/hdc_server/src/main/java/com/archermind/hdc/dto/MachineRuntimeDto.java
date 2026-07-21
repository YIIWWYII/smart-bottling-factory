package com.archermind.hdc.dto;

import lombok.Data;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.concurrent.TimeUnit;

@Data
public class MachineRuntimeDto {

    // 运行时长，格式HH:mm:ss
    private Duration runtime;
    private String runtimeStr= "00:00:00";
    // 待机时长，格式HH:mm:ss
    private Duration waitTime;
    private String waitTimeStr= "00:00:00";
    // 负责人
    private String operator = "张小明";
    // 上次的状态，默认是待机
    private int lastState = 0;
    // 上次状态改变的时间
    private LocalDateTime lastStateTime;
    // 设备效率
    private String efficiency = "78%";
    // 质量合格率
    private String qualityRate = "89%";

//    DateTimeFormatter formatter = DateTimeFormatter.ofPattern("HH:mm:ss");

    public void setRuntime(Duration runtime){
        if (runtime == null){
            return;
        }
        this.runtime = runtime;
        long hours = TimeUnit.MILLISECONDS.toHours(runtime.toMillis());
        long minutes = TimeUnit.MILLISECONDS.toMinutes(runtime.toMillis()) %60;
        long millis = TimeUnit.MILLISECONDS.toSeconds(runtime.toMillis()) %60;
        this.runtimeStr=String.format("%02d:%02d:%02d",hours,minutes,millis);
    }

    public void setWaitTime(Duration waitTime){
        if (waitTime == null){
            return;
        }
        this.waitTime = waitTime;
        long hours = TimeUnit.MILLISECONDS.toHours(waitTime.toMillis());
        long minutes = TimeUnit.MILLISECONDS.toMinutes(waitTime.toMillis()) %60;
        long millis = TimeUnit.MILLISECONDS.toSeconds(waitTime.toMillis()) %60;
        this.waitTimeStr=String.format("%02d:%02d:%02d",hours,minutes,millis);

    }
}
