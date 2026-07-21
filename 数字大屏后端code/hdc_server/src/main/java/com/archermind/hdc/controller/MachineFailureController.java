package com.archermind.hdc.controller;


import com.archermind.hdc.api.result.Result;
import com.archermind.hdc.dto.MachineFailureDto;
import com.archermind.hdc.service.MachineFailureService;
import com.github.xiaoymin.knife4j.annotations.ApiOperationSupport;
import com.github.xiaoymin.knife4j.annotations.ApiSupport;
import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * <p>
 * 设备故障表 前端控制器
 * </p>
 *
 * @author zwh
 * @since 2024-03-13
 */


@Api(tags = "设备故障管理")
@ApiSupport(author = "张伟浩 weihao.zhang@archermind.com", order = 8)
@RestController
@RequestMapping("/machineFailure")
public class MachineFailureController {

    @Autowired
    private MachineFailureService machineFailureService;

    @ApiOperationSupport(order = 1)
    @ApiOperation(value = "批量创建产线设备故障")
    @PostMapping("/batchCreate")
    public Result batchCreate(@RequestBody List<MachineFailureDto> machineFailureDtoList){
        return machineFailureService.batchCreate(machineFailureDtoList);
    }

    @ApiOperationSupport(order = 2)
    @ApiOperation(value = "删除产线设备故障")
    @GetMapping("/delete")
    public Result delete(Long id){
        return machineFailureService.delete(id);
    }

}
