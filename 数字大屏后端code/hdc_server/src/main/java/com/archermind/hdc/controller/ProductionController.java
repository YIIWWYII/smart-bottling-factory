package com.archermind.hdc.controller;


import com.alibaba.fastjson.JSONObject;
import com.archermind.hdc.api.result.Result;
import com.archermind.hdc.dto.ProductionDto;
import com.archermind.hdc.service.ProductStoreService;
import com.archermind.hdc.service.ProductionService;
import com.github.xiaoymin.knife4j.annotations.ApiOperationSupport;
import com.github.xiaoymin.knife4j.annotations.ApiSupport;
import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * <p>
 * 产品产量表 前端控制器
 * </p>
 *
 * @author zwh
 * @since 2024-03-13
 */
@Api(tags = "产量管理模块")
@ApiSupport(author = "张伟浩 weihao.zhang@archermind.com", order = 7)
@RestController
@RequestMapping("/production")
public class ProductionController {

    @Autowired
    private ProductionService productionService;


    @ApiOperationSupport(order = 1)
    @ApiOperation(value = "生产计划：批量创建")
    @PostMapping("/batchCreate")
    public Result batchCreate(@RequestBody List<ProductionDto> dtoList){
        return productionService.batchCreate(dtoList);
    }


    @ApiOperationSupport(order = 2)
    @ApiOperation(value = "修改生产计划")
    @PostMapping("/edit")
    public Result edit(@RequestBody ProductionDto dto){
        return productionService.edit(dto);
    }

}
