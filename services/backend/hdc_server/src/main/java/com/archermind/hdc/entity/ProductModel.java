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
 * 产品型号
 * </p>
 *
 * @author zwh
 * @since 2024-03-01
 */
@Data
@EqualsAndHashCode(callSuper = false)
@Accessors(chain = true)
@TableName("product_model")
@ApiModel(value="ProductModel对象", description="产品型号")
public class ProductModel extends BaseEntity implements Serializable {

    private static final long serialVersionUID = 1L;

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    @ApiModelProperty(value = "型号名称")
    @TableField("name")
    private String name;

    @ApiModelProperty(value = "型号码")
    @TableField("code")
    private String code;

    @ApiModelProperty(value = "产品类型码")
    @TableField("type_code")
    private String typeCode;


}
