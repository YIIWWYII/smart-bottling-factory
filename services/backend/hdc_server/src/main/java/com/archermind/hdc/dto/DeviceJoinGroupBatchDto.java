package com.archermind.hdc.dto;

import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

import java.util.List;

@Data
public class DeviceJoinGroupBatchDto {
    @ApiModelProperty(value = "设备唯一标识的list")
    private List<String> snList;
    @ApiModelProperty(value = "分组唯一标识")
    private Long groupId;

}
