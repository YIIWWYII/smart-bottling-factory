package com.archermind.hdc.controller;

import cn.hutool.core.codec.Base64Decoder;
import com.archermind.hdc.api.result.Result;
import com.archermind.hdc.entity.ProductModel;
import com.archermind.hdc.entity.ProductType;
import com.archermind.hdc.dto.*;
import com.archermind.hdc.log.XLog;
import com.archermind.hdc.service.AdapterPlcService;
import com.archermind.hdc.service.DeviceService;
import com.archermind.hdc.service.GroupService;
import com.archermind.hdc.service.ProductService;
import com.archermind.hdc.util.DataUtil;
import com.archermind.hdc.util.UUID;
import com.github.xiaoymin.knife4j.annotations.ApiOperationSupport;
import com.github.xiaoymin.knife4j.annotations.ApiSupport;
import io.swagger.annotations.Api;
import io.swagger.annotations.ApiOperation;
import org.eclipse.paho.client.mqttv3.MqttException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.util.ObjectUtils;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;

@Api(tags = "PAD模块")
@ApiSupport(author = "张伟浩 weihao.zhang@archermind.com", order = 4)
@RestController
@RequestMapping("pad")
public class PadController {
    @Value("${file.path}")
    String path;

    @Autowired
    ProductService productService;

    @Autowired
    AdapterPlcService adapterPlcService;

    @Autowired
    DeviceService deviceService;

    @Autowired
    private GroupService groupService;


    @ApiOperationSupport(order = 1)
    @ApiOperation(value = "产品类型", notes = "供PAD端创建产品时获取产品类型使用")
    @PostMapping("findProductTypes")
    public Result<PadFindProductTypeResponseDto> findProductTypes() {
        return Result.success(productService.findAllProductTypes());
    }

    @ApiOperationSupport(order = 2)
    @ApiOperation(value = "产品型号", notes = "供PAD端创建产品时获取产品型号使用")
    @PostMapping("findProductModels")
    public Result<PadFindProductModelsResponseDto> findProductModels(@RequestBody PadFindProductModelsRequestDto request) {
        String productTypeCode = request.getProductTypeCode();
        if (ObjectUtils.isEmpty(productTypeCode)) {
            return Result.message("产品类型的code不能为空");
        }
        return Result.success(productService.findProductModels(productTypeCode));
    }


    @ApiOperationSupport(order = 3)
    @ApiOperation(value = "产品创建", notes = "供PAD端创建产品时使用，表单提交方式，文件参数:multipartFile")
    @PostMapping("createByFile")
    public Result createByFile(@RequestPart MultipartFile multipartFile, @RequestPart String modelCode, @RequestPart String sn) {
        if (ObjectUtils.isEmpty(multipartFile)) {
            return Result.message("文件KEY不能为空");
        }
        if (ObjectUtils.isEmpty(modelCode)) {
            return Result.message("modelCode 不能为空");
        }

        //if (!deviceService.deviceIsOnline(sn)) {
        //    return Result.message("设备未在线，请稍后重试");
        //}

        ProductModel productModel = productService.checkProductModel(modelCode);
        if (ObjectUtils.isEmpty(productModel)) {
            return Result.message("modelCode:" + modelCode + " 对应的型号不存在");
        }
        String originalFilename = multipartFile.getOriginalFilename();
        String suffixContent = "";
        int tmp = originalFilename.lastIndexOf(".");
        if (tmp != -1) {
            suffixContent = originalFilename.substring(tmp, originalFilename.length());
            XLog.info("suffixContent:" + suffixContent);
        }
        StringBuilder newNameBuilder = new StringBuilder();
        newNameBuilder.append(UUID.getUUID());
        if (!ObjectUtils.isEmpty(suffixContent)) {
            newNameBuilder.append(suffixContent);
        }

        File file = new File(path);
        if (!file.exists()) {
            file.mkdirs();
        }
        File newFile = null;
        try {
            newFile = new File(file, newNameBuilder.toString());
            multipartFile.transferTo(newFile);
            XLog.info("文件存储路径：" + newFile.getAbsolutePath());
        } catch (IOException e) {
            e.printStackTrace();
            XLog.error(e);
            return Result.message("文件存储异常");
        }

        ProductType productType = productService.checkProductType(productModel.getTypeCode());
        int currentTotal = productService.currentTypeTotal(productType.getCode());
        currentTotal++;
        String barCode = productType.getBarPrefix() + DataUtil.buLing4(currentTotal);
        return productService.createProduct(sn,barCode, productType.getCode(), modelCode, newFile.getName());
//            try {
//                adapterPlcService.simulationPrintPad(barCode);
//            } catch (MqttException mqttException) {
//                XLog.error(mqttException);
//            }

    }

    @ApiOperationSupport(order = 4)
    @ApiOperation(value = "产品创建", notes = "供PAD端创建产品时使用，base64方式")
    @PostMapping("createByBase64")
    public Result createByBase64(@RequestBody PadCreateByBase64RequestDto request) {
        String base64 = request.getBase64();
        String fileName = request.getFileName();
        String modelCode = request.getModelCode();
        String sn = request.getSn();
        if (ObjectUtils.isEmpty(base64)) {
            return Result.message("图片数据不能为空");
        }
        if (ObjectUtils.isEmpty(fileName)) {
            return Result.message("fileName不能为空");
        }
        if (ObjectUtils.isEmpty(modelCode)) {
            return Result.message("modelCode 不能为空");
        }
        if (ObjectUtils.isEmpty(sn)) {
            return Result.message("sn 不能为空");
        }
        //if (!deviceService.deviceIsOnline(sn)) {
        //    return Result.message("设备未在线，请稍后重试");
        //}

        ProductModel productModel = productService.checkProductModel(modelCode);
        if (ObjectUtils.isEmpty(productModel)) {
            return Result.message("modelCode:" + modelCode + " 对应的型号不存在");
        }
        String originalFilename = fileName;
        String suffixContent = "";
        int tmp = originalFilename.lastIndexOf(".");
        if (tmp != -1) {
            suffixContent = originalFilename.substring(tmp, originalFilename.length());
            XLog.info("suffixContent:" + suffixContent);
        } else {
            return Result.message("请输入正确文件名，如：123.jpg");
        }
        StringBuilder newNameBuilder = new StringBuilder();
        newNameBuilder.append(UUID.getUUID());
        if (!ObjectUtils.isEmpty(suffixContent)) {
            newNameBuilder.append(suffixContent);
        }
        byte[] bytes = Base64Decoder.decode(base64);

        File file = new File(path);
        if (!file.exists()) {
            file.mkdirs();
        }
        File newFile = null;
        try {
            newFile = new File(file, newNameBuilder.toString());
            FileOutputStream fos = new FileOutputStream(newFile);
            fos.write(bytes);
            fos.close();
            XLog.info("文件存储路径：" + newFile.getAbsolutePath());
        } catch (IOException e) {
            e.printStackTrace();
            XLog.error(e);
            return Result.message("文件存储异常");
        }

        ProductType productType = productService.checkProductType(productModel.getTypeCode());
        //todo 有线程安全问题和性能问题
        int currentTotal = productService.currentTypeTotal(productType.getCode());
        currentTotal++;
        String barCode = productType.getBarPrefix() + DataUtil.buLing4(currentTotal);
        return productService.createProduct(sn, barCode, productType.getCode(), modelCode, newFile.getName());
//            try {
//                adapterPlcService.simulationPrintPad(barCode);
//            } catch (MqttException mqttException) {
//                XLog.error(mqttException);
//            }
    }


    @ApiOperationSupport(order = 5)
    @ApiOperation(value = "重新打印标签", notes = "PAD 在查看产品信息时，可以重新发起打标签动作")
//    @NoSwagger
    @PostMapping("print")
    public Result print(@RequestBody PadPrintRequestDto request) {
        return Result.message("当前版本不支持");
//        String barCode = request.getBarCode();
//        if (ObjectUtils.isEmpty(barCode)) {
//            return Result.message("barCode 不能为空");
//        }
//        if (!adapterPlcService.hasTheProduct(barCode)) {
//            return Result.message("barCode 不存在");
//        }
//        if (!deviceService.deviceIsOnline("pad")) {
//            return Result.message("设备未在线，请稍后重试");
//        }
//        try {
//            adapterPlcService.simulationPrintPad(barCode);
//            return Result.success("打印成功");
//        } catch (MqttException mqttException) {
//            XLog.error(mqttException);
//            return Result.message("打印异常");
//        }
    }

    @ApiOperationSupport(order = 6)
    @ApiOperation(value = "产品列表", notes = "供PAD端展示产品列表使用，分页查询")
    @PostMapping("products")
    public Result<PageResponse<ProductsPageListDto>> products(@RequestBody PageRequest request) {
        Integer page = request.getPage();
        Integer size = request.getSize();
        String sn = request.getSn();
        if (ObjectUtils.isEmpty(page)) {
            return Result.message("page不能为空");
        }
        if (ObjectUtils.isEmpty(sn)) {
            return Result.message("设备唯一标识 不能为空");
        }
        if (ObjectUtils.isEmpty(size)) {
            size = 20;
        }
        return productService.findProductsByPage(sn,page, size);
    }

    @ApiOperationSupport(order = 7)
    @ApiOperation(value = "更新参观人数", notes = "供PAD端更新参观人数用，type：visitor、employee")
    @PostMapping("numPlus")
    public Result numPlus(@RequestBody PadVisitorPlusRequestDto request) {
        return groupService.numPlus(request);
    }
}
