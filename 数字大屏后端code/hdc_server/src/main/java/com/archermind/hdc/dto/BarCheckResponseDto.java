package com.archermind.hdc.dto;

import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

@Data
public class BarCheckResponseDto {
    @ApiModelProperty(value = "扫描的条码编号")
    String barCode;
    @ApiModelProperty(value = "扫描时间")
    String date;
}
