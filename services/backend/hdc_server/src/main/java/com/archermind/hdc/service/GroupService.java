package com.archermind.hdc.service;

import cn.hutool.core.bean.BeanUtil;
import com.archermind.hdc.api.result.Result;
import com.archermind.hdc.dto.*;
import com.archermind.hdc.entity.City;
import com.archermind.hdc.entity.Group;
import com.archermind.hdc.entity.GroupDevice;
import com.archermind.hdc.entity.GroupVisitor;
import com.archermind.hdc.log.XLog;
import com.archermind.hdc.mapper.CityMapper;
import com.archermind.hdc.mapper.GroupDeviceMapper;
import com.archermind.hdc.mapper.GroupMapper;
import com.archermind.hdc.mapper.GroupVisitorMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class GroupService {

    @Autowired
    private GroupMapper groupMapper;

    @Autowired
    private GroupDeviceMapper groupDeviceMapper;

    @Autowired
    private GroupVisitorMapper groupVisitorMapper;

    @Autowired
    private CityMapper cityMapper;

    @Autowired
    private DataScreenService dataScreenService;

    /**
     * 查询未到结束时间的组
     * @return
     */
    public Result<List<GroupDto>> listGroupWhichOngoing(){
        QueryWrapper<Group> queryWrapper = new QueryWrapper<>();
        LocalDateTime now = LocalDateTime.now();
        queryWrapper.lambda().eq(Group::getUseFlag,true).lt(Group::getBeginTime,now).gt(Group::getEndTime, now);
        List<Group> list = groupMapper.selectList(queryWrapper);
        List<GroupDto> dtoList = BeanUtil.copyToList(list, GroupDto.class);
        return Result.success(dtoList);
    }

    public Result create(GroupDto groupDto) {
        groupDto.setId(null);
        if (groupDto.getUseFlag()== null){
            groupDto.setUseFlag(true);
        }
        Group group = new Group();
        BeanUtil.copyProperties(groupDto, group);

        if (group.getMachineBaseTime() == null){
            group.setMachineBaseTime(group.getBeginTime());
        }
        if (group.getCityName() == null){
            City city = cityMapper.selectById(group.getCityId());
            group.setCityName(city.getName());
        }
        int i = groupMapper.insert(group);
        if (i == 1){
            return Result.success();
        } else {
            return Result.message("分组创建失败");
        }
    }

    public Result edit(GroupDto groupDto) {

        Group existOne = groupMapper.selectById(groupDto.getId());

        if (existOne == null){
            return Result.message("分组不存在");
        }
        if (groupDto.getBeginTime().isBefore(existOne.getBeginTime()) || groupDto.getEndTime().isAfter(existOne.getEndTime())){
            // todo 时间有变化，需判断是否和其他分组重合
        }


        Group group = BeanUtil.copyProperties(groupDto, Group.class);

        int i = groupMapper.updateById(group);
        if (i == 1){
            return Result.success();
        } else {
            return Result.message("分组更新失败");
        }
    }

    public Result delete(GroupDto groupDto) {
        int i = groupMapper.deleteById(groupDto.getId());
        if (i == 1){
            return Result.success();
        } else {
            return Result.message("分组删除失败");
        }
    }

    public Result<IPage<GroupDto>> pageGroup(Integer currentPage, Integer pageSize, GroupDto groupDto) {
        Page<Group> page = new Page<>(currentPage,pageSize);
        QueryWrapper<Group> queryWrapper = new QueryWrapper<>();
        if (groupDto.getName() != null){
            queryWrapper.lambda().like(Group::getName,groupDto.getName());
        }
        queryWrapper.lambda().orderBy(true,false,Group::getBeginTime);
        page = groupMapper.selectPage(page, queryWrapper);

        IPage<GroupDto> resultPage = page.convert(e -> {
            GroupDto dto = new GroupDto();
            BeanUtil.copyProperties(e, dto);
            return dto;
        });
        return Result.success(resultPage);
    }

    public Result batchGrouping(DeviceJoinGroupBatchDto joinDto) {
        List<String> snList = joinDto.getSnList();
        Long groupId = joinDto.getGroupId();
        Group group = groupMapper.selectById(groupId);

        if (LocalDateTime.now().isAfter(group.getEndTime())) {
            return Result.message("当前展会已结束，无法添加设备");
        }

        QueryWrapper<GroupDevice> deviceQueryWrapper = new QueryWrapper<>();
        deviceQueryWrapper.in("gd.device_sn", snList).eq("g.use_flag", true);

        List<GroupDevice> groupDeviceList = groupDeviceMapper.listWithDetails(deviceQueryWrapper);
        DateTimeFormatter dtf = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
        List<GroupDevice> collect = groupDeviceList.stream().filter(item -> {
            GroupDto groupInfo = item.getGroupInfo();
            LocalDateTime start = groupInfo.getBeginTime();
            LocalDateTime end = groupInfo.getEndTime();
            if (isBetween(start, group.getBeginTime(), group.getEndTime()) || isBetween(end, group.getBeginTime(), group.getEndTime())) {
                return true;
            } else {
                return false;
            }
        }).collect(Collectors.toList());
        if (!collect.isEmpty()) {
            StringBuilder builder = new StringBuilder();
            builder.append("设备批量入组失败。原因：以下设备在其他组内，并且时间有重复。");
            collect.forEach(item -> builder.append(System.lineSeparator()).append("sn: ").append(item.getDeviceSn()).append(",所在分组： ").append(item.getGroupInfo().getName()));
            return Result.message(builder.toString());
        }
        List<GroupDevice> newList = snList.stream().map(sn -> {
            GroupDevice gd = new GroupDevice();
            gd.setGroupId(groupId);
            gd.setDeviceSn(sn);
            gd.setDeleteFlag(0);
            return gd;
        }).collect(Collectors.toList());
        try {
            groupDeviceMapper.insertBatchSomeColumn(newList);
        } catch (Exception e) {
            XLog.error(e.getMessage());
            return Result.message("部分设备已在分组中，请重新选择设备");
        }
        return Result.success();
    }




    public static boolean isBetween(LocalDateTime time, LocalDateTime intervalBegin, LocalDateTime intervalEnd) {
        boolean flag = false;
        if (time.isAfter(intervalBegin) && time.isBefore(intervalEnd)) {
            flag = true;
        }
        return flag;
    }


    public Result<List<DeviceDto>> listDevice(Long groupId) {
        QueryWrapper<GroupDevice> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("gd.group_id",groupId)
                .eq("gd.delete_flag",false)
                .eq("g.delete_flag",false)
                .eq("g.use_flag",true)
                .eq("d.delete_flag",false);

        List<GroupDevice> groupDeviceList = groupDeviceMapper.listWithDetails(queryWrapper);
        List<DeviceDto> deviceDtoList = groupDeviceList.stream().map(GroupDevice::getDeviceInfo).collect(Collectors.toList());
        return Result.success(deviceDtoList);
    }


    public Result<List<GroupDto>> listGroup(Long cityId) {
        LambdaQueryWrapper<Group> lambda = new QueryWrapper<Group>().lambda();
        LocalDateTime now = LocalDateTime.now();
        lambda.eq(Group::getCityId,cityId)
                .eq(Group::getUseFlag,true)
                .lt(Group::getBeginTime, now)
                .gt(Group::getEndTime, now);

        List<Group> groupList = groupMapper.selectList(lambda);
        List<GroupDto> dtoList = BeanUtil.copyToList(groupList, GroupDto.class);
        return Result.success(dtoList);
    }

    public Result numPlus(PadVisitorPlusRequestDto requestDto) {
        String sn = requestDto.getSn();
        String type = requestDto.getType();
        Integer count = requestDto.getCount();
        count = count == null || count == 0 ? 1 : count;
        if (!"visitor".equalsIgnoreCase(type) && !"employee".equalsIgnoreCase(type)) {
            return Result.message("非法人员，禁止入内");
        }
        GroupDevice groupDevice = groupDeviceMapper.selectWithDetails(sn);
        if (groupDevice == null || groupDevice.getGroupId() == null) {
            return Result.message("设备未加入分组");
        }
        Long groupId = groupDevice.getGroupId();

        GroupVisitor gv = new GroupVisitor();
        gv.setType(type);
        gv.setCount(count);

        gv.setDeviceSn(sn);
        gv.setGroupId(groupId);
        groupVisitorMapper.insert(gv);

        if ("visitor".equalsIgnoreCase(type)) {
            groupMapper.updateVisitorNumber(groupId,count);
        } else {
            groupMapper.updateEmployeeNumber(groupId,count);
        }
        // 同步数据大屏
        dataScreenService.pushVisitorData2Screen(groupId);
        return Result.success();
    }


    public Result removeDeviceFromGroup(DeviceGroupDto dto) {
        // todo
        QueryWrapper<GroupDevice> queryWrapper = new QueryWrapper<>();
        queryWrapper.lambda().eq(GroupDevice::getDeviceSn,dto.getSn()).eq(GroupDevice::getGroupId,dto.getGroupId());
        int i = groupDeviceMapper.delete(queryWrapper);
        if (i == 1) {
            return Result.success();
        } else {
            return Result.message("当前分组内未查询到该设备");
        }
    }
}

