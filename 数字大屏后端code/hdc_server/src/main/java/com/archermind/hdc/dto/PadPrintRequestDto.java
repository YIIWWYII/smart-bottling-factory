package com.archermind.hdc.dto;

import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

@Data
public class PadPrintRequestDto {
    @ApiModelProperty(value = "产品条形码编号")
    private String barCode;
}
