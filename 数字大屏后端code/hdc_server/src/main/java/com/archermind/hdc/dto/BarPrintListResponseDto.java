package com.archermind.hdc.dto;

import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

import java.util.List;

@Data
public class BarPrintListResponseDto {
    @ApiModelProperty(value = "扫描完成打印列表")
    private List<BarListDto> list;
}
