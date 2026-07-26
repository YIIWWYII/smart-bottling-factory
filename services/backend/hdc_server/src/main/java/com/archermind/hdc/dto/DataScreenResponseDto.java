package com.archermind.hdc.dto;

import com.alibaba.fastjson.JSONObject;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

@Data
public class DataScreenResponseDto {

    @ApiModelProperty(value = "分组id")
    private Long groupId;
    @ApiModelProperty(value = "数据类型。visitor：访客； equipment：设备；product：产品")
    private String type;
    @ApiModelProperty(value = "数据")
    private JSONObject data;


//    private  data;



    public enum Type {
        VISITOR, EQUIPMENT, PRODUCT
    }

}
