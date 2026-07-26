package com.archermind.hdc.log;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class XLog {
    private static Logger logger = LoggerFactory.getLogger(XLog.class);

    public static void debug(String message) {
        logger.debug(message);
    }

    public static void info(String message) {
        logger.info(message);
    }

    public static void warn(String message) {
        logger.warn(message);
    }

    public static void error(String message) {
        logger.error(message);
    }
    public static void error(Exception ex){
        logger.error(ex.getMessage(), ex);
    }
    public static void error(Throwable ex){
        logger.error(ex.getMessage(), ex);
    }

}
