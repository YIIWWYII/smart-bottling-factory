package com.archermind.hdc.dto;


import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

@ApiModel(value = "产线设备故障Dto")
@Data
public class MachineFailureDto {

    @ApiModelProperty(value = "分组id",required = true)
    private Long groupId;
    @ApiModelProperty(value = "设备型号",required = false,notes = "固定值：MG400")
    private String machineType;
    @ApiModelProperty(value = "设备名称",required = true)
    private String machineName;
    @ApiModelProperty(value = "故障名称",required = true)
    private String failureName;
    @ApiModelProperty(value = "故障等级",required = true)
    private String failureLevel;
    @ApiModelProperty(value = "故障时间，格式HH:mm:ss",required = true)
    private String failureTimeStr;
    @ApiModelProperty(value = "故障恢复时间，格式HH:mm:ss",notes = "不填默认：待处理")
    private String failureRecoverTimeStr;


}
