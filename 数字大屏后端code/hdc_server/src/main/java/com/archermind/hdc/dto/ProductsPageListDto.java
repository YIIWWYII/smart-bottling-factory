package com.archermind.hdc.dto;

import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

@Data
public class ProductsPageListDto {
    @ApiModelProperty(value = "产品条码编号")
    private String barCode;
    @ApiModelProperty(value = "产品类型名称")
    private String typeName;
    @ApiModelProperty(value = "型号名称", required = true)
    private String modelName;
    @ApiModelProperty(value = "录入时间 格式：yyyy-MM-dd HH:mm:ss")
    private String createAt;
    @ApiModelProperty(value = "产品拍摄照片")
    private String image;
}
