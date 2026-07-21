package com.archermind.hdc.mapper;


import com.archermind.hdc.entity.Group;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Update;
import org.mapstruct.Mapper;

/**
 * <p>
 * 分组 Mapper 接口
 * </p>
 *
 * @author zwh
 * @since 2024-03-01
 */
@Mapper
public interface GroupMapper extends BaseMapper<Group> {

    @Update("update `group` set num_visitor = num_visitor + #{num} where id = #{groupId}")
    public int updateVisitorNumber(@Param("groupId") Long groupId, @Param("num") Integer num);


    @Update("update `group` set num_employee = num_employee + #{num} where id = #{groupId}")
    public int updateEmployeeNumber(@Param("groupId") Long groupId, @Param("num") Integer num);
}
