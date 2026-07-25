package com.archermind.hdc.dto;

import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

import java.util.List;

@Data
public class DeviceGroupDto {

    @ApiModelProperty(value = "分组唯一标识")
    private Long groupId;
    @ApiModelProperty(value = "设备唯一标识")
    private String sn;
}
