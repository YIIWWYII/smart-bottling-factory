package com.archermind.hdc.controller;

import com.alibaba.fastjson.JSONObject;
import com.archermind.hdc.anno.NoSwagger;
import com.archermind.hdc.api.result.Result;
import com.archermind.hdc.dto.*;
import com.archermind.hdc.entity.ProductStore;
import com.archermind.hdc.service.*;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.github.xiaoymin.knife4j.annotations.ApiOperationSupport;
import com.github.xiaoymin.knife4j.annotations.ApiSupport;
import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import org.eclipse.paho.client.mqttv3.MqttException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.util.ObjectUtils;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Api(tags = "后台管理模块")
@ApiSupport(author = "张伟浩 weihao.zhang@archermind.com", order = 6)
@RestController
@RequestMapping("/web")
public class WebController {

    @Autowired
    AdapterPlcService adapterPlcService;

    @Autowired
    ProductStoreService productStoreService;
    @Autowired
    ProductService productService;

    @Autowired
    DeviceService deviceService;
    @Autowired
    private GroupService groupService;

    @ApiOperationSupport(order = 1)
    @ApiOperation(value = "PLC灯状态列表", notes = "用于web端获取当前PLC展示状态")
    @PostMapping("lamps")
    public Result<WebLampsResponse> lamps(@RequestBody BaseRequest4GroupIdDto request/*,
                                          @ApiParam(required = true,value = "设备唯一标识") @RequestParam String deviceSn*/) {
        WebLampsResponse tmp = new WebLampsResponse();
        List<Integer> lamps = adapterPlcService.getLamps(request.getGroupId());
        if (lamps == null || lamps.size() == 16){
            tmp.setList(lamps);
        }
        return Result.success(tmp);
    }

    @ApiOperationSupport(order = 2)
    @ApiOperation(value = "控制灯泡开关", notes = "用于web端控制PLC的灯泡")
    @PostMapping("changeLampsState")
    public Result changeLampsState(@RequestBody WebChangeLampsStateRequestDto request) {
        Integer index = request.getIndex();
        Integer action = request.getAction();
        Long groupId = request.getGroupId();
//        String deviceSn = request.getDeviceSn();
        if (ObjectUtils.isEmpty(index)) {
            return Result.message("索引不能为空");
        }
        if (ObjectUtils.isEmpty(action)) {
            return Result.message("动作不能为空");
        }
        if (index > 15 || index < 0) {
            return Result.message("索引取值不正确");
        }
        if (action != 1 && action != 0) {
            return Result.message("动作取值不正确");
        }


        Result<List<DeviceDto>> listResult = groupService.listDevice(groupId);
        List<DeviceDto> deviceDtoList = listResult.getData();
        if (deviceDtoList.isEmpty()) {
            return Result.message("设备未在线，请稍后重试");
        }
        DeviceDto deviceDto = deviceDtoList.stream().filter(item -> item != null && "adapter".equals(item.getType())).findFirst().orElse(null);

        //if (deviceDto == null || !deviceService.deviceIsOnline(deviceDto.getSn())) {
        //    return Result.message("设备未在线，请稍后重试");
        //}

        try {
            List<Integer> lamps = adapterPlcService.getLamps(groupId);
            if (lamps == null || lamps.size() != 16) {
                return Result.message("PLC设备类型不符");
            }
            adapterPlcService.changeLamps(groupId,deviceDto.getSn(),index, action);
        } catch (MqttException mqttException) {
            mqttException.printStackTrace();
            return Result.message("操作失败");
        }
        return Result.success();
    }


    @ApiOperationSupport(order = 3)
    @ApiOperation(value = "配料区产品展示", notes = "用于web端配料区产品展示查询使用")
    @PostMapping("findProducts")
    public Result<IPage<ProductsPageListDto>> findProducts(@RequestBody WebFindProductsRequestDto request) {

        Long groupId = request.getGroupId();
        LocalDateTime startTime = request.getStartTime();
        LocalDateTime endTime = request.getEndTime();
        if (groupId == null) {
            return Result.message("分组id不能为空");
        }
        if ((startTime == null && endTime != null) || (startTime!=null && endTime == null)) {
            return Result.message("startTime、endTime 需要同时有值");
        }

        return productService.pageProducts(request);


    }


    @ApiOperationSupport(order = 4)
    @ApiOperation(value = "条码打印列表", notes = "扫描产品完成后显示的打印列表")
    @NoSwagger
    @PostMapping("printBar")
    public Result<PageResponse<BarListDto>> printBarsList(@RequestBody PageRequest request) {
        // todo
        Integer page = request.getPage();
        Integer size = request.getSize();
        if (ObjectUtils.isEmpty(page)) {
            return Result.message("page不能为空");
        }
        if (ObjectUtils.isEmpty(size)) {
            size = 20;
        }
        return Result.success(productStoreService.findProdStorePrintByPage(page, size));
    }

//    @ApiOperationSupport(order = 5)
//    @ApiOperation(value = "库房区扫描列表", notes = "库房区扫描列表")
//    @PostMapping("barlist")
//    public Result<PageResponse<BarListDto>> barsList(@RequestBody PageRequest request) {
//        Integer page = request.getPage();
//        Integer size = request.getSize();
//        if (ObjectUtils.isEmpty(page)) {
//            return Result.message("page不能为空");
//        }
//        if (ObjectUtils.isEmpty(size)) {
//            size = 20;
//        }
//        return Result.success(productStoreService.pageProductStore(page, size));
//    }

    @ApiOperationSupport(order = 6)
    @ApiOperation(value = "扫描记录分页查询", notes = "库房区扫描分页查询")
    @PostMapping("pageBars")
    public Result<Page<ProductStore>> barsQuery(@RequestBody PageBarQueryRequestDto request) {
        return productStoreService.pageProductStore(request);
    }

    @ApiOperationSupport(order = 7)
    @ApiOperation(value = "查看当前plc设备的控制参数")
    @GetMapping("plcStatus")
    public Result getPlcMap(){
        Map<String, List<Integer>> lampsMapByGroup = adapterPlcService.getLampsMapByGroup();
        Map<String, List<Integer>> switchesByGroup = adapterPlcService.getSwitchesByGroup();
        Map<String, MqttHelper.PlcInfo> infoMapByGroup = adapterPlcService.getInfoMapByGroup();
        JSONObject jo = new JSONObject();
        jo.put("lampsMapByGroup", lampsMapByGroup);
        jo.put("switchesByGroup", switchesByGroup);
        jo.put("infoMapByGroup", infoMapByGroup);
        return Result.success(jo);
    }

}
