package com.archermind.hdc.mapper;

import com.archermind.hdc.entity.Production;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.mapstruct.Mapper;

import java.util.Collection;

/**
 * <p>
 * 产品产量表 Mapper 接口
 * </p>
 *
 * @author zwh
 * @since 2024-03-13
 */
@Mapper
public interface ProductionMapper extends BaseMapper<Production> {

    Integer insertBatchSomeColumn(Collection<Production> entityList);


}
