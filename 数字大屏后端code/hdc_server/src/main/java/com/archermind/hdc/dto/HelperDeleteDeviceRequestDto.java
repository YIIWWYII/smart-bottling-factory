package com.archermind.hdc.dto;

import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

@Data
public class HelperDeleteDeviceRequestDto {
    @ApiModelProperty(value = "设备唯一标识")
    private String sn;
}
