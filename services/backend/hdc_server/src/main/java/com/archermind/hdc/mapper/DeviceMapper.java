package com.archermind.hdc.mapper;


import com.archermind.hdc.entity.Device;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.*;
import org.mapstruct.Mapper;

import java.util.Date;
import java.util.List;

/**
 * <p>
 * 设备 Mapper 接口
 * </p>
 *
 * @author zwh
 * @since 2024-03-01
 */
@Mapper
public interface DeviceMapper extends BaseMapper<Device> {

    /**
     * 根据设备编号获取设备信息
     *
     * @param sn 设备编号
     * @return 设备信息
     */
    @Select("select * from device where sn = #{sn} and delete_flag = false")
    Device findDeviceBySn(String sn);

//    @Select("select * from device order by create_time desc")
//    List<Device> findAllDevice();

    @Insert("insert into device (sn)values(#{sn})")
    int createDevice(@Param("sn") String sn);

    @Delete("delete from device where sn=#{sn}")
    int deleteDevice(@Param("sn") String sn);


    @Update("<script> " +
            "update device set " +
            "<trim suffixOverrides=',' >" +
            "<if test='type!=null'> type =#{type} ,</if> " +
            "<if test='lastOnlineAt!=null'> last_online_time =#{lastOnlineAt} ,</if> " +
            "<if test='state!=-1'> state =#{state} ,</if> " +
            "</trim> " +
            "where sn=#{sn}" +
            "</script>")
    int changeDevice(@Param("type") String type, @Param("lastOnlineAt") Date lastOnlineAt, @Param("state") int state, @Param("sn") String sn);

    @Select("select * from device where type=#{type}  and delete_flag = false order by create_time desc")
    List<Device> findDeviceByType(String type);
}
