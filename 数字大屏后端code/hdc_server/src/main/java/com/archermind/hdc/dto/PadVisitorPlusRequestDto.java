package com.archermind.hdc.dto;


import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

@Data
@ApiModel(value = "到访人数请求类")
public class PadVisitorPlusRequestDto {
    @ApiModelProperty(value = "设备唯一标识")
    private String sn;
    @ApiModelProperty(value = "访客类型。visitor或employee")
    private String type;
    @ApiModelProperty(value = "人数")
    private Integer count;
}
