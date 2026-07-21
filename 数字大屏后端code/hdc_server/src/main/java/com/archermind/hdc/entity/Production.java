package com.archermind.hdc.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;

import java.time.LocalDate;
import java.time.LocalDateTime;
import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.TableField;
import java.io.Serializable;
import java.time.YearMonth;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.experimental.Accessors;

/**
 * <p>
 * 产品产量表
 * </p>
 *
 * @author zwh
 * @since 2024-03-13
 */
@Data
@EqualsAndHashCode(callSuper = false)
@Accessors(chain = true)
@TableName("production")
@ApiModel(value="Production对象", description="产品产量表")
public class Production implements Serializable {

    private static final long serialVersionUID = 1L;

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    private Long groupId;

    private String productType;

    private String productModel;

    @ApiModelProperty(value = "计划产量")
    private Integer plannedProduction;

    @ApiModelProperty(value = "实际产量")
    private Integer actualProduction;

    @ApiModelProperty(value = "年月")
    private String date;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;


}
