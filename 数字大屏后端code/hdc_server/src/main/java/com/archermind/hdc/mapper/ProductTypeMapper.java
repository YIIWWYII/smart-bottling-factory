package com.archermind.hdc.mapper;


import com.archermind.hdc.entity.ProductType;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Select;
import org.mapstruct.Mapper;

import java.util.List;

/**
 * <p>
 * 产品类型 Mapper 接口
 * </p>
 *
 * @author zwh
 * @since 2024-03-01
 */
@Mapper
public interface ProductTypeMapper extends BaseMapper<ProductType> {
    @Select("select * from product_type order by create_time asc ")
    List<ProductType> findAllProductTypes();

    @Select("select * from product_type where code=#{typeCode}")
    ProductType findProductTypeByCode(String typeCode);

}
