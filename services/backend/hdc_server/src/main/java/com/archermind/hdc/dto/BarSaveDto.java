package com.archermind.hdc.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class BarSaveDto {
    @ApiModelProperty(value = "条形码",required = true)
    String barCode;

    @ApiModelProperty(value = "扫描时间", notes = "保存时无需上传，使用服务器时间")
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    LocalDateTime date;
}
