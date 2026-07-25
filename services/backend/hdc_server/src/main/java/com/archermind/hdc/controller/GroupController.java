package com.archermind.hdc.controller;

import com.archermind.hdc.anno.NoSwagger;
import com.archermind.hdc.api.result.Result;
import com.archermind.hdc.dto.DeviceDto;
import com.archermind.hdc.dto.DeviceGroupDto;
import com.archermind.hdc.dto.GroupDto;
import com.archermind.hdc.dto.DeviceJoinGroupBatchDto;
import com.archermind.hdc.service.GroupService;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.github.xiaoymin.knife4j.annotations.ApiOperationSupport;
import com.github.xiaoymin.knife4j.annotations.ApiSupport;
import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import io.swagger.annotations.ApiParam;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.List;

@Api(tags = "分组管理")
@ApiSupport(author = "张伟浩 weihao.zhang@archermind.com", order = 2)
@RestController
@RequestMapping("/group")
@Validated
public class GroupController {

    @Autowired
    private GroupService groupService;

    @ApiOperationSupport(order = 1)
    @ApiOperation(value = "分页查询")
    @GetMapping("/page")
    public Result<IPage<GroupDto>> pageGroup(Integer currentPage, Integer pageSize, GroupDto groupDto) {
        currentPage = currentPage == null ? 1 : currentPage;
        pageSize = pageSize == null? 10 : pageSize;
        return groupService.pageGroup(currentPage, pageSize, groupDto);
    }

    @ApiOperationSupport(order = 2)
    @ApiOperation(value = "新建分组（展会）")
    @PostMapping("/create")
    public Result create(@Valid @RequestBody GroupDto groupDto){
        if (groupDto.getName() == null || groupDto.getCityId() == null || groupDto.getBeginTime() == null
                || groupDto.getEndTime() == null){
            return Result.message("缺少必须信息，请补充后再试");
        }
        return groupService.create(groupDto);
    }

    @ApiOperationSupport(order = 3)
    @ApiOperation(value = "编辑分组")
    @PostMapping("/edit")
    @NoSwagger
    public Result edit(@RequestBody GroupDto groupDto){
        return groupService.edit(groupDto);
    }

    @ApiOperationSupport(order = 4)
    @ApiOperation(value = "删除分组")
    @PostMapping("/deleteGroup")
    public Result deleteGroup(@RequestBody GroupDto groupDto){
        return groupService.delete(groupDto);
    }

    @ApiOperationSupport(order = 5)
    @ApiOperation(value = "设备批量分组",notes = "若时间冲突会操作失败")
    @PostMapping("/batchGrouping")
    public Result batchGrouping(@RequestBody DeviceJoinGroupBatchDto joinDto){
        return groupService.batchGrouping(joinDto);
    }



    @ApiOperationSupport(order = 6)
    @ApiOperation(value = "list查询组内设备")
    @GetMapping("/listDevice")
    public Result<List<DeviceDto>> listDevice(Long groupId){
        return groupService.listDevice(groupId);
    }

    @ApiOperationSupport(order = 7)
    @ApiOperation(value = "从分组中移除设备")
    @PostMapping("/removeDeviceFromGroup")
    public Result removeDeviceFromGroup(DeviceGroupDto dto){
        return groupService.removeDeviceFromGroup(dto);
    }

     @ApiOperationSupport(order = 8)
    @ApiOperation(value = "根据城市id查询分组（展会）列表")
    @GetMapping("/listGroup")
    public Result<List<GroupDto>> listGroup(@RequestParam @ApiParam("城市id") Long cityId){
        return groupService.listGroup(cityId);
    }


}
