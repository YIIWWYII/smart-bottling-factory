package com.archermind.hdc.service.ws;

import com.archermind.hdc.log.XLog;
import com.archermind.hdc.service.AdapterPlcService;
import lombok.Setter;
import org.springframework.context.ApplicationContext;
import org.springframework.stereotype.Component;

import javax.websocket.*;
import javax.websocket.server.PathParam;
import javax.websocket.server.ServerEndpoint;
import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
@ServerEndpoint("/plc/{groupId}")
public class CommonWebSocketService {


    @Setter
    private static ApplicationContext applicationContext;

    private AdapterPlcService adapterPlcService;


    // 会话对象
    private Session session;

    private Long groupId;

    // 存储当前的socket对象,groupId、sessionId分别为两级的key(一个组同时可以有多个大屏)
    private static ConcurrentHashMap<Long, Map<String, CommonWebSocketService>> socketPool = new ConcurrentHashMap<>();



    @OnOpen
    public void onOpen(Session session, @PathParam("groupId") Long groupId) {
        String sessionId = session.getId();
        XLog.info("commonWebSocket开始建立连接，groupId：" + groupId+",sessionId:" + sessionId);
        Map<String, CommonWebSocketService> sessionMap = socketPool.get(groupId);
        try {
            if (groupId == null){
                throw new RuntimeException("groupId不能为空");
            }
            // todo 改为可多人访问同一组
            if (sessionMap !=null) {
                CommonWebSocketService oldSocket = sessionMap.get(sessionId);
                if (oldSocket !=null) {
                    oldSocket.session.close();
                    sessionMap.remove(sessionId);
                }
            } else {
                sessionMap = new HashMap<>();
            }
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
        this.session = session;
        this.groupId = groupId;
        sessionMap.put(sessionId, this);
        socketPool.put(groupId, sessionMap);

        adapterPlcService = applicationContext.getBean(AdapterPlcService.class);
        adapterPlcService.pushLamps2Web(groupId);
        adapterPlcService.pushInfo2Web(groupId);
    }

    @OnMessage
    public void onMessage(Session session, String message){
        XLog.info("commonWebSocket收到消息，groupId：" + groupId+",message:"+message);
        try {
            if ("ping".equals(message)){
                session.getBasicRemote().sendText("pong");
                XLog.info("commonWebSocket回复:pong");
            } else {
                adapterPlcService.onMessage4Websocket(message);
            }
        } catch (IOException e) {
            XLog.error(e.getMessage());
        }
    }


    @OnError
    public void onError(Session session, Throwable throwable){
        XLog.error("commonWebSocket.onError：" + throwable.getMessage());
        throwable.printStackTrace();
    }

    public static void sentMessageByGroupId(Long groupId, String message){
        Map<String, CommonWebSocketService> sessionMap = socketPool.get(groupId);
        if (sessionMap == null || sessionMap.size() == 0){
            return;
        }
        sessionMap.forEach((key,socket) -> {
            if (socket!= null && socket.session != null && socket.session.isOpen()) {
                XLog.debug("commonWebSocket发送数据。groupId:" + groupId + ", message:" + message);
                try {
                    socket.session.getBasicRemote().sendText(message);
                } catch (IOException e) {
                    XLog.error(e.getMessage());
                }
            }
        });
    }



    @OnClose
    public void onClose(Session session, CloseReason closeReason){
        XLog.info("commonWebSocket关闭连接，groupId：" + groupId+",sessionId:" + session.getId());
        XLog.info("commonWebSocket.reason:" + closeReason.getReasonPhrase());
        Map<String, CommonWebSocketService> sessionMap = socketPool.get(groupId);
        sessionMap.remove(session.getId());
    }

}
