package com.archermind.hdc.dto;

import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

@Data
public class HelperChangeDeviceRequestDto {
    @ApiModelProperty(value = "设备唯一标识")
    private String sn;
    @ApiModelProperty(value = "设备类型")
    private String type;
}
