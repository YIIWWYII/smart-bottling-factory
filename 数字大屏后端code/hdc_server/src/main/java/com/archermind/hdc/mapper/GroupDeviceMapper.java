package com.archermind.hdc.mapper;


import com.archermind.hdc.entity.GroupDevice;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Update;
import org.mapstruct.Mapper;

import java.util.Collection;
import java.util.List;

/**
 * <p>
 * 分组-设备 Mapper 接口
 * </p>
 *
 * @author zwh
 * @since 2024-03-01
 */
@Mapper
public interface GroupDeviceMapper extends BaseMapper<GroupDevice> {

    //查询该设备所在当前有效的组
    public GroupDevice selectWithDetails(@Param("deviceSn") String deviceSn);

    public List<GroupDevice> listWithDetails(@Param("ew") QueryWrapper<GroupDevice> ew);

    Integer insertBatchSomeColumn(Collection<GroupDevice> entityList);
}
