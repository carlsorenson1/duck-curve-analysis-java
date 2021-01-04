package com.duck_curve_analysis;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;

public class RequestProcessor {
    private EmoncmsService emoncmsService = new EmoncmsService();

    public void warmUp() {
        Date startDate = DateHelpers.parseDate("2020-10-01");
        Calendar cal = Calendar.getInstance();
        Date endDate = DateHelpers.parseDate("2020-12-31");

        for (FeedType feedType : FeedType.values()) {
            cal.setTime(startDate);

            while (cal.getTime().getTime() < endDate.getTime()){
                emoncmsService.getDayDatapoints(feedType, cal.getTime());
                DateHelpers.addOneDay(cal);
            }
        }
    }

    public void handleApiCall(HttpServletRequest request, HttpServletResponse response) throws IOException {
        String pathInfo = request.getPathInfo();
        String[] parts = pathInfo.split("/");

        if (parts[2].equals("solar")) {
            writeOutSamples(SolarData.getSolarSamples(), response);
            return;
        }

        FeedType feedType = FeedType.valueOf(parts[2].toUpperCase(Locale.ROOT));

        String mode = parts[3];

        String dateString;
        Date parsedDate;

        switch(mode) {
            case "day":
                dateString = parts[4];
                parsedDate = DateHelpers.parseDate(dateString);
                ArrayList<Sample> samples = emoncmsService.getDayDatapoints(feedType, parsedDate);
                writeOutSamples(samples, response);
                break;
            case "average":
                String dayTypes = parts[4];
                dateString = parts[5];
                parsedDate = DateHelpers.parseDate(dateString);
                int daysIncluded = 1;

                Calendar cal = Calendar.getInstance();
                cal.setTime(parsedDate);
                int startMonth = cal.get(Calendar.MONTH);

                // Initialize the workingSamples to zero watts, but with the date values
                ArrayList<Sample> workingSamples = emoncmsService.getDayDatapoints(feedType, parsedDate);
                for (int i = 0; i < 48; i++) {
                    workingSamples.get(i).averagePowerWatts = 0;
                }

                while (cal.get(Calendar.MONTH) == startMonth) {
                    int dayOfWeek = cal.get(Calendar.DAY_OF_WEEK);
                    boolean isWeekday = dayOfWeek != Calendar.SATURDAY && dayOfWeek != Calendar.SUNDAY;
                    boolean include = false;

                    switch (dayTypes){
                        case "all":
                            include = true;
                            break;
                        case "weekends":
                            include = !isWeekday;
                            break;
                        case "weekdays":
                            include = isWeekday;
                    }

                    if (include) {
                        ArrayList<Sample> temp = emoncmsService.getDayDatapoints(feedType, cal.getTime());
                        daysIncluded += 1;
                        for (int i = 0; i < 48; i++) {
                            workingSamples.get(i).averagePowerWatts += temp.get(i).averagePowerWatts;
                        }
                    }

                    DateHelpers.addOneDay(cal);
                }

                for (int i = 0; i < 48; i++) {
                    workingSamples.get(i).averagePowerWatts /= daysIncluded;
                }

                writeOutSamples(workingSamples, response);

                break;
        }
    }

    private void writeOutSamples(ArrayList<Sample> samples, HttpServletResponse response) {
        try {
            response.setContentType("application/json");
            response.addHeader("Access-Control-Allow-Origin", "*");
            response.getWriter().println("[");

            for (int i = 0; i<samples.size(); i++) {
                Sample sample = samples.get(i);
                String separator = i == samples.size() - 1 ? "" : ",";
                response.getWriter().println(String.format(
                        "{ \"startTime\": \"%s\", \"averagePowerWatts\": %s } %s",
                        sample.startTime,
                        sample.averagePowerWatts,
                        separator));
            }
            response.getWriter().println("]");
        } catch (IOException e) {
            e.printStackTrace();
        }
    }
}
