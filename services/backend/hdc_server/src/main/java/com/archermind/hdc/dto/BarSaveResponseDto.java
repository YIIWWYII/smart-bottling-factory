package com.archermind.hdc.dto;

import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

@Data
public class BarSaveResponseDto {
    @ApiModelProperty(value = "出入库扫描保存结果，ok为成功")
    String result;
}
