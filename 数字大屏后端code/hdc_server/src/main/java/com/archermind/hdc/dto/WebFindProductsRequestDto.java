package com.archermind.hdc.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class WebFindProductsRequestDto {
    @ApiModelProperty(value = "分组id", required = true)
    private Long groupId;
    @ApiModelProperty(value = "当前页码")
    private Integer currentPage;
    @ApiModelProperty(value = "每页行数")
    private Integer pageSize;
    @ApiModelProperty(value = "产品条码编号")
    private String barCode;
    @ApiModelProperty(value = "产品类型Code")
    private String typeCode;
    @ApiModelProperty(value = "检索开始时间，需要与结束时间同时出现 格式：yyyy-MM-dd HH:mm:ss")
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime startTime;
    @ApiModelProperty(value = "检索结束时间，需要与开始时间同时出现 格式：yyyy-MM-dd HH:mm:ss")
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime endTime;
}
