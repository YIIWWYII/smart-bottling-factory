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
 * 分组
 * </p>
 *
 * @author zwh
 * @since 2024-03-01
 */
@Data
@EqualsAndHashCode(callSuper = false)
@Accessors(chain = true)
@TableName("`group`")
@ApiModel(value="Group对象", description="分组")
public class Group extends BaseEntity implements Serializable {

    private static final long serialVersionUID = 1L;


    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    @ApiModelProperty(value = "组名")
    @TableField("name")
    private String name;

    @ApiModelProperty(value = "进组口令")
    @TableField("code")
    private String code;

    @ApiModelProperty(value = "启用标识。0:不可用；1:可用")
    @TableField("use_flag")
    private Integer useFlag;

    @ApiModelProperty(value = "城市id")
    @TableField("city_id")
    private Long cityId;

    @ApiModelProperty(value = "城市名称")
    @TableField("city_name")
    private String cityName;

    @ApiModelProperty(value = "开始时间")
    @TableField("begin_time")
    private LocalDateTime beginTime;

    @ApiModelProperty(value = "结束时间")
    @TableField("end_time")
    private LocalDateTime endTime;

    @ApiModelProperty(value = "到访数量：访客")
    @TableField("num_visitor")
    private Integer numVisitor;

    @ApiModelProperty(value = "到访数量：员工")
    @TableField("num_employee")
    private Integer numEmployee;

    @ApiModelProperty(value = "是否开启数字孪生。0：不开启(默认)；1：开启")
    @TableField("simulation")
    private Integer simulation;

    @ApiModelProperty(value = "设备运行时间计算用基础时间")
    @TableField("machine_base_time")
    private LocalDateTime machineBaseTime;

}
