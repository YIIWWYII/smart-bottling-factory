package com.archermind.hdc.service;

import cn.hutool.core.bean.BeanUtil;
import com.archermind.hdc.api.result.Result;
import com.archermind.hdc.dto.*;
import com.archermind.hdc.entity.Device;
import com.archermind.hdc.entity.Group;
import com.archermind.hdc.entity.GroupDevice;
import com.archermind.hdc.mapper.DeviceMapper;
import com.archermind.hdc.mapper.GroupDeviceMapper;
import com.archermind.hdc.mapper.GroupMapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.ObjectUtils;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class DeviceService {

    @Autowired
    DeviceMapper deviceMapper;

    @Autowired
    private GroupMapper groupMapper;

    @Autowired
    private GroupDeviceMapper groupDeviceMapper;

    @Autowired
    private GroupService groupService;

    public HelperFindAllDevicesResponseDto findAllDevices() {
        HelperFindAllDevicesResponseDto result = new HelperFindAllDevicesResponseDto();
        QueryWrapper<Device> queryWrapper = new QueryWrapper<>();
        queryWrapper.lambda().orderBy(true,false,Device::getCreateTime);
        List<Device> deviceList = deviceMapper.selectList(queryWrapper);
        List<HelperDeviceDto> collect = deviceList.stream().map(device -> {
            HelperDeviceDto deviceDto = BeanUtil.copyProperties(device, HelperDeviceDto.class);
            return deviceDto;
        }).collect(Collectors.toList());
        result.setList(collect);
        return result;
    }

    public boolean createDevice(String sn, String type, Integer state, LocalDateTime lastOnlineTime) {
        Device device = deviceMapper.findDeviceBySn(sn);
        if (device == null) {
            device = new Device();
            device.setSn(sn);
            device.setType(type);
            device.setState(state);
            device.setLastOnlineTime(lastOnlineTime);
            deviceMapper.insert(device);
            return true;
        }
        return false;
    }

    public boolean changeDevice(String sn, String type) {
        Device device = deviceMapper.findDeviceBySn(sn);
        if (ObjectUtils.isEmpty(device)) {
            return false;
        }
        device.setType(type);
        deviceMapper.updateById(device);
        return true;
    }

    public boolean deleteDevice(String sn) {
        Device device = deviceMapper.findDeviceBySn(sn);
        if (ObjectUtils.isEmpty(device)) {
            return false;
        }
        deviceMapper.deleteById(device);
        return true;
    }

    public boolean deviceIsOnline(String sn) {
        if (sn == null || sn.isEmpty()){
            return false;
        }
        Device deviceBySn = deviceMapper.findDeviceBySn(sn);
        if(deviceBySn == null || deviceBySn.getState() == 0){
            return false;
        }
        return true;
    }

    public Result addDevice2Group(DeviceJoinGroupDto joinDto) {
        String deviceSn = joinDto.getSn();
        Long groupId = joinDto.getGroupId();

        // todo 增加入组口令校验


        Device deviceBySn = deviceMapper.findDeviceBySn(deviceSn);
        if (deviceBySn == null){
            return Result.message("该sn对应的设备不存在，可后台添加，或发送mqtt上线消息自动添加");
        }

        // 更新设备type
        String type = joinDto.getType();
        if (!StringUtils.hasText(deviceBySn.getType()) && ("pda".equalsIgnoreCase(type) || "pad".equalsIgnoreCase(type))) {
            deviceBySn.setType(type.toLowerCase().trim());
            deviceMapper.updateById(deviceBySn);
        }

        Group group = groupMapper.selectById(groupId);
        LocalDateTime now = LocalDateTime.now();
        if (group == null || group.getBeginTime().isAfter(now) || group.getEndTime().isBefore(now)){
            return Result.message("要加入的展会不存在或已不在有效期，请选择其他展会并加入");
        }

        // 如果是adapter类型，判断该分组中是否已存在相同类型设备
        if ("adapter".equalsIgnoreCase(deviceBySn.getType())){
            List<DeviceDto> deviceListByGroupId = groupService.listDevice(groupId).getData();
            if (!deviceListByGroupId.isEmpty()){
                List<DeviceDto> adapterList = deviceListByGroupId.stream().filter(d -> "adapter".equalsIgnoreCase(d.getType())).collect(Collectors.toList());
                if (!adapterList.isEmpty()){
                    return Result.message("该分组中已存在adapter，请移除后再添加");
                }
            }
        }
        QueryWrapper<GroupDevice> existQueryWrapper = new QueryWrapper<>();
        existQueryWrapper.lambda().eq(GroupDevice::getDeviceSn,deviceSn).eq(GroupDevice::getGroupId,groupId);
        GroupDevice groupDevice = groupDeviceMapper.selectOne(existQueryWrapper);
        if (groupDevice != null){
            return Result.message("设备已在该分组中,无需重复加入");
        }

        //将之前的关联关系删除
        QueryWrapper<GroupDevice> gdQueryWrapper = new QueryWrapper<>();
        gdQueryWrapper.lambda().eq(GroupDevice::getDeviceSn,deviceSn).ne(GroupDevice::getGroupId, groupId);
        groupDeviceMapper.delete(gdQueryWrapper);

        groupDevice = new GroupDevice();
        groupDevice.setGroupId(groupId);
        groupDevice.setDeviceSn(deviceSn);
        int i = groupDeviceMapper.insert(groupDevice);
        if (i == 1){
            return Result.success();
        } else {
            return Result.message("设备添加到分组成功");
        }
    }

    public Result quitGroup(DeviceJoinGroupDto joinDto) {
        String deviceSn = joinDto.getSn();
        QueryWrapper<GroupDevice> queryWrapper = new QueryWrapper<>();
        queryWrapper.lambda().eq(GroupDevice::getDeviceSn,deviceSn).eq(GroupDevice::getGroupId,joinDto.getGroupId());
        int i = groupDeviceMapper.delete(queryWrapper);
        if (i == 1){
            return Result.success();
        } else {
            return Result.message("设备退出分组成功");
        }
    }

    public Result<GroupDto> inWhichGroup(String deviceSn) {


        Device device = deviceMapper.findDeviceBySn(deviceSn);
        if (device == null){
            return Result.message("该设备不存在");
        }
        GroupDevice groupDevice = groupDeviceMapper.selectWithDetails(deviceSn);
        if (groupDevice!= null){
            GroupDto groupDto = BeanUtil.copyProperties(groupDevice.getGroupInfo(), GroupDto.class);
            return Result.success(groupDto);
        }

        return Result.message("该设备未在任何展会分组,或所在展会未在有效期");
    }
}
