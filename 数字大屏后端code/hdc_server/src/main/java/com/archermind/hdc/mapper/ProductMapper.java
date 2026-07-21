package com.archermind.hdc.mapper;


import com.archermind.hdc.entity.Product;
import com.archermind.hdc.entity.ProductWebHelperDao;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.mapstruct.Mapper;

import java.util.List;

/**
 * <p>
 * 产品 Mapper 接口
 * </p>
 *
 * @author zwh
 * @since 2024-03-01
 */
@Mapper
public interface ProductMapper extends BaseMapper<Product> {

    @Select("select * from product " +
            "where bar_code = #{barCode} and group_id = #{groupId}")
    Product checkByBarCode(@Param("groupId") Long groupId, @Param("barCode") String barCode);

    @Select("<script> " +
            "select COUNT(*) " +
            "from product " +
            "<where>" +
            "type_code=#{typeCode}" +
            "</where>" +
            "</script>")
    int findCountByTypeCode(String typeCode);

    Page<Product> pageByCondition(Page<Product> page, @Param("ew") QueryWrapper<Product> queryWrapper);

    @Select("select * from product where model_code = #{model} and group_id = #{groupId}")
    List<Product> listByGroupIdAndModel(@Param("groupId") Long groupId, @Param("model") String model);

    @Select("<script> " +
            "select p.path as path,p.bar_code as barCode,t.name as typeName,m.name as modelName,p.create_time as createAt from product as p " +
            "left join product_type as t on p.type_code=t.code " +
            "left join product_model as m on p.model_code=m.code " +
            "where p.bar_code=#{barCode} "+
            "</script>")
    ProductWebHelperDao findProductWebHelperForPrint(@Param("barCode") String barCode);
}
