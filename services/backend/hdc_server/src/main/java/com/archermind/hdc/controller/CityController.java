package com.archermind.hdc.controller;

import com.archermind.hdc.api.result.Result;
import com.archermind.hdc.entity.City;
import com.archermind.hdc.service.CityService;
import com.github.xiaoymin.knife4j.annotations.ApiOperationSupport;
import com.github.xiaoymin.knife4j.annotations.ApiSupport;
import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Api(tags = "城市管理")
@ApiSupport(author = "张伟浩 weihao.zhang@archermind.com", order = 1)
@RestController
@RequestMapping("/city")
public class CityController {

    @Autowired
    private CityService cityService;

//    @ApiOperationSupport(order = 1)
//    @ApiOperation(value = "分页查询")
//    @GetMapping("/page")
//    public Result<IPage<City>> pageCity(Integer currentPage, Integer pageSize, City city) {
//        currentPage = currentPage == null? 1 : currentPage;
//        pageSize = pageSize == null? 10 : pageSize;
//        return Result.success(cityMapper.pageCity(currentPage, pageSize, city));
//    }

    @ApiOperationSupport(order = 2)
    @ApiOperation(value = "新建城市")
    @PostMapping("/create")
    public Result create(@RequestBody City city){
        return cityService.createCity(city);
    }

//    @ApiOperationSupport(order = 3)
//    @ApiOperation(value = "批量新建城市")
//    @PostMapping("/batchCreate")
//    public Result batchCreate(@RequestBody List<City> cityList){
//        return cityService.batchCreateCity(cityList);
//    }


    @ApiOperationSupport(order = 4)
    @ApiOperation(value = "修改可用状态和排序")
    @PostMapping("/changeUseFlag")
    public Result changeUseFlag(@RequestBody City city){
        return cityService.editCity(city);
    }

//    @ApiOperationSupport(order = 4)
//    @ApiOperation(value = "删除城市")
//    @PostMapping("/deleteCity")
//    public Result deleteCity(@RequestBody City city){
//        return cityService.deleteCity(city);
//    }

    @ApiOperationSupport(order = 5)
    @ApiOperation(value = "list查询城市")
    @GetMapping("/listCity")
    public Result<List<City>> listCity(){
        return cityService.listCity();
    }
}
