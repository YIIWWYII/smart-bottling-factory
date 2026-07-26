package com.archermind.hdc.mapper;

import com.archermind.hdc.entity.MachineFailure;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.mapstruct.Mapper;

import java.util.Collection;

/**
 * <p>
 * 设备故障表 Mapper 接口
 * </p>
 *
 * @author zwh
 * @since 2024-03-13
 */
@Mapper
public interface MachineFailureMapper extends BaseMapper<MachineFailure> {

    Integer insertBatchSomeColumn(Collection<MachineFailure> entityList);
}
