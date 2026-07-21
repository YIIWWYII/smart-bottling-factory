package com.archermind.hdc.dto;

import lombok.Data;

import java.time.LocalDateTime;


@Data
public class SwitchWorkTimeDto {

    //分组id
    private Long groupId;
    //设备名称
    private String equipmentName;
    //开始工作时间
    private LocalDateTime workBeginTime;
    //上个状态
    private Integer lastState;
    //上次状态改变时间
    private LocalDateTime lastStateTime;
    //工作时长，单位：秒
    private Long runTimeLength;
    // 待机时长，单位：秒
    private Long waitTimeLength;

}
