package com.archermind.hdc.integration.enterprise.dto;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
public class EnterprisePlcStatus {
    private boolean mqttConnected;
    private boolean online;
    private String adapterSn;
    private String adapterIp;
    private String protocolType;
    private String version;
    private LocalDateTime lastSeenAt;
    private List<String> switchNames = new ArrayList<>();
    private List<String> switchDevices = new ArrayList<>();
    private List<Integer> switches = new ArrayList<>();
    private List<Integer> lamps = new ArrayList<>();
}
