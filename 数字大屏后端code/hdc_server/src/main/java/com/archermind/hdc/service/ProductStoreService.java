package com.archermind.hdc.service;

import com.alibaba.fastjson.JSONObject;
import com.archermind.hdc.api.result.Result;
import com.archermind.hdc.entity.Group;
import com.archermind.hdc.entity.Product;
import com.archermind.hdc.dto.*;
import com.archermind.hdc.entity.ProductStore;
import com.archermind.hdc.entity.Production;
import com.archermind.hdc.log.XLog;
import com.archermind.hdc.mapper.*;
import com.archermind.hdc.util.DataUtil;
import com.baomidou.mybatisplus.core.conditions.Wrapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.eclipse.paho.client.mqttv3.MqttException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import springfox.documentation.schema.Maps;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.YearMonth;
import java.util.*;
import java.util.stream.Collectors;

import static com.archermind.hdc.api.result.ResultEnum.MSG_ERROR;

@Service
public class ProductStoreService {

    @Autowired
    ProductStoreMapper productStoreMapper;

    @Autowired
    ProductMapper productMapper;
    @Autowired
    private DeviceService deviceService;

    @Autowired
    private ProductionMapper productionMapper;

    @Autowired
    private DataScreenService dataScreenService;

    @Autowired
    private GroupMapper groupMapper;

    @Autowired
    AdapterPlcService adapterPlcService;


    public Result hasTheProduct(String deviceSn, String barCode){
        Result<GroupDto> groupDtoResult = deviceService.inWhichGroup(deviceSn);
        if (groupDtoResult.getCode() == MSG_ERROR.getCode()) {
            return groupDtoResult;
        }
        Long groupId = groupDtoResult.getData().getId();
        Product productDao=productMapper.checkByBarCode(groupId,barCode);
        if (productDao == null) {
            return Result.message("产品条码：" + barCode + "不存在或非本展会商品条码");
        }
        return Result.success();
    }

    public Result barSave(String deviceSn, BarSaveRequestDto barSaveRequestDto){

        Result<GroupDto> groupDtoResult = deviceService.inWhichGroup(deviceSn);
        if (groupDtoResult.getCode() == MSG_ERROR.getCode()) {
            return groupDtoResult;
        }
        Long groupId = groupDtoResult.getData().getId();

        int seq = productStoreMapper.selectCount(groupId) == 0 ? 1 : productStoreMapper.selectMaxSeq(groupId) + 1;
        Integer action = barSaveRequestDto.getAction();
        List<BarSaveDto> barSaveDtoList = barSaveRequestDto.getBarCodes();

        List<ProductStore> productStoreList = barSaveDtoList.stream().map(item -> {
            ProductStore productStore = new ProductStore();
            productStore.setGroupId(groupId);
            String barCode = item.getBarCode();
            productStore.setBarCode(barCode);
            productStore.setAction(action);
            productStore.setSeq(seq);
            productStore.setDate(LocalDateTime.now());
            productStore.setDeviceSn(deviceSn);
            return productStore;
        }).collect(Collectors.toList());

        if (productStoreList.isEmpty()) {
            return Result.message("没有有效数据");
        }


        List<String> barCodeList = barSaveDtoList.stream().map(item -> item.getBarCode()).distinct().collect(Collectors.toList());
        QueryWrapper<Product> productQW = new QueryWrapper<>();
        productQW.lambda().in(Product::getBarCode,barCodeList);
        List<Product> productList = productMapper.selectList(productQW);
        try {
            productStoreMapper.insertBatchSomeColumn(productStoreList);

            if (action == 1){
                // 更新数据大屏的当月完成量,只处理入库数据
                Map<String, List<ProductStore>> barCode_store_map = productStoreList.stream().collect(Collectors.groupingBy(ProductStore::getBarCode));
                productList.forEach(product ->{
                    QueryWrapper<Production> pqw = new QueryWrapper<>();
                    pqw.lambda().eq(Production::getGroupId, product.getGroupId())
                            .eq(Production::getProductType,product.getTypeCode())
                            .eq(Production::getProductModel,product.getModelCode())
                            .eq(Production::getDate, YearMonth.now().toString());
                    Production production = productionMapper.selectOne(pqw);

                    int size = barCode_store_map.get(product.getBarCode()).size();
                    if (production !=null){
                        production.setActualProduction(production.getActualProduction()+ size);
                        productionMapper.updateById(production);
                    }
                });
                // 向数据大屏发送消息
                dataScreenService.pushProductData2Screen(groupId);
            }

            // 向数字孪生发送消息
            try {
                adapterPlcService.simulationPrintPda(groupId,action);
            } catch (MqttException mqttException) {
                XLog.error(mqttException);
                return Result.message("打印失败");
            }
            return Result.success();
        } catch (Exception e){
            XLog.error(e.getMessage());
            return Result.message("保存失败");
        }

    }



    public PageResponse<BarListDto> findProdStorePrintByPage(int page, int size) {
        PageResponse<BarListDto> response = new PageResponse<BarListDto>();
        List<BarListDto> foo = new ArrayList<BarListDto>();
        response.setList(foo);
//        int total = productStoreMapper.findAllProductsPrintCount();
//        response.setTotal(total);
//        if (total == 0) {
//            return response;
//        }
//        int index = page * size;
//        List<BarListDto> list = productStoreMapper.findProductStorePrint(index, size);
//        for (BarListDto barListDto : list) {
//            BarListDto dto = new BarListDto();
//            dto.setBarCode(barListDto.getBarCode());
//            dto.setAction(barListDto.getAction());
//            dto.setDate(barListDto.getDate());
//            dto.setProductType(barListDto.getProductType());
//            dto.setProductModel(barListDto.getProductModel());
//            foo.add(dto);
//        }
        return response;
    }

    public PageResponse<BarListDto> pageProductStore(int page, int size) {
        PageResponse<BarListDto> response = new PageResponse<BarListDto>();
        List<BarListDto> foo = new ArrayList<BarListDto>();
        response.setList(foo);
//        int total = productStoreMapper.findAllProductsCount();
//        response.setTotal(total);
//        if (total == 0) {
//            return response;
//        }
//        int index = page * size;
//        List<BarListDto> list = productStoreMapper.findProductStore(index, size);
//        for (BarListDto barListDto : list) {
//            BarListDto dto = new BarListDto();
//            dto.setBarCode(barListDto.getBarCode());
//            dto.setAction(barListDto.getAction());
//            dto.setDate(barListDto.getDate());
//            dto.setProductType(barListDto.getProductType());
//            dto.setProductModel(barListDto.getProductModel());
//            foo.add(dto);
//        }
        return response;
    }

    public Result<Page<ProductStore>> pageProductStore(PageBarQueryRequestDto request) {
        Integer currentPage = request.getCurrentPage();
        Integer pageSize = request.getPageSize();
        Long groupId = request.getGroupId();
        String barCode = request.getBarCode();
        LocalDate date = request.getDate();
        String productCode = request.getProductCode();


        Page<ProductStore> page = new Page<>(currentPage, pageSize);

        QueryWrapper<ProductStore> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("ps.group_id", groupId);
        if (StringUtils.hasText(productCode)) {
            queryWrapper.eq("pt.code", productCode);
        }
        if (date != null) {
            queryWrapper.eq("DATE(ps.date)", date );
        }
        if (StringUtils.hasText(barCode)) {
            queryWrapper.eq("ps.bar_code", barCode);
        }
        queryWrapper.orderBy(true,false,"ps.create_time");
        page = productStoreMapper.findProductPage(page,queryWrapper);
        return Result.success(page);
    }


    public JSONObject getProductStoreInfo4Today(Long groupId) {
        QueryWrapper<ProductStore> queryWrapper = new QueryWrapper<>();
        queryWrapper.eq("ps.group_id",groupId)
                .ge("ps.date",LocalDateTime.of(LocalDate.now(), LocalTime.MIN));
        List<ProductStore> storeList = productStoreMapper.findProductList(queryWrapper);
        // 入库
        List<ProductStore> inStoreList = storeList.stream().filter(store -> store.getAction() == 1).collect(Collectors.toList());

        Map<String, Long> typeCountMap_in = inStoreList.stream()
                .collect(Collectors.groupingBy(item -> item.getProduct().getModelCode(), Collectors.counting()));
        Map<String, Object> typeRateMap_in = typeCountMap_in.entrySet().stream()
                .collect(Collectors.toMap(Map.Entry::getKey, entry -> String.format("%.2f", ((double) entry.getValue() / (long) inStoreList.size()) * 100)));


        JSONObject inJo = new JSONObject();
        inJo.put("total",inStoreList.size());
        inJo.put("rate",new JSONObject(typeRateMap_in));

        //出库
        List<ProductStore> outStoreList = storeList.stream().filter(store -> store.getAction() == 0).collect(Collectors.toList());
        Map<String, Long> typeCountMap_out = outStoreList.stream()
                .collect(Collectors.groupingBy(item -> item.getProduct().getModelCode(), Collectors.counting()));
        Map<String, Object> typeRateMap_out = typeCountMap_out.entrySet().stream()
                .collect(Collectors.toMap(Map.Entry::getKey, entry -> String.format("%.2f", ((double) entry.getValue() / (long) inStoreList.size()) * 100)));

        JSONObject outJo = new JSONObject();
        outJo.put("total",inStoreList.size());
        outJo.put("rate",new JSONObject(typeRateMap_out));

        JSONObject today = new JSONObject();
        today.put("in",inJo);
        today.put("out",outJo);

        return today;
    }

    public Result generateTestData(ProductStoreGenerateDto dto) {
        LocalDate localDate = null;
        LocalTime localTime = LocalTime.of(0,0,0);
        Long groupId = dto.getGroupId();
        String date = dto.getDate();

        Group group = groupMapper.selectById(groupId);
        if (group == null) {
            return Result.message("展会不存在");
        }

        if (StringUtils.hasText(date)){
            try {
                localDate = LocalDate.parse(date);
            } catch (Exception e) {
                e.printStackTrace();
                return Result.message("日期格式不正确");
            }
        }
        LocalDateTime localDateTime = LocalDateTime.of(localDate,localTime);

        int seq = productStoreMapper.selectCount(groupId) == 0 ? 1 : productStoreMapper.selectMaxSeq(groupId) + 1;
        // 默认“入库”
        int action = 1;
        // 获取4个产品的barcode
        HashMap<String, Integer> modelCountMap = new HashMap<>();
        modelCountMap.put("X50", countIsAvailable(dto.getCount_X50())? dto.getCount_X50():200);
        modelCountMap.put("X50-PRO", countIsAvailable(dto.getCount_X50PRO())? dto.getCount_X50PRO():150);
        modelCountMap.put("X60", countIsAvailable(dto.getCount_X60())? dto.getCount_X60():100);
        modelCountMap.put("X60-PRO", countIsAvailable(dto.getCount_X60PRO())? dto.getCount_X60PRO():50);
        
        List<String> modelList = Arrays.asList("X50", "X50-PRO", "X60", "X60-PRO");
        List<ProductStore> storeList = new ArrayList<ProductStore>();

        modelList.forEach(model -> {
            List<Product> productList = productMapper.listByGroupIdAndModel(groupId,model);
            if (!productList.isEmpty()){
                //使用已有产品创建入库记录
                Product product = productList.get(0);
                createStores(model, modelCountMap, groupId, product, action, seq, storeList, localDateTime);
            } else {
                // 没有产品，新建一个
                String product_type = "T9527";
                int currentTotal = productMapper.findCountByTypeCode(product_type);
                currentTotal++;
                String barCode = product_type + DataUtil.buLing4(currentTotal);
                Product product = new Product();
                product.setGroupId(groupId);
                product.setTypeCode(product_type);
                product.setModelCode(model);
                product.setBarCode(barCode);
                product.setPath(null);
                product.setDeviceSn(null);
                productMapper.insert(product);

                createStores(model, modelCountMap, groupId, product, action, seq, storeList, localDateTime);
            }
        });
        try {
            productStoreMapper.insertBatchSomeColumn(storeList);
            return Result.success();
        } catch (Exception e) {
            e.printStackTrace();
            return Result.message("入库测试数据插入失败");
        }
    }

    private static void createStores(String model, HashMap<String, Integer> modelCountMap, Long groupId,
                                     Product product, int action, int seq, List<ProductStore> storeList, LocalDateTime localDateTime) {
        Integer count = modelCountMap.get(model);
        while (count > 0){
            ProductStore productStore = new ProductStore();
            productStore.setGroupId(groupId);
            productStore.setBarCode(product.getBarCode());
            productStore.setAction(action);
            productStore.setSeq(seq);
            productStore.setDate(localDateTime);
            productStore.setDeviceSn(null);
            storeList.add(productStore);
            count--;
        }
    }

    private boolean countIsAvailable(Integer count) {
        return count != null && count >= 0 && count < Integer.MAX_VALUE;
    }
}
