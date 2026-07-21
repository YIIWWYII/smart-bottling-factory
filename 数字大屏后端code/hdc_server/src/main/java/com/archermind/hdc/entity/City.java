package com.archermind.hdc.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import java.io.Serializable;
import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.experimental.Accessors;

/**
 * <p>
 * 城市字典表
 * </p>
 *
 * @author zwh
 * @since 2024-03-05
 */
@Data
@EqualsAndHashCode(callSuper = false)
@Accessors(chain = true)
@TableName("city")
@ApiModel(value="City对象", description="城市字典表")
public class City implements Serializable {

    private static final long serialVersionUID = 1L;

    @TableId(value = "id", type = IdType.AUTO)
    private Integer id;

    @ApiModelProperty(value = "地区名称")
    private String name;

    @ApiModelProperty(value = "可用标识。0：不可用：1：可用")
    private Integer useFlag;

    @ApiModelProperty(value = "排序序号",notes = "影响list查询的顺序")
    private Integer orders;


}
