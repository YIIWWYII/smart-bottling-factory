package com.archermind.hdc.mapper;


import com.archermind.hdc.dto.BarListDto;
import com.archermind.hdc.entity.ProductStore;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.mapstruct.Mapper;

import java.util.Collection;
import java.util.List;

/**
 * <p>
 * 产品出入库 Mapper 接口
 * </p>
 *
 * @author zwh
 * @since 2024-03-01
 */
@Mapper
public interface ProductStoreMapper extends BaseMapper<ProductStore> {

    @Select("select count(*) from product_store where group_id = #{groupId}")
    int selectCount(@Param("groupId") Long groupId);

    @Select("select max(seq) from product_store where group_id = #{groupId}")
    int selectMaxSeq(@Param("groupId") Long groupId);

    Page<ProductStore> findProductPage(Page<ProductStore> page,@Param("ew") QueryWrapper<ProductStore> queryWrapper);

    Integer insertBatchSomeColumn(Collection<ProductStore> entityList);

    List<ProductStore> findProductList(@Param("ew") QueryWrapper<ProductStore> queryWrapper);

    ProductStore selectByBarCode(@Param("barCode") String barCode);

    @Select("<script> " +
            "select b.bar_code as barCode,b.action as action,b.date as date,t.name as productType,m.name as productModel from product_store as b " +
            "left join product as p on b.bar_code=p.bar_code " +
            "left join product_type as t on p.type_code=t.code " +
            "left join product_model as m on p.model_code=m.code " +
            "where b.seq = (select max(seq) from product_store)" +
            "order by p.create_time desc " +
            "</script>")
    List<BarListDto> findProductStorePrintNoPage();
}
