package com.archermind.hdc.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import java.time.LocalDateTime;
import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.TableField;
import java.io.Serializable;
import java.time.LocalTime;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.experimental.Accessors;

/**
 * <p>
 * 设备故障表
 * </p>
 *
 * @author zwh
 * @since 2024-03-13
 */
@Data
@EqualsAndHashCode(callSuper = false)
@Accessors(chain = true)
@TableName("machine_failure")
@ApiModel(value="MachineFailure对象", description="设备故障表")
public class MachineFailure implements Serializable {

    private static final long serialVersionUID = 1L;

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    @ApiModelProperty(value = "分组id")
    private Long groupId;

    @ApiModelProperty(value = "设备型号")
    private String machineType;

    @ApiModelProperty(value = "设备名称")
    private String machineName;

    @ApiModelProperty(value = "故障原因")
    private String failureName;

    @ApiModelProperty(value = "故障级别")
    private String failureLevel;

    @ApiModelProperty(value = "故障时间")
    private LocalTime failureTime;

    @ApiModelProperty(value = "故障恢复时间")
    private LocalTime failureRecoverTime;

    @ApiModelProperty(value = "创建时间")
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;


}
