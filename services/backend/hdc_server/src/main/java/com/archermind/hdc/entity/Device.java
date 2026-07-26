package com.archermind.hdc.entity;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.annotation.IdType;
import java.time.LocalDateTime;
import com.baomidou.mybatisplus.annotation.TableId;
import java.io.Serializable;
import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.experimental.Accessors;

/**
 * <p>
 * 设备
 * </p>
 *
 * @author zwh
 * @since 2024-03-01
 */
@Data
@EqualsAndHashCode(callSuper = false)
@Accessors(chain = true)
@TableName("device")
@ApiModel(value="Device对象", description="设备")
public class Device extends BaseEntity implements Serializable {

    private static final long serialVersionUID = 1L;

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    @ApiModelProperty(value = "设备唯一标识")
    @TableField("sn")
    private String sn;

    @ApiModelProperty(value = "设备类型。pad、pda、adapter")
    @TableField("type")
    private String type;

    @ApiModelProperty(value = "状态。0离线；1在线")
    @TableField("state")
    private Integer state;

    @ApiModelProperty(value = "最后一次上报上线的时间")
    @TableField("last_online_time")
    private LocalDateTime lastOnlineTime;



}
