package com.archermind.hdc.dto;

import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

@Data
public class BarCheckRequestDto {
    @ApiModelProperty(value = "产品条码", required = true)
    private String barCode;
    @ApiModelProperty(value = "设备唯一标识")
    private String sn;
}
