package com.archermind.hdc.dto;

import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

import java.util.List;

@Data
public class PadFindProductModelsRequestDto {
    @ApiModelProperty(value = "产品类型code")
    private String productTypeCode;
}
