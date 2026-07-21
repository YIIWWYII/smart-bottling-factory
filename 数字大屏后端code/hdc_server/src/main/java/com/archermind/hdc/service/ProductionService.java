package com.archermind.hdc.service;

import cn.hutool.core.bean.BeanUtil;
import com.alibaba.fastjson.JSONObject;
import com.archermind.hdc.api.result.Result;
import com.archermind.hdc.dto.ProductionDto;
import com.archermind.hdc.entity.Production;
import com.archermind.hdc.mapper.ProductionMapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.Month;
import java.time.Year;
import java.time.YearMonth;
import java.util.*;
import java.util.stream.Collectors;

/**
 * <p>
 * 产品产量表 服务实现类
 * </p>
 *
 * @author zwh
 * @since 2024-03-13
 */
@Service
public class ProductionService {

    @Autowired
    ProductionMapper productionMapper;

    public Result batchCreate(List<ProductionDto> productionDtoList) {
        List<Production> productionList = BeanUtil.copyToList(productionDtoList, Production.class);
        productionList.stream().forEach(item -> item.setId(null));
        try {
            productionMapper.insertBatchSomeColumn(productionList);
        } catch (Exception e) {
            e.printStackTrace();
            return Result.message("保存失败,数据库中已有相同数据：type/model/date");
        }

        return Result.success();
    }

    public Result edit(ProductionDto dto) {
        Production production = BeanUtil.copyProperties(dto, Production.class);
        int i = productionMapper.updateById(production);
        return Result.success();
    }

    public Result delete(Production production) {
        int i = productionMapper.deleteById(production.getId());
        return Result.success();
    }

    public Map<String, JSONObject> productionByYear(Long groupId) {
        Year thisYear = Year.now();
        QueryWrapper<Production> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("production.group_id", groupId).eq("left(production.date,4)", thisYear.toString());
        List<Production> list = productionMapper.selectList(queryWrapper);
        JSONObject mapByMonth = mapByMonth(list);
        JSONObject mapByTypeAndModel = mapByTypeAndModel(list);


        HashMap<String, JSONObject> map = new HashMap<>();
        map.put("productionByMonth", mapByMonth);
        map.put("productionByTypeAndModel", mapByTypeAndModel);
        return map;
    }

    //根据月份查询计划产量和实际产量
    private JSONObject mapByMonth(List<Production> list) {
        Map<String, List<Production>> mapByMonth = list.stream().collect(Collectors.groupingBy(item -> {
            String date = item.getDate();
            return date.substring(date.indexOf("-")+1);
        }));
        JSONObject result = new JSONObject();
        Set<Map.Entry<String, List<Production>>> entries = mapByMonth.entrySet();
        entries.stream().forEach(entry -> {
            List<Production> value = entry.getValue();
            int planned = value.stream().mapToInt(Production::getPlannedProduction).sum();
            int actual = value.stream().mapToInt(Production::getActualProduction).sum();
            JSONObject jo4Month = new JSONObject();
            jo4Month.put("planned", planned);
            jo4Month.put("actual", actual);
            result.put(entry.getKey(), jo4Month);
        });

        return result;
    }

    // 根据产品类型和型号查询计划产量和实际产量
    public JSONObject mapByTypeAndModel(List<Production> list) {
        Map<String, List<Production>> mapByType = list.stream().collect(Collectors.groupingBy(Production::getProductType));
        JSONObject joByTypeKey = new JSONObject();
        mapByType.forEach((typeName, listByType) -> {
            Map<String, List<Production>> mapByModel = listByType.stream().collect(Collectors.groupingBy(Production::getProductModel));
            JSONObject joByModelKey = new JSONObject();
            mapByModel.forEach((modelName, listByModel) -> {
                int planned = listByModel.stream().mapToInt(Production::getPlannedProduction).sum();
                int actual = listByModel.stream().mapToInt(Production::getActualProduction).sum();
                JSONObject jo4Model = new JSONObject();
                jo4Model.put("planned", planned);
                jo4Model.put("actual", actual);
                jo4Model.put("rate", actual * 100 / planned);
                joByModelKey.put(modelName, jo4Model);
            });
            joByTypeKey.put(typeName, joByModelKey);
        });
        return joByTypeKey;
    }


}
