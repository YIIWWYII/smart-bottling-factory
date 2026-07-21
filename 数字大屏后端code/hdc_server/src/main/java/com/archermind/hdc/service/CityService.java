package com.archermind.hdc.service;

import com.archermind.hdc.api.result.Result;
import com.archermind.hdc.entity.City;
import com.archermind.hdc.mapper.CityMapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class CityService {

    @Autowired
    private CityMapper cityMapper;

    public Result<List<City>> listCity() {
        QueryWrapper<City> queryWrapper = new QueryWrapper<>();
        queryWrapper.lambda().eq(City::getUseFlag,true).orderBy(true,true,City::getOrders);

        List<City> cityList = cityMapper.selectList(null);
        return Result.success(cityList);
    }

    public Result createCity(City city) {
        city.setId(null);
        int i = cityMapper.insert(city);
        return Result.success();
    }

//    public Result batchCreateCity(List<City> cityList) {
//        boolean b = super.saveBatch(cityList);
//        return Result.success();
//    }

    public Result deleteCity(City city) {
        int i = cityMapper.deleteById(city.getId());
        return Result.success();
    }

    public Result<City> getCity(Long id) {
        City city = cityMapper.selectById(id);
        return Result.success(city);
    }



    public Result editCity(City city) {
        UpdateWrapper<City> updateWrapper = new UpdateWrapper<>();
        updateWrapper.lambda().eq(City::getId,city.getId());
        if (city.getUseFlag() != null){
            updateWrapper.lambda().set(City::getUseFlag,city.getUseFlag());
        }
        if (city.getOrders() != null){
            updateWrapper.lambda().set(City::getOrders,city.getOrders());
        }
        int i = cityMapper.update(updateWrapper);
        return Result.success();
    }
}
