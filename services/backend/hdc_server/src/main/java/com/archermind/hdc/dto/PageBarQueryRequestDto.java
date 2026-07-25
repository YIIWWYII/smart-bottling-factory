package com.archermind.hdc.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
public class PageBarQueryRequestDto {
    @ApiModelProperty(value = "分组id", required = true)
    private Long groupId;
    @ApiModelProperty(value = "当前页码，从0开始")
    private Integer currentPage;
    @ApiModelProperty(value = "单页数量大小，默认20")
    private Integer pageSize;
    @ApiModelProperty(value = "条码")
    private String  barCode;
    @ApiModelProperty(value = "扫码日期，格式yyyy-MM-dd")
    @JsonFormat(pattern = "yyyy-MM-dd")
    private LocalDate date;
    @ApiModelProperty(value = "产品类型，传code值")
    private String productCode;
}
