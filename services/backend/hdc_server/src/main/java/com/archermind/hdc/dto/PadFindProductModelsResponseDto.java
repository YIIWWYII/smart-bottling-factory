package com.archermind.hdc.dto;

import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

import java.util.List;

@Data
public class PadFindProductModelsResponseDto {
    @ApiModelProperty(value = "产品类型列表")
    private List<ProductModelDto> list;
}
