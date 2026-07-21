package com.archermind.hdc.dto;

import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

import java.util.List;

@Data
public class WebLampsResponse {
    @ApiModelProperty(value = "状态列表，0：关灯，1：开灯")
    private List<Integer> list;
}
