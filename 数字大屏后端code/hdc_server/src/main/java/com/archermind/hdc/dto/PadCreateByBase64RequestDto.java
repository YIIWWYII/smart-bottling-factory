package com.archermind.hdc.dto;

import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

@Data
public class PadCreateByBase64RequestDto {
    @ApiModelProperty(value = "上传图片的base64字符串")
    private String base64;
    @ApiModelProperty(value = "文件名称，如123.jgp")
    private String fileName;
    @ApiModelProperty(value = "型号code")
    private String modelCode;
    @ApiModelProperty(value = "设备唯一标识")
    private String sn;
}
