package com.archermind.hdc.dto;

import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

@Data
public class DeviceCreateRequestDto {
    @ApiModelProperty(value = "设备唯一标识")
    private String sn;
    @ApiModelProperty(value = "设备类型。pad/pda/adapter")
    private String type;
}
