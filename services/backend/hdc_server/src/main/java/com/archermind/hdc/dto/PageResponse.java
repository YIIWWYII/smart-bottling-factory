package com.archermind.hdc.dto;

import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

import java.util.List;

@Data
public class PageResponse<T> {
    @ApiModelProperty(value = "当前页数据列表", required = true)
    private List<T> list;
    @ApiModelProperty(value = "数据总量", required = true)
    private int total;
}
