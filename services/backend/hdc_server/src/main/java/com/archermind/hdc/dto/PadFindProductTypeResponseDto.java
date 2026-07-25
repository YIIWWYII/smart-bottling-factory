package com.archermind.hdc.dto;

import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

import java.util.List;

@Data
public class PadFindProductTypeResponseDto {
    @ApiModelProperty(value = "产品类型列表")
    private List<ProductTypeDto> list;
}
