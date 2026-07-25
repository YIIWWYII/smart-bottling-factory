package com.archermind.hdc.util;

public class DataUtil {
    public static String buLing4(int number){
        String tmp="0000"+number;
        int removeIndex=tmp.length()-4;
        String sub=tmp.substring(removeIndex,tmp.length());
        return sub;
    }
}
