package com.archermind.hdc.config;

import com.archermind.hdc.anno.NoSwagger;
import com.github.xiaoymin.knife4j.spring.extension.OpenApiExtensionResolver;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import springfox.documentation.builders.ApiInfoBuilder;
import springfox.documentation.builders.PathSelectors;
import springfox.documentation.builders.RequestHandlerSelectors;
import springfox.documentation.service.ApiInfo;
import springfox.documentation.service.Contact;
import springfox.documentation.spi.DocumentationType;
import springfox.documentation.spring.web.plugins.Docket;
import springfox.documentation.swagger2.annotations.EnableSwagger2WebMvc;

import java.util.Objects;
import java.util.function.Predicate;


@Configuration
@EnableSwagger2WebMvc
public class SwaggerConfiguration {

    /*引入Knife4j提供的扩展类*/
    private final OpenApiExtensionResolver openApiExtensionResolver;

    @Autowired
    public SwaggerConfiguration(OpenApiExtensionResolver openApiExtensionResolver) {
        this.openApiExtensionResolver = openApiExtensionResolver;
    }

//
//    @Bean
//    public Docket customDocket() {
//        return new Docket(DocumentationType.SWAGGER_2)
//                .apiInfo(apiInfo())
//                .select()
//                .apis(not(RequestHandlerSelectors.withMethodAnnotation(NoSwagger.class)))
//                .apis(RequestHandlerSelectors.basePackage("com.skyworth.controller"))
////                .paths(PathSelectors.any())
//                .paths(PathSelectors.regex("/api/.*"))
//                .build();
//    }

    @Bean(value = "defaultApi2")
    public Docket defaultApi2() {
        String groupName="HDC后端服务接口文档";
        Docket docket=new Docket(DocumentationType.SWAGGER_2)
                .host("http://127.0.0.1")
                .apiInfo(apiInfo())
                .groupName(groupName)
                .select()
                .apis(not(RequestHandlerSelectors.withMethodAnnotation(NoSwagger.class)))
                .apis(RequestHandlerSelectors.basePackage("com.archermind.hdc.controller"))
//                .paths(PathSelectors.any())
//                .paths(PathSelectors.regex("/api/.*"))
                .build()
                //赋予插件体系
                .extensions(openApiExtensionResolver.buildExtensions(groupName));
        docket.pathMapping("hdc/api");
        return docket;
    }

    private ApiInfo apiInfo() {
        return new ApiInfoBuilder()
                .contact(new Contact(
                        "技术团队",
                        "https://xx.xx.com/",
                        "xx.xx@xx.com"
                ))
                .title("HDC后端服务")
                .version("1.0.0")
                .build();
    }

    /**
     * not 方法于Java11 提供，本项目使用1.8版本，所以由本地实现
     *
     * @param target
     * @param <T>
     * @return
     */
    static <T> Predicate<T> not(Predicate<? super T> target) {
        Objects.requireNonNull(target);
        return (Predicate<T>) target.negate();
    }

}
