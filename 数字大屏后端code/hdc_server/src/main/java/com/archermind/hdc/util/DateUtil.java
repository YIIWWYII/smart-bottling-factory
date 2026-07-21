package com.archermind.hdc.util;


import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.Date;

public class DateUtil {
    private static final SimpleDateFormat ss = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");
    private static final SimpleDateFormat sss = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss.SSS");
    private static final SimpleDateFormat dd = new SimpleDateFormat("yyyy-MM-dd");
    private static final SimpleDateFormat chinaDay = new SimpleDateFormat("yyyy年MM月dd日");
    private static final SimpleDateFormat chinaDaySS = new SimpleDateFormat("yyyy年MM月dd日 HH时mm分ss秒");
    private static final long day6 = 6 * 24 * 60 * 60 * 1000;

    public static String formatChinaDayDate(Date date) {
        return chinaDay.format(date);
    }
    public static String formatSSDate(Date date) {
        return ss.format(date);
    }
    public static String formatSSSDate(Date date) {
        return sss.format(date);
    }

    public static Date toSSDate(String date) throws ParseException {
        return ss.parse(date);
    }

    public static Date get7Date() {
        Date now = new Date(); //获取当前时间
        String foo = dd.format(now);
        Date tmp = null;
        try {
            tmp = dd.parse(foo);
        } catch (ParseException e) {
            e.printStackTrace();
        }
        return new Date(tmp.getTime() - day6);
    }

    public static String second2Time(Long second) {
        if (second == null || second < 0) {
            return "00:00";
        }

        long h = second / 3600;
        long m = (second % 3600) / 60;
        long s = second % 60;
        String str = "";
        if (h > 0) {
            str = (h < 10 ? ("0" + h) : h) + ":";
        }
        str += (m < 10 ? ("0" + m) : m) + ":";
        str += (s < 10 ? ("0" + s) : s);
        return str;

    }
}
