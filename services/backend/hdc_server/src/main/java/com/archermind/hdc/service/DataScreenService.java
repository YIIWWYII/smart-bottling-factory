package com.archermind.hdc.service;


import com.alibaba.fastjson.JSONObject;
import com.archermind.hdc.dto.DataScreenResponseDto;
import com.archermind.hdc.dto.MachineFailureDto;
import com.archermind.hdc.dto.MachineRuntimeDto;
import com.archermind.hdc.entity.Group;
import com.archermind.hdc.entity.GroupVisitor;
import com.archermind.hdc.mapper.GroupMapper;
import com.archermind.hdc.mapper.GroupVisitorMapper;
import com.archermind.hdc.service.ws.DataScreenWebSocketService;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class DataScreenService {



    private Map<Long,LocalDateTime> defaultBeginTimeMap = new HashMap<Long,LocalDateTime>();

    // 外层key为groupId，内层key有两个，一个runTime（运行时长），一个waitTime（待机时长）
    private Map<Long, MachineRuntimeDto> runTimeMap = new HashMap<>();
    private Map<Long, JSONObject> runTimeJOMap = new HashMap<>();


    @Autowired
    private GroupVisitorMapper groupVisitorMapper;

    @Autowired
    private MachineFailureService machineFailureService;

    @Autowired
    private AdapterPlcService adapterPlcService;

    @Autowired
    private GroupMapper groupMapper;

    @Autowired
    private ProductStoreService productStoreService;

    @Autowired
    private ProductionService productionService;


    // 发送全部数据到数据大屏
    public void pushAllData2Screen(Long groupId){

        Group group = groupMapper.selectById(groupId);
        if (group == null){
            DataScreenWebSocketService.sentMessageByGroupId(groupId,"展会分组不存在，请断开后重试");
            return;
        }

        //访客数据
        pushVisitorData2Screen(groupId);

        // 设备数据
        pushMachineData2Screen(groupId);

        // 产品数据
        pushProductData2Screen(groupId);

    }

    public void pushVisitorData2Screen(Long groupId){
        DataScreenWebSocketService.sentMessageByGroupId(groupId,getVisitorDateStr(groupId));
    }

    public void pushMachineData2Screen(Long groupId){
        DataScreenWebSocketService.sentMessageByGroupId(groupId, getMachineDateStr(groupId));
    }

    public void pushProductData2Screen(Long groupId){
        DataScreenWebSocketService.sentMessageByGroupId(groupId,getProductDateStr(groupId));
    }

    private String getProductDateStr(Long groupId) {
        // 今日出入库
        JSONObject store4Today = productStoreService.getProductStoreInfo4Today(groupId);
        // 年度产量总览
        Map<String, JSONObject> productionInfoMap = productionService.productionByYear(groupId);

        JSONObject result = new JSONObject();
        result.put("store4Today", store4Today); //今日出入库
        result.put("productionByMonth", productionInfoMap.get("productionByMonth"));//年度产量总览
        result.put("productionByTypeAndModel", productionInfoMap.get("productionByTypeAndModel")); //产品产量统计

        JSONObject in = store4Today.getJSONObject("in");


        Integer inTotal = in.getInteger("total");

        JSONObject qualityPassRateJO = new JSONObject();
        qualityPassRateJO.put("countPass", inTotal);
        qualityPassRateJO.put("countTotal", inTotal+5);
        qualityPassRateJO.put("rate",inTotal * 100 / (inTotal + 5));

        result.put("qualityPassRate", qualityPassRateJO); //质检通过率

        JSONObject materialCompletionRateJO = new JSONObject();
        materialCompletionRateJO.put("m1","1233");
        materialCompletionRateJO.put("m2","232");
        materialCompletionRateJO.put("m3","320");
        materialCompletionRateJO.put("m4","248");
        materialCompletionRateJO.put("rate","29.3");
        result.put("materialCompletionRate", materialCompletionRateJO); // 物料齐套率

        DataScreenResponseDto responseDto = new DataScreenResponseDto();
        responseDto.setGroupId(groupId);
        responseDto.setType(DataScreenResponseDto.Type.PRODUCT.name().toLowerCase());
        responseDto.setData(result);

        return JSONObject.toJSONString(responseDto);
    }

    private String getMachineDateStr(Long groupId) {
        // 设备故障
        Map<String, List<MachineFailureDto>> failureMap = machineFailureService.mapByEquipmentName(groupId);
        // 4台机床的运行状态
        List<Integer> switches = adapterPlcService.getSwitches(groupId);
        // 1号机床的运行时长
        Integer state_1 = switches.get(0);

        LocalDateTime defaultBeginTime = defaultBeginTimeMap.get(groupId);
        if (defaultBeginTime == null){
            Group group = groupMapper.selectById(groupId);
            defaultBeginTime = group.getMachineBaseTime() == null ? group.getBeginTime() : group.getMachineBaseTime();
            defaultBeginTimeMap.put(groupId,defaultBeginTime);
        }
        MachineRuntimeDto runtimeDto = runTimeMap.get(groupId);
        if (runtimeDto == null){
            runtimeDto = new MachineRuntimeDto();
            runTimeMap.put(groupId,runtimeDto);
        }
        int lastState = runtimeDto.getLastState();
        LocalDateTime lastStateTime = runtimeDto.getLastStateTime();
        LocalDateTime now = LocalDateTime.now();
        if (lastState == 0) {
            // 待机中
            if (lastStateTime == null){
                Duration waitDuration = Duration.between(defaultBeginTime,now);
                runtimeDto.setWaitTime(waitDuration);
            } else {
                Duration waitTimeExist = runtimeDto.getWaitTime();
                runtimeDto.setWaitTime(waitTimeExist.plus(Duration.between(lastStateTime,now)));
            }
        } else {
            //运行中
            Duration runtimeExist = runtimeDto.getRuntime();
            Duration duration = Duration.between(lastStateTime,now);
            if (runtimeExist == null){
                runtimeDto.setRuntime(duration);
            } else {
                runtimeDto.setRuntime(runtimeExist.plus(duration));
            }
        }
        runtimeDto.setLastState(state_1);
        runtimeDto.setLastStateTime(now);

        JSONObject runtimeJO = runTimeJOMap.get(groupId);
        if (runtimeJO == null){
            runtimeJO = new JSONObject();
            runTimeJOMap.put(groupId,runtimeJO);
        }
        runtimeJO.put("runTime", runtimeDto.getRuntimeStr());
        runtimeJO.put("waitTime", runtimeDto.getWaitTimeStr());
        runtimeJO.put("operator",runtimeDto.getOperator());
        runtimeJO.put("efficiency", runtimeDto.getEfficiency());
        runtimeJO.put("qualityRate",runtimeDto.getQualityRate());

        JSONObject root = new JSONObject();
        root.put("failureMap",failureMap);
        root.put("switches",switches);
        root.put("machineInfo",runtimeJO);

        DataScreenResponseDto responseDto = new DataScreenResponseDto();
        responseDto.setGroupId(groupId);
        responseDto.setType(DataScreenResponseDto.Type.EQUIPMENT.name().toLowerCase());
        responseDto.setData(root);

        return JSONObject.toJSONString(responseDto);
    }


    private String getVisitorDateStr(Long groupId){
        QueryWrapper<GroupVisitor> queryWrapper = new QueryWrapper<>();
        queryWrapper.lambda().eq(GroupVisitor::getGroupId,groupId);
        List<GroupVisitor> list = groupVisitorMapper.selectList(queryWrapper);
        // 今天的数据
        List<GroupVisitor> todayList = list.stream().filter(item -> item.getCreateTime().toLocalDate().equals(LocalDateTime.now().toLocalDate())).collect(Collectors.toList());
        long todayVisitorCount = todayList.stream().filter(item -> "visitor".equalsIgnoreCase(item.getType())).mapToInt(GroupVisitor::getCount).reduce(0,Integer::sum);
        long todayEmployeeCount = todayList.stream().filter(item -> "employee".equalsIgnoreCase(item.getType())).mapToInt(GroupVisitor::getCount).reduce(0,Integer::sum);
        JSONObject today = new JSONObject();
        today.put("visitor",todayVisitorCount);
        today.put("employee",todayEmployeeCount);
        //今年的数据
        List<GroupVisitor> theYearList = list.stream().filter(item -> item.getCreateTime().getYear()==LocalDateTime.now().getYear()).collect(Collectors.toList());
        long theYearVisitorCount = theYearList.stream().filter(item -> "visitor".equalsIgnoreCase(item.getType())).mapToInt(GroupVisitor::getCount).reduce(0,Integer::sum);
        long theYearEmployeeCount = theYearList.stream().filter(item -> "employee".equalsIgnoreCase(item.getType())).mapToInt(GroupVisitor::getCount).reduce(0,Integer::sum);
        JSONObject thisYear = new JSONObject();
        thisYear.put("visitor",theYearVisitorCount);
        thisYear.put("employee",theYearEmployeeCount);
        //最近3小时
        long count4Last3Hours = list.stream().filter(item -> item.getCreateTime().isAfter(LocalDateTime.now().minusHours(3))).mapToInt(GroupVisitor::getCount).reduce(0,Integer::sum);
        DataScreenResponseDto visitorDto = new DataScreenResponseDto();
        visitorDto.setGroupId(groupId);
        visitorDto.setType(DataScreenResponseDto.Type.VISITOR.name().toLowerCase());
        JSONObject root = new JSONObject();
        root.put("today",today);
        root.put("thisYear",thisYear);
        root.put("last3Hours",count4Last3Hours);
        visitorDto.setData(root);

        return JSONObject.toJSONString(visitorDto);
    }

}
