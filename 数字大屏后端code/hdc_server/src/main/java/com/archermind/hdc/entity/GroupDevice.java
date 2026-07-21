package com.archermind.hdc.entity;

import com.archermind.hdc.dto.DeviceDto;
import com.archermind.hdc.dto.GroupDto;
import com.baomidou.mybatisplus.annotation.*;

import java.io.Serializable;
import java.time.LocalDateTime;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.experimental.Accessors;

/**
 * <p>
 * 分组-设备
 * </p>
 *
 * @author zwh
 * @since 2024-03-01
 */
@Data
@EqualsAndHashCode(callSuper = false)
@Accessors(chain = true)
@TableName("group_device")
@ApiModel(value="GroupDevice对象", description="分组-设备")
public class GroupDevice implements Serializable {

    private static final long serialVersionUID = 1L;

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    @ApiModelProperty(value = "分组id")
    @TableField("group_id")
    private Long groupId;

    @ApiModelProperty(value = "设备唯一编码")
    @TableField("device_sn")
    private String deviceSn;

    @TableField(exist = false)
    private GroupDto groupInfo;

    @TableField(exist = false)
    private DeviceDto deviceInfo;

    @TableField(value ="create_time", fill = FieldFill.INSERT)
    private LocalDateTime createTime;
    @TableField(value ="update_time", fill = FieldFill.UPDATE)
    private LocalDateTime updateTime;

    private Integer deleteFlag;


}
