package com.archermind.hdc.config.mybatis;

import com.baomidou.mybatisplus.annotation.DbType;
import com.baomidou.mybatisplus.core.config.GlobalConfig;
import com.baomidou.mybatisplus.core.injector.ISqlInjector;
import com.baomidou.mybatisplus.extension.plugins.MybatisPlusInterceptor;
import com.baomidou.mybatisplus.extension.plugins.inner.PaginationInnerInterceptor;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class MybatisConfig {


    @Bean
    public MybatisPlusInterceptor mybatisPlusInterceptor() {
        MybatisPlusInterceptor interceptor = new MybatisPlusInterceptor();
        interceptor.addInnerInterceptor(new PaginationInnerInterceptor(DbType.MYSQL));
        return interceptor;
    }


    @Bean()
    public InsertBatchSqlInjector easySqlInjector() {
        return new InsertBatchSqlInjector();
    }


    @Bean
    public GlobalConfig globalConfig(@Qualifier("easySqlInjector") ISqlInjector easySqlInjector){
        GlobalConfig globalConfig = new GlobalConfig();
        globalConfig.setSqlInjector(easySqlInjector);
        return globalConfig;
    }
}
