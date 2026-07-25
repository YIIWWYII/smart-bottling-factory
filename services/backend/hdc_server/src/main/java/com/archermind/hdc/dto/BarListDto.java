package com.archermind.hdc.dto;

import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

@Data
public class BarListDto {
    @ApiModelProperty(value = "条形码")
    String barCode;
    @ApiModelProperty(value = "出入库，入库：1，出库：0")
    int action;
    @ApiModelProperty(value = "扫描时间")
    String date;
    @ApiModelProperty(value = "产品类型")
    String productType;
    @ApiModelProperty(value = "产品型号")
    String productModel;
}
