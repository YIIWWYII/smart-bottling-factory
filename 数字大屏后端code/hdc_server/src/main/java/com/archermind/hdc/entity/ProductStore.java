package com.archermind.hdc.entity;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.annotation.IdType;
import java.time.LocalDateTime;
import com.baomidou.mybatisplus.annotation.TableId;
import java.io.Serializable;

import com.fasterxml.jackson.annotation.JsonFormat;
import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.experimental.Accessors;

/**
 * <p>
 * 产品出入库
 * </p>
 *
 * @author zwh
 * @since 2024-03-01
 */
@Data
@EqualsAndHashCode(callSuper = false)
@Accessors(chain = true)
@TableName("product_store")
@ApiModel(value="ProductStore对象", description="产品出入库")
public class ProductStore extends BaseEntity implements Serializable {

    private static final long serialVersionUID = 1L;

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    @ApiModelProperty(value = "条形码编号")
    @TableField("bar_code")
    private String barCode;

    @ApiModelProperty(value = "0:出库；1入库")
    @TableField("action")
    private Integer action;

    @ApiModelProperty(value = "批次。一次保存使用同一值")
    @TableField("seq")
    private Integer seq;

    @ApiModelProperty(value = "扫描时间")
    @TableField("date")
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime date;

    @ApiModelProperty(value = "设备sn")
    @TableField("device_sn")
    private String deviceSn;

    @ApiModelProperty(value = "分组id")
    @TableField("group_id")
    private Long groupId;

    @TableField(exist = false)
    private Product product;
    @TableField(exist = false)
    private ProductType type;
    @TableField(exist = false)
    private ProductModel model;

}
