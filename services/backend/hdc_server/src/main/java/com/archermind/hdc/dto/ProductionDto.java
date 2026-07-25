package com.archermind.hdc.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

import java.time.YearMonth;

@Data
public class ProductionDto {

    private Long id;

    @ApiModelProperty(value = "分组id")
    private Long groupId;

    @ApiModelProperty(value = "产品类型")
    private String productType;

    @ApiModelProperty(value = "产品型号")
    private String productModel;

    @ApiModelProperty(value = "计划产量")
    private Integer plannedProduction;

    @ApiModelProperty(value = "实际产量")
    private Integer actualProduction;

    @ApiModelProperty(value = "年月", notes = "格式：yyyy-MM")
    private String date;
}
