package com.archermind.hdc.scheduled;

public interface Config {
    /**
     * 心跳扫码频率
     */
    long NOTICE_SYNC_RATE = 5 * 1000;
    /**
     * 异常解析检查频率
     */
    long ERROR_ANALYSIS_RATE = 5 * 1000;
    /**
     * 检查离线时间的频率
     */
    long CHECK_ONLINE_RATE = NOTICE_SYNC_RATE * 3;
    /**
     * 向数据大屏推送产线设备信息
     */
    long PUSH_MACHINEINFO_RATE = 1 * 1000;
}
