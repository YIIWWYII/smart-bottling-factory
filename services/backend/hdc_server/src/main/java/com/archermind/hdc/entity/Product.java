package com.archermind.hdc.entity;

import com.baomidou.mybatisplus.annotation.TableField;
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
 * 产品
 * </p>
 *
 * @author zwh
 * @since 2024-03-01
 */
@Data
@EqualsAndHashCode(callSuper = false)
@Accessors(chain = true)
@TableName("product")
@ApiModel(value="Product对象", description="产品")
public class Product extends BaseEntity implements Serializable {

    private static final long serialVersionUID = 1L;

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    @ApiModelProperty(value = "条形码编号")
    @TableField("bar_code")
    private String barCode;

    @ApiModelProperty(value = "产品类型码")
    @TableField("type_code")
    private String typeCode;

    @ApiModelProperty(value = "产品型号码")
    @TableField("model_code")
    private String modelCode;

    @ApiModelProperty(value = "图片路径")
    @TableField("path")
    private String path;

    @ApiModelProperty(value = "设备sn")
    @TableField("device_sn")
    private String deviceSn;

    @ApiModelProperty(value = "分组id")
    @TableField("group_id")
    private Long groupId;

    @TableField(exist = false)
    private ProductType type;
    @TableField(exist = false)
    private ProductModel model;


}
