package com.archermind.hdc.dto;

import io.swagger.annotations.ApiModelProperty;
import lombok.Data;
@Data
public class HelperDeviceDto {
    @ApiModelProperty(value = "数据唯一标识")
    private int id;
    @ApiModelProperty(value = "设备唯一标识")
    private String sn;
    @ApiModelProperty(value = "设备类型")
    private String type;
    @ApiModelProperty(value = "设备状态")
    private int state;
}
