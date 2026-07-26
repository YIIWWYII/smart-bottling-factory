package com.archermind.hdc.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

import javax.validation.constraints.NotEmpty;
import javax.validation.constraints.NotNull;
import java.time.LocalDateTime;


@Data
@ApiModel
public class GroupDto {
    @ApiModelProperty(value = "id", notes = "编辑信息时使用")
    private Long id;

    @NotEmpty(message = "展会分组名称不能为空")
    @ApiModelProperty(value = "名称",required = true)
    private String name;

    @ApiModelProperty(value = "入组口令")
    private String code;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    @ApiModelProperty(value = "开始时间,格式：yyyy-MM-dd HH:mm:ss" , required = true)
    private LocalDateTime beginTime;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    @ApiModelProperty(value = "结束时间,格式：yyyy-MM-dd HH:mm:ss", required = true)
    private LocalDateTime endTime;

    @ApiModelProperty(value = "是否可用。1：可用（默认）0：不可用")
    private Boolean useFlag;

    @ApiModelProperty(value = "城市id", required = true)
    private Long cityId;

    @ApiModelProperty(value = "城市名称", required = true)
    private String cityName;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    @ApiModelProperty(value = "设备运行时间计算用基础时间,格式：yyyy-MM-dd HH:mm:ss,不设置默认分组开始时间")
    private LocalDateTime machineBaseTime;

    @ApiModelProperty(value = "到访数量：访客")
    private Integer numVisitor;

    @ApiModelProperty(value = "到访数量：员工")
    private Integer numEmployee;
}
