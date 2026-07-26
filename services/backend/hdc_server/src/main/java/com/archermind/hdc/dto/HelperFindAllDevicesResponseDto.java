package com.archermind.hdc.dto;

import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

import java.util.List;

@Data
public class HelperFindAllDevicesResponseDto {
    @ApiModelProperty(value = "数据列表")
    private List<HelperDeviceDto> list;
}