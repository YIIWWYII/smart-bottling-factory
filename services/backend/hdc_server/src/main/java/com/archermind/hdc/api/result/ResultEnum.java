package com.archermind.hdc.api.result;

public enum ResultEnum {

    SUCCESS(0, "success"),
    MSG_ERROR(-1, "fail"),
    TOKEN_FAIL(3, "token已失效"),
    ;
    private int code;
    private String message;

    ResultEnum(int code, String message) {
        this.code = code;
        this.message = message;
    }

    public int getCode() {
        return this.code;
    }

    public String getMessage() {
        return this.message;
    }

}