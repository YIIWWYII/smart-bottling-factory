package com.archermind.hdc.api.result;

import io.swagger.annotations.ApiModelProperty;
import lombok.Data;
import org.springframework.util.ObjectUtils;


//@ApiModel("统一响应结构体")
@Data
public class Result<T> {

    /**
     * 状态码
     */
    @ApiModelProperty("接口响应状态码，取值-1、0、1、3。-1、0、1：均表示通信成功。-1、1带有 message给客户，-1表示业务处理失败，0和1表示业务处理成功。")
    private int code;

    /**
     * 状态信息
     */
    @ApiModelProperty("接口响应消息")
    private String message;

    /**
     * 具体结果
     */
    @ApiModelProperty("接口响应内容")
    private T data;

    public Result() {
    }

    public Result(int code, String message) {
        this.code = code;
        this.message = message;
    }

    public static Result success() {
        Result result = new Result();
        result.setCode(ResultEnum.SUCCESS.getCode());
        result.setMessage(ResultEnum.SUCCESS.getMessage());
        return result;
    }

    public static <T> Result<T> success(T data) {
        Result<T> result = new Result<T>();
        result.setCode(ResultEnum.SUCCESS.getCode());
        result.setMessage(ResultEnum.SUCCESS.getMessage());
        result.setData(data);
        return result;
    }

    public static Result message(String msg) {
        Result result = new Result();
        result.setCode(ResultEnum.MSG_ERROR.getCode());
        result.setMessage(msg);
        return result;
    }

    public static Result failToken(String message) {
        Result result = new Result();
        result.setCode(ResultEnum.TOKEN_FAIL.getCode());
        if (ObjectUtils.isEmpty(message)) {
            result.setMessage(ResultEnum.TOKEN_FAIL.getMessage());
        } else {
            result.setMessage(message);
        }
        return result;
    }

    public static <T> Result<T> error(int code, String message) {
        Result<T> result = new Result<T>();
        result.setCode(code);
        result.setMessage(message);

        return new Result(code, message);
    }

    public boolean isSuccess(){
        return this.code == ResultEnum.SUCCESS.getCode();
    }

}
