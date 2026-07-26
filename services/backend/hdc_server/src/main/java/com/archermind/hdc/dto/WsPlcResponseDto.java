package com.archermind.hdc.dto;

import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

@Data
public class WsPlcResponseDto<T> {

    @ApiModelProperty(value = "1:正确返回；-1:有错误")
    private String code;
    private String msg;
    @ApiModelProperty(value = "控制类型。lamp 或者 switch 或 info")
    private String type;
    private T data;

    public enum Type {
        LAMP, SWITCH, INFO
    }

    public enum Code {
        SUCCESS("1"),
        ERROR("-1");

        public String code;

        private Code(String code){
            this.code = code;
        }
    }
}
