package com.archermind.hdc.service.ws;

import org.springframework.context.ApplicationContext;
import org.springframework.context.ApplicationContextAware;
import org.springframework.stereotype.Component;

@Component
public class WebSocketApplicationContextBridge implements ApplicationContextAware {
    @Override
    public void setApplicationContext(ApplicationContext applicationContext) {
        DataScreenWebSocketService.setApplicationContext(applicationContext);
        CommonWebSocketService.setApplicationContext(applicationContext);
    }
}
