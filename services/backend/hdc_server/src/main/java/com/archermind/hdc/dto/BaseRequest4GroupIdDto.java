package com.archermind.hdc.dto;

import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

@Data
public class BaseRequest4GroupIdDto {

    @ApiModelProperty(value = "分组id")
    private Long groupId;
}
