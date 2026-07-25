package com.archermind.hdc.dto;

import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

@Data
public class PageRequest {
    @ApiModelProperty(value = "页码，从0开始", required = true)
    private Integer page;
    @ApiModelProperty(value = "单页数量大小，默认20")
    private Integer size;
    @ApiModelProperty(value = "设备唯一标识")
    private String sn;
}
