package com.archermind.hdc.service;

import cn.hutool.core.bean.BeanUtil;
import com.archermind.hdc.api.result.Result;
import com.archermind.hdc.dto.MachineFailureDto;
import com.archermind.hdc.entity.MachineFailure;
import com.archermind.hdc.mapper.MachineFailureMapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * <p>
 * 设备故障表 服务实现类
 * </p>
 *
 * @author zwh
 * @since 2024-03-13
 */
@Service
public class MachineFailureService {

    @Autowired
    private MachineFailureMapper machineFailureMapper;


    public Result batchCreate(List<MachineFailureDto> machineFailureDtos) {
        List<MachineFailure> failureList = machineFailureDtos.stream().map(dto -> {
            MachineFailure failure = new MachineFailure();
            BeanUtil.copyProperties(dto, failure);
            failure.setMachineType("MG400");
            LocalTime failureTime = null;
            LocalTime recoverTime = null;
            if (dto.getFailureTimeStr() != null) {
                try {
                    failureTime = LocalTime.parse(dto.getFailureTimeStr());
                } catch (Exception e) {
                    return null;
                }
            }
            if (dto.getFailureRecoverTimeStr() != null) {
                try {
                    recoverTime = LocalTime.parse(dto.getFailureRecoverTimeStr());
                } catch (Exception e) {
                    return null;
                }
            }
            failure.setFailureTime(failureTime);
            failure.setFailureRecoverTime(recoverTime);
            return failure;
        }).collect(Collectors.toList());

        if (failureList.contains(null)){
            return Result.message("部分设备故障时间或恢复时间格式不正确");
        }

        try {
            machineFailureMapper.insertBatchSomeColumn(failureList);
            return Result.success();
        } catch (Exception e) {
            e.printStackTrace();
            return Result.message("保存失败");
        }
    }

    public List<MachineFailureDto> listByGroupId(Long groupId) {
        QueryWrapper<MachineFailure> queryWrapper = new QueryWrapper<>();
        queryWrapper.lambda()
                .eq(MachineFailure::getGroupId,groupId)
                .isNotNull(MachineFailure::getFailureTime)
                .lt(MachineFailure::getFailureTime,LocalTime.now())
                .orderBy(true,false, MachineFailure::getFailureTime);
        List<MachineFailure> machineFailureList = machineFailureMapper.selectList(queryWrapper);
        List<MachineFailureDto> list = machineFailureList.stream().map(failure -> {
            MachineFailureDto failureDto = new MachineFailureDto();
            failureDto.setGroupId(failure.getGroupId());
            failureDto.setMachineName(failure.getMachineName());
            failureDto.setFailureName(failure.getFailureName());
            failureDto.setFailureLevel(failure.getFailureLevel());
            failureDto.setFailureTimeStr(failure.getFailureTime().toString());
            failureDto.setMachineType(failure.getMachineType());
            LocalTime failureRecoverTime = failure.getFailureRecoverTime();
            if (failureRecoverTime == null) {
                failureDto.setFailureRecoverTimeStr("待处理");
            } else {
                if (failureRecoverTime.isAfter(LocalTime.now())) {
                    failureDto.setFailureRecoverTimeStr("待处理");
                } else {
                    failureDto.setFailureRecoverTimeStr(failureRecoverTime.toString());
                }
            }
            return failureDto;
        }).collect(Collectors.toList());
        return list;
    }


    public Map<String, List<MachineFailureDto>> mapByEquipmentName(Long groupId){
        List<MachineFailureDto> list = listByGroupId(groupId);
        return list.stream().collect(Collectors.groupingBy(MachineFailureDto::getMachineType));
    }

    public Result delete(Long id) {
        machineFailureMapper.deleteById(id);
        return Result.success();
    }
}
