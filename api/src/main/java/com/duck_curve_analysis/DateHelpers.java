package com.duck_curve_analysis;

import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.GregorianCalendar;

public class DateHelpers {
    public static Date parseDate(String dateString) {
        try {
            return new SimpleDateFormat("yyyy-MM-dd").parse(dateString);
        } catch (ParseException e) {
            e.printStackTrace();
            return new GregorianCalendar(2021, 1, 1, 0, 0, 0).getTime();
        }
    }

    public static void addOneDay(Calendar cal){
        // We need to add 25 hours and then truncate the time info so that DST does not mess up the date
        cal.add(Calendar.HOUR, 25);
        cal.set(Calendar.HOUR_OF_DAY, 0);
        cal.set(Calendar.MINUTE, 0);
        cal.set(Calendar.SECOND, 0);
        cal.set(Calendar.MILLISECOND, 0);
    }
}
