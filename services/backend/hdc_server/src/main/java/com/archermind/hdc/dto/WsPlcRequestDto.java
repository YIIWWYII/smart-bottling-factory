package com.archermind.hdc.dto;

import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

@Data
public class WsPlcRequestDto {

    private Long groupId;
    @ApiModelProperty(value = "控制类型。lamp 或者 switch")
    private String type;
    private Integer index;
    private Integer action;

    private String jsonInfo;
}
