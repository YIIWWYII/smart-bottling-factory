package com.archermind.hdc.service.ws;

import com.archermind.hdc.log.XLog;
import com.archermind.hdc.service.DataScreenService;
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
@ServerEndpoint("/dataScreen/{groupId}")
public class DataScreenWebSocketService {


    private static ApplicationContext applicationContext;

    public static void setApplicationContext(ApplicationContext context) {
        applicationContext = context;
    }

    private DataScreenService dataScreenService;


    // 会话对象
    private Session session;

    private Long groupId;

    // 存储当前的socket对象,groupId、sessionId分别为两级的key(一个组同时可以有多个大屏)
    private static ConcurrentHashMap<Long, Map<String,DataScreenWebSocketService>> socketPool = new ConcurrentHashMap<>();



    @OnOpen
    public void onOpen(Session session, @PathParam("groupId") Long groupId) {
        String sessionId = session.getId();
        XLog.info("dataScreenWebSocket开始建立连接，groupId：" + groupId+",sessionId:" + sessionId);
        Map<String, DataScreenWebSocketService> sessionMap = socketPool.get(groupId);
        try {
            // todo 改为可多人访问同一组
            if (sessionMap !=null) {
                DataScreenWebSocketService oldSocket = sessionMap.get(sessionId);
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

        dataScreenService = applicationContext.getBean(DataScreenService.class);
        // 发送数据到数字大屏
        dataScreenService.pushAllData2Screen(groupId);
    }


    @OnClose
    public void onClose(Session session, CloseReason closeReason){
        XLog.info("dataScreenWebSocket关闭连接，groupId：" + groupId+",sessionId:" + session.getId());
        XLog.info("dataScreenWebSocket关闭连接.code:"+closeReason.getCloseCode()+",reason:" + closeReason.getReasonPhrase());
        Map<String, DataScreenWebSocketService> sessionMap = socketPool.get(groupId);
        sessionMap.remove(session.getId());
    }

    @OnMessage
    public void onMessage(Session session, String message){
        XLog.info("dataScreenWebSocket收到消息，groupId：" + groupId+",message:" + message);
        // 只负责处理心跳检测
        try {
            if ("ping".equals(message)){
                sendText("pong");
                XLog.info("dataScreenWebSocket回复:pong");
            }
        } catch (IOException e) {
            XLog.error(e.getMessage());
        }
    }


    @OnError
    public void onError(Session session, Throwable throwable){
        XLog.error("dataScreenWebSocket.onError：" + session.isOpen());
        XLog.error("dataScreenWebSocket.onError：" + throwable.getMessage());
        throwable.printStackTrace();
    }

    public static void sentMessageByGroupId(Long groupId, String message){
        Map<String, DataScreenWebSocketService> sessionMap = socketPool.get(groupId);
        if (sessionMap == null || sessionMap.size() == 0){
            return;
        }
        sessionMap.forEach((key,socket) -> {
            if (socket!= null && socket.session != null && socket.session.isOpen()) {
                XLog.debug("dataScreenWebSocket.发送数据。groupId:" + groupId + ", message:" + message);
                try {
                    socket.sendText(message);
                } catch (IOException e) {
                    XLog.error(e.getMessage());
                }
            }
        });
    }

    private void sendText(String message) throws IOException {
        if (session == null) return;
        synchronized (session) {
            if (session.isOpen()) session.getBasicRemote().sendText(message);
        }
    }


}
