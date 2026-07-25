package com.archermind.hdc.dto;

import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

import java.util.List;

@Data
public class DeviceJoinGroupDto {
    @ApiModelProperty(value = "设备唯一标识")
    private String sn;
    @ApiModelProperty(value = "设备类型。pad/pda")
    private String type;
    @ApiModelProperty(value = "分组唯一标识")
    private Long groupId;
    @ApiModelProperty(value = "入组口令", notes = "暂时未校验，可省略")
    private String code;
}
