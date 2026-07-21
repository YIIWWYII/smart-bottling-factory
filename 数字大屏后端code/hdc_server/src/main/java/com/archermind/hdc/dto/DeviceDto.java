package com.archermind.hdc.dto;

import com.baomidou.mybatisplus.annotation.TableField;
import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

@Data
@ApiModel("设备信息dto")
public class DeviceDto {

    @ApiModelProperty(value = "设备唯一标识")
    private String sn;

    @ApiModelProperty(value = "设备类型。pad、pda、adapter")
    private String type;

    @ApiModelProperty(value = "在线状态。0：离线；1在线")
    private int state;
}
