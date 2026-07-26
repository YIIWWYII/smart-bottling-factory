package com.archermind.hdc.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import java.time.LocalDateTime;
import java.io.Serializable;
import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.experimental.Accessors;

/**
 * <p>
 * 产线设备运行数据表
 * </p>
 *
 * @author zwh
 * @since 2024-03-13
 */
@Data
@EqualsAndHashCode(callSuper = false)
@Accessors(chain = true)
@TableName("equipment_run_time")
@ApiModel(value="EquipmentRunTime对象", description="产线设备运行数据表")
public class MachineRunTime implements Serializable {

    private static final long serialVersionUID = 1L;

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    @ApiModelProperty(value = "分组id")
    private Long groupId;

    @ApiModelProperty(value = "plc设备名")
    private String equipmentName;

    @ApiModelProperty(value = "开始工作时间")
    private LocalDateTime workBeginTime;

    @ApiModelProperty(value = "运行时长，单位：秒")
    private Long runTimeLength;

    @ApiModelProperty(value = "待机时长，单位：秒")
    private Long waitTimeLength;


}
