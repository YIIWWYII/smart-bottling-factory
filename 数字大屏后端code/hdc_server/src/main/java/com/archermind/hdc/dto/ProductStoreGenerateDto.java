package com.archermind.hdc.dto;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

@Data
@ApiModel(value = "出入库记录测试数据请求类")
public class ProductStoreGenerateDto {
    @ApiModelProperty(value = "展会分组id")
    private Long groupId;
    @ApiModelProperty(value = "X50数量")
    private Integer count_X50;
    @ApiModelProperty(value = "X50-PRO数量")
    private Integer count_X50PRO;
    @ApiModelProperty(value = "X60数量")
    private Integer count_X60;
    @ApiModelProperty(value = "X60-PRO数量")
    private Integer count_X60PRO;
    @ApiModelProperty(value = "年月日。格式：yyyy-MM-dd")
    private String date;
}
