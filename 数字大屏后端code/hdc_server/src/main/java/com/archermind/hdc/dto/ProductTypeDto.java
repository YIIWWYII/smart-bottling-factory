package com.archermind.hdc.dto;

import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

@Data
public class ProductTypeDto {
    @ApiModelProperty(value = "产品类型名称")
    private String name;
    @ApiModelProperty(value = "产品类型code")
    private String code;
}
