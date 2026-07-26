package com.archermind.hdc.controller;

import com.archermind.hdc.anno.NoSwagger;
import com.archermind.hdc.api.result.Result;
import com.archermind.hdc.dto.*;
import com.archermind.hdc.service.AdapterPlcService;
import com.archermind.hdc.service.DeviceService;
import com.github.xiaoymin.knife4j.annotations.ApiOperationSupport;
import com.github.xiaoymin.knife4j.annotations.ApiSupport;
import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import io.swagger.annotations.ApiParam;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.util.ObjectUtils;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;
import java.util.List;

@Api(tags = "设备管理")
@ApiSupport(author = "张伟浩 weihao.zhang@archermind.com", order = 3)
@RestController
@RequestMapping("/device")
public class DeviceController {

    @Autowired
    DeviceService deviceService;
    @Autowired
    AdapterPlcService adapterPlcService;

    @ApiOperationSupport(order = 1)
    @ApiOperation(value = "设备列表", notes = "供维护设备使用")
    @PostMapping("findAllDevices")
    public Result<HelperFindAllDevicesResponseDto> findAllDevices() {
        return Result.success(deviceService.findAllDevices());
    }

    @ApiOperationSupport(order = 2)
    @ApiOperation(value = "设备创建", notes = "供维护设备使用")
    @PostMapping("createDevice")
    public Result createDevice(@RequestBody DeviceCreateRequestDto request) {
        String sn = request.getSn();
        if (ObjectUtils.isEmpty(sn)) {
            return Result.message("设备标识不能为空");
        }
        if (deviceService.createDevice(sn, request.getType(),0, null)) {
            return Result.success();
        } else {
            return Result.message("设备已存在，请勿重复添加");
        }
    }


    private List<String> safeStates = Arrays.asList("adapter", "pda", "pad");

    @ApiOperationSupport(order = 3)
    @ApiOperation(value = "设备编辑", notes = "供维护设备使用")
    @PostMapping("changeDevice")
    public Result changeDevice(@RequestBody HelperChangeDeviceRequestDto request) {
        String sn = request.getSn();
        String type = request.getType();
        if (ObjectUtils.isEmpty(sn)) {
            return Result.message("设备标识不能为空");
        }
        if (!safeStates.contains(type)) {
            return Result.message("请输入正确的类型");
        }
        if (deviceService.changeDevice(sn, type)) {
            return Result.success();
        } else {
            return Result.message("设备不存在");
        }
    }

    @ApiOperationSupport(order = 4)
    @ApiOperation(value = "设备删除", notes = "供维护设备使用-不可恢复")
    @NoSwagger
    @PostMapping("deleteDevice")
    public Result deleteDevice(@RequestBody HelperDeleteDeviceRequestDto request) {
        String sn = request.getSn();
        if (ObjectUtils.isEmpty(sn)) {
            return Result.message("设备标识不能为空");
        }
        if (deviceService.deleteDevice(sn)) {
            return Result.success();
        } else {
            return Result.message("设备不存在");
        }
    }

    @ApiOperationSupport(order = 5)
    @ApiOperation(value = "PLC状态", notes = "供设备调试查看使用")
    @GetMapping("plc")
    public Result<HelperPlcResponseDto> plc(@ApiParam(required = true,value = "分组id") @RequestParam Long groupId) {
        HelperPlcResponseDto responseDto = new HelperPlcResponseDto();
        responseDto.setLamps(adapterPlcService.getLamps(groupId));
        responseDto.setSwitches(adapterPlcService.getSwitches(groupId));
        return Result.success(responseDto);
    }

    @ApiOperationSupport(order = 6)
    @ApiOperation(value = "设备所在分组",notes = "设备管理内使用")
    @GetMapping("/whichGroup")
    public Result<GroupDto> whichGroup(String deviceSn){
        return deviceService.inWhichGroup(deviceSn);
    }

    @ApiOperationSupport(order = 7)
    @ApiOperation(value = "（设备）加入分组",notes = "设备管理和终端使用，若时间冲突会从旧分组中退出并加入新分组")
    @PostMapping("/joinGroup")
    public Result joinGroup(@RequestBody DeviceJoinGroupDto joinDto){
        return deviceService.addDevice2Group(joinDto);
    }
    @ApiOperationSupport(order = 8)
    @ApiOperation(value = "（设备）退出分组",notes = "设备管理使用")
    @PostMapping("/quitGroup")
    public Result quitGroup(@RequestBody DeviceJoinGroupDto joinDto){
        return deviceService.quitGroup(joinDto);
    }

}
