package com.archermind.hdc.dto;

import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

@Data
public class WebChangeLampsStateRequestDto {

    @ApiModelProperty(value = "分组id", required = true)
    private Long groupId;
//    @ApiModelProperty(value = "设备唯一标识", required = true)
//    private String deviceSn;
    @ApiModelProperty(value = "16盏灯的索引，从0开始，0、1、2、3...15", required = true)
    private Integer index;
    @ApiModelProperty(value = "设置的动作，0：关灯，1：开灯", required = true)
    private Integer action;
}
