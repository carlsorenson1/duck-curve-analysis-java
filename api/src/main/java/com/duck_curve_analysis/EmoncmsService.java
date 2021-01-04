package com.duck_curve_analysis;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.text.SimpleDateFormat;
import java.time.ZoneId;
import java.util.*;

public class EmoncmsService {
    private final Hashtable<Date, ArrayList<Sample>> dayCache = new Hashtable<>();

    public ArrayList<Sample> getDayDatapoints(Date date) {
        if (dayCache.containsKey(date)) {
            return getDeepCopy(dayCache.get(date));
        }

        System.err.println(String.format("Cache entry not found for date %s", date));

        String apiKey = System.getenv("EMONCMS_API_KEY");
        String feedId = System.getenv("FEED_ID_POWER_TOTAL");

        Calendar cal = Calendar.getInstance();
        cal.setTime(date);
        cal.add(Calendar.DAY_OF_MONTH, 1);
        Date nextDay = cal.getTime();

        HttpClient client = HttpClient.newHttpClient();

        URI uri = URI.create(String.format(
                "https://emoncms.org/feed/average.json?id=%s&start=%s&end=%s&interval=1800&apikey=%s",
                feedId,
                getUnixDate(date),
                getUnixDate(nextDay),
                apiKey));
        HttpRequest req = HttpRequest.newBuilder().uri(uri).build();

        SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss");

        ArrayList<Sample> dataPoints = new ArrayList<Sample>();

        try {
            HttpResponse<String> resp = client.send(req, HttpResponse.BodyHandlers.ofString());
            String raw = resp.body();

            String[] rawPoints = raw
                    .replaceAll("\\[","")
                    .replaceAll("]]","")
                    .split("],");

            for (int i = 0;i < rawPoints.length; i++) {
                Sample newSample = new Sample();
                var parts = rawPoints[i].split(",");
                Date date1 = new Date(Long.parseLong(parts[0]));
                date1 = new Date(date1.getTime() + getDateOffset(date1));
                double watts = Double.parseDouble(parts[1]);

                newSample.startTime = format.format(date1);
                newSample.averagePowerWatts = (int)Math.floor(watts);

                // TODO - fix DST fudge
                // Fudge for DST change - just drop the extra hour in the fall or add extra records in the spring.
                // In a serious application, we'd need to do some more complicated work for this.
                if (rawPoints.length == 50 && (i == 4 || i == 5) ){
                    continue;
                }
                if (rawPoints.length == 46 && i == 4){
                    dataPoints.add(newSample);
                    dataPoints.add(newSample);
                }

                dataPoints.add(newSample);
            }
        } catch (IOException e) {
            e.printStackTrace();
        } catch (InterruptedException e) {
            e.printStackTrace();
        }

        dayCache.put(date, dataPoints);

        return getDeepCopy(dataPoints);
    }

    private ArrayList<Sample> getDeepCopy(ArrayList<Sample> datapoints) {
        ArrayList<Sample> newList = new ArrayList<>();
        for (int i = 0; i < datapoints.size(); i++) {
            Sample newSample = new Sample();
            newSample.averagePowerWatts = datapoints.get(i).averagePowerWatts;
            newSample.startTime = datapoints.get(i).startTime;
            newList.add(newSample);
        }
        return newList;
    }

    private long getUnixDate(Date date) {
        return date.getTime() - getDateOffset(date);
    }

    private long getDateOffset(Date date) {
        return TimeZone.getTimeZone(ZoneId.of("America/New_York")).getOffset(date.getTime());
    }
}
