package com.archermind.hdc.entity;

import lombok.Data;

import java.util.Date;

@Data
public class ProductWebHelperDao {
    private String barCode;
    private String typeName;
    private String modelName;
    private String path;
    private Date createAt;
}
