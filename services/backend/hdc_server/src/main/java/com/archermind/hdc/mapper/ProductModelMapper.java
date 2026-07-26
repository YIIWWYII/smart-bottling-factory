package com.archermind.hdc.mapper;


import com.archermind.hdc.entity.ProductModel;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Select;
import org.mapstruct.Mapper;

import java.util.List;

/**
 * <p>
 * 产品型号 Mapper 接口
 * </p>
 *
 * @author zwh
 * @since 2024-03-01
 */
@Mapper
public interface ProductModelMapper extends BaseMapper<ProductModel> {
    @Select("select * from product_model order by create_time asc ")
    List<ProductModel> findAllProductModels();

    @Select("select * from product_model where type_code=#{typeCode} order by create_time asc ")
    List<ProductModel> findProductModelsByTypeCode(String typeCode);

    @Select("select * from product_model where code=#{modelCode}")
    ProductModel findProductModelByCode(String modelCode);
}
