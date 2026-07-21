package com.archermind.hdc.util;

import com.google.gson.Gson;

import java.lang.reflect.Type;

public class GsonUtil {
    private static GsonUtil instance;
    private Gson gson = new Gson();

    private GsonUtil() {

    }

    public static GsonUtil getInstance() {
        if (instance == null) {
            instance = new GsonUtil();
        }
        return instance;
    }

    public <T> T fromJson(String json, Class<T> clazz) {
        return gson.fromJson(json, clazz);
    }

    public String toJson(Object object) {
        return gson.toJson(object);
    }

    public <T> T fromJson(String json, Type typeOfT) {
        return gson.fromJson(json, typeOfT);
    }
}
