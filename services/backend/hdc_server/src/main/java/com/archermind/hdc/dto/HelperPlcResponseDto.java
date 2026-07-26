package com.archermind.hdc.dto;

import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

import java.util.List;

@Data
public class HelperPlcResponseDto {
    @ApiModelProperty(value = "0：关闭、1：开启;长度16，依次标识16盏灯.")
    private List<Integer> lamps;
    @ApiModelProperty(value = "0：关闭，1：开启;依次：1号机床、2号机床、3号机床、4号机床")
    private List<Integer> switches;
}
