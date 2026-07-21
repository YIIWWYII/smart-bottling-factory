package com.archermind.hdc;

import com.archermind.hdc.service.ws.CommonWebSocketService;
import com.archermind.hdc.service.ws.DataScreenWebSocketService;
import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.server.standard.ServerEndpointExporter;

@MapperScan("com.archermind.hdc.mapper")
@EnableScheduling
@SpringBootApplication
@EnableWebSocket
public class HdcApplication {

    public static void main(String[] args) {
        ConfigurableApplicationContext context = SpringApplication.run(HdcApplication.class, args);
        DataScreenWebSocketService.setApplicationContext(context);
        CommonWebSocketService.setApplicationContext(context);
    }

    @Bean
    public ServerEndpointExporter serverEndpointExporter(){
        return new ServerEndpointExporter();
    }

}
