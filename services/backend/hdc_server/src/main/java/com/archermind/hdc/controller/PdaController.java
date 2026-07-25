package com.archermind.hdc.controller;

import com.archermind.hdc.api.result.Result;
import com.archermind.hdc.dto.*;
import com.archermind.hdc.service.AdapterPlcService;
import com.archermind.hdc.service.DeviceService;
import com.archermind.hdc.service.ProductStoreService;
import com.archermind.hdc.util.DateUtil;
import com.github.xiaoymin.knife4j.annotations.ApiOperationSupport;
import com.github.xiaoymin.knife4j.annotations.ApiSupport;
import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.util.ObjectUtils;
import org.springframework.web.bind.annotation.*;

import java.util.Date;
import java.util.List;

import static com.archermind.hdc.api.result.ResultEnum.MSG_ERROR;

@Api(tags = "PDA模块")
@ApiSupport(author = "张伟浩 weihao.zhang@archermind.com", order = 5)
@RestController
@RequestMapping("pda")
public class PdaController {

    @Autowired
    ProductStoreService productStoreService;
    @Autowired
    AdapterPlcService adapterPlcService;

    @Autowired
    DeviceService deviceService;

    @ApiOperationSupport(order = 1)
    @ApiOperation(value = "条码检查", notes = "扫描产品时检查条码是否存在，存在时返回时间，否则提示不存在")
    @PostMapping("checkBar")
    public Result<BarCheckResponseDto> checkBarValid(@RequestBody BarCheckRequestDto request) {
        String barCode = request.getBarCode();
        String sn = request.getSn();
        if (ObjectUtils.isEmpty(barCode)) {
            return Result.message("产品条码不能为空");
        }
        if (ObjectUtils.isEmpty(sn)) {
            return Result.message("设备唯一标识 不能为空");
        }
        Result result = productStoreService.hasTheProduct(sn, barCode);
        if (result.getCode() == MSG_ERROR.getCode()) {
            return result;
        }

        BarCheckResponseDto responseDto = new BarCheckResponseDto();
        responseDto.setBarCode(barCode);
        responseDto.setDate(DateUtil.formatSSDate(new Date()));
        return Result.success(responseDto);
    }

    @ApiOperationSupport(order = 2)
    @ApiOperation(value = "条码扫描入库", notes = "扫描产品提交入库")
    @PostMapping("saveBar")
    public Result<BarSaveResponseDto> saveBars(@RequestBody BarSaveRequestDto request) {
        String sn = request.getSn();
        Integer action=request.getAction();
        List<BarSaveDto> barCodes = request.getBarCodes();
        if (ObjectUtils.isEmpty(barCodes)) {
            return Result.message("条码列表不能为空");
        }
        if (ObjectUtils.isEmpty(sn)) {
            return Result.message("设备唯一标识 不能为空");
        }
        //if (!deviceService.deviceIsOnline(sn)) {
        //    return Result.message("设备未在线，请稍后重试");
        //}
        if (ObjectUtils.isEmpty(action)) {
            return Result.message("action不能为空");
        }
        if(action!=0&&action!=1){
            return Result.message("非法 action");
        }

        for (BarSaveDto dto : barCodes) {
            String barCode = dto.getBarCode();
            if (ObjectUtils.isEmpty(barCode)) {
                return Result.message("条码不能为空");
            }
            Result result = productStoreService.hasTheProduct(sn, barCode);
            if (!result.isSuccess()) {
                return result;
            }
        }
        return productStoreService.barSave(sn,request);
//        try {
//            adapterPlcService.simulationPrintPda(action);
//        } catch (MqttException mqttException) {
//            XLog.error(mqttException);
//            return Result.message("打印失败");
//        }

    }


}
