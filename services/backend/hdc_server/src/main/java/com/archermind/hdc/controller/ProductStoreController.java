package com.archermind.hdc.controller;

import com.archermind.hdc.anno.NoSwagger;
import com.archermind.hdc.api.result.Result;
import com.archermind.hdc.dto.ProductStoreGenerateDto;
import com.archermind.hdc.service.ProductStoreService;
import com.fasterxml.jackson.annotation.JsonFormat;
import com.github.xiaoymin.knife4j.annotations.ApiOperationSupport;
import com.github.xiaoymin.knife4j.annotations.ApiSupport;
import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import io.swagger.annotations.ApiParam;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;


@Api(tags = "产品出入库管理")
@ApiSupport(author = "张伟浩 weihao.zhang@archermind.com", order = 9)
@RestController
@RequestMapping("/productStore")
public class ProductStoreController {

    @Autowired
    private ProductStoreService productStoreService;

    @ApiOperationSupport(order = 1)
    @ApiOperation(value = "生成测试数据", notes ="该方法用于生成指定分组、指定数量、指定日期的入库数据，产品型号为X50、X50-PRO、X60、X60-PRO")
    @PostMapping("/generateTest")
    public Result generateTestData4ProductStore(ProductStoreGenerateDto dto){
        return productStoreService.generateTestData(dto);
    }
}
