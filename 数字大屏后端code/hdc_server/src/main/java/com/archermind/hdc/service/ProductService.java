package com.archermind.hdc.service;

import cn.hutool.core.bean.BeanUtil;
import com.archermind.hdc.api.result.Result;
import com.archermind.hdc.entity.*;
import com.archermind.hdc.dto.*;
import com.archermind.hdc.log.XLog;
import com.archermind.hdc.mapper.*;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.eclipse.paho.client.mqttv3.MqttException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
public class ProductService {
    @Autowired
    ProductTypeMapper productTypeMapper;
    @Autowired
    ProductModelMapper productModelMapper;
    @Autowired
    ProductMapper productMapper;
    @Autowired
    GroupDeviceMapper groupDeviceMapper;
    @Autowired
    private DeviceService deviceService;

    @Autowired
    AdapterPlcService adapterPlcService;

    @Value("${file.url}")
    String url;

    public PadFindProductTypeResponseDto findAllProductTypes() {
        PadFindProductTypeResponseDto tmp = new PadFindProductTypeResponseDto();
        List<ProductType> list = productTypeMapper.findAllProductTypes();
        List<ProductTypeDto> foo = BeanUtil.copyToList(list, ProductTypeDto.class);
        tmp.setList(foo);
        return tmp;
    }

    public PadFindProductModelsResponseDto findProductModels(String typeCode) {
        PadFindProductModelsResponseDto tmp = new PadFindProductModelsResponseDto();
        List<ProductModel> list = productModelMapper.findProductModelsByTypeCode(typeCode);
        List<ProductModelDto> foo = BeanUtil.copyToList(list, ProductModelDto.class);
        tmp.setList(foo);
        return tmp;
    }

    public Result createProduct(String deviceSn, String barCode, String typeCode, String modelCode, String path) {
        Result<GroupDto> groupDtoResult = deviceService.inWhichGroup(deviceSn);
        if (!groupDtoResult.isSuccess()) {
            return groupDtoResult;
        }
        Long groupId = groupDtoResult.getData().getId();
        Product product = new Product();
        product.setGroupId(groupId);
        product.setDeviceSn(deviceSn);
        product.setBarCode(barCode);
        product.setTypeCode(typeCode);
        product.setModelCode(modelCode);
        product.setPath(path);
        int i = productMapper.insert(product);
        if (i == 1) {
            try {
                adapterPlcService.simulationPrintPad(groupId,barCode);
            } catch (MqttException mqttException) {
                XLog.error(mqttException);
            }
            return Result.success();
        } else {
            return Result.message("创建失败");
        }
    }

    public boolean updateProduct(String barCode, String typeCode, String modelCode, String path) {
//        return productMapper.updateProduct(barCode, typeCode, modelCode, path) > 0;
        return true;
    }


    public ProductModel checkProductModel(String modelCode) {
        return productModelMapper.findProductModelByCode(modelCode);
    }

    public ProductType checkProductType(String typeCode) {
        return productTypeMapper.findProductTypeByCode(typeCode);
    }

    public int currentTypeTotal(String typeCode) {
        return productMapper.findCountByTypeCode(typeCode);
    }

    public Result findProductsByPage(String deviceSn,int currentPage, int pageSize) {

        Result<GroupDto> groupDtoResult = deviceService.inWhichGroup(deviceSn);
        if (!groupDtoResult.isSuccess()) {
            return groupDtoResult;
        }
//        GroupDevice groupDevice = groupDeviceMapper.selectWithDetails(deviceSn);
        Page<Product> page = new Page<>(currentPage, pageSize);
        QueryWrapper<Product> queryWrapper = new QueryWrapper<>();
        queryWrapper.lambda().eq(Product::getGroupId,groupDtoResult.getData().getId());
        page = productMapper.pageByCondition(page, queryWrapper);

        IPage<ProductsPageListDto> convert = page.convert(product -> {
            ProductsPageListDto dto = new ProductsPageListDto();
            dto.setModelName(product.getModel().getName());
            dto.setBarCode(product.getBarCode());
            dto.setTypeName(product.getType().getName());
            dto.setImage(url + product.getPath());
            return dto;
        });
        return Result.success(convert);
    }

    public Result<IPage<ProductsPageListDto>> pageProducts(WebFindProductsRequestDto request) {
        Page<Product> page = new Page<>(request.getCurrentPage(), request.getPageSize());
        Long groupId = request.getGroupId();
        String barCode = request.getBarCode();
        String typeCode = request.getTypeCode();
        LocalDateTime startTime = request.getStartTime();
        LocalDateTime endTime = request.getEndTime();

        QueryWrapper<Product> queryWrapper = new QueryWrapper<>();
        queryWrapper.lambda().eq(Product::getGroupId,groupId);
        if (StringUtils.hasText(barCode)){
            queryWrapper.like("p.bar_code",barCode);
        }
        if (StringUtils.hasText(typeCode)){
            queryWrapper.eq("p.type_code",typeCode);
        }
        if (startTime!= null && endTime!= null){
            queryWrapper.between("p.create_time",startTime,endTime);
        }
        queryWrapper.lambda().orderBy(true,false,Product::getCreateTime);
        Page<Product> productPage = productMapper.pageByCondition(page, queryWrapper);
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
        IPage<ProductsPageListDto> convert = productPage.convert(product -> {
            ProductsPageListDto dto = new ProductsPageListDto();
            dto.setModelName(product.getModel().getName());
            dto.setBarCode(product.getBarCode());
            dto.setTypeName(product.getType().getName());
            dto.setImage(url + product.getPath());
            dto.setCreateAt(product.getCreateTime().format(formatter));
            return dto;
        });

        return Result.success(convert);
    }


}
