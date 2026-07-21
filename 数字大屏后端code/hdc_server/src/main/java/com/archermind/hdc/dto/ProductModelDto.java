package com.archermind.hdc.dto;

import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

@Data
public class ProductModelDto {
    @ApiModelProperty(value = "产品型号名称")
    private String name;
    @ApiModelProperty(value = "产品型号code")
    private String code;
}
