package com.archermind.hdc.dto;

import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

import java.util.List;
@Data
public class BarSaveRequestDto {
    @ApiModelProperty(value = "设备唯一标识")
    private String sn;
    @ApiModelProperty(value = "出入库管理，入库：1，出库：0",required = true)
    Integer action;
    @ApiModelProperty(value = "扫描条形码列表",required = true)
    List<BarSaveDto> barCodes;

}
