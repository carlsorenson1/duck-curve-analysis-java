package com.duck_curve_analysis;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.ServletException;

import java.io.IOException;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.io.BufferedReader;
import java.io.InputStreamReader;

import java.net.URI;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.text.DateFormat;
import java.text.ParseException;
import java.time.ZoneId;
import java.util.*;

import org.eclipse.jetty.server.Server;
import org.eclipse.jetty.server.Request;
import org.eclipse.jetty.server.handler.AbstractHandler;

import java.text.SimpleDateFormat;
import java.net.http.HttpClient;

public class Application extends AbstractHandler
{
    private static final int PAGE_SIZE = 3000;
    private static final String INDEX_HTML = loadIndex();

    private static String loadIndex() {
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(Application.class.getResourceAsStream("/index.html")))) {
            final StringBuilder page = new StringBuilder(PAGE_SIZE);
            String line = null;

            while ((line = reader.readLine()) != null) {
                page.append(line);
            }

            return page.toString();
        } catch (final Exception exception) {
            return getStackTrace(exception);
        }
    }

    private static String getStackTrace(final Throwable throwable) {
        final StringWriter stringWriter = new StringWriter();
        final PrintWriter printWriter = new PrintWriter(stringWriter, true);
        throwable.printStackTrace(printWriter);

        return stringWriter.getBuffer().toString();
    }

    private static int getPort() {
        return Integer.parseInt(System.getenv().get("PORT"));
    }

    private void handleHttpRequest(HttpServletRequest request, HttpServletResponse response) throws IOException {
        response.getWriter().println(INDEX_HTML);
    }

    private void handleApiCall(HttpServletRequest request, HttpServletResponse response) throws IOException {
        String pathInfo = request.getPathInfo();
        String[] parts = pathInfo.split("/");
        String mode = parts[2];

        String dateString;
        Date parsedDate;

        switch(mode){
            case "day":
                dateString = parts[3];
                parsedDate = parseDate(dateString);
                ArrayList<Sample> samples = getDayDatapoints(parsedDate);
                writeOutSamples(samples, response);
                break;
            case "average":
                String dayTypes = parts[3];
                dateString = parts[4];
                parsedDate = parseDate(dateString);
                int daysIncluded = 1;

                Calendar cal = Calendar.getInstance();
                cal.setTime(parsedDate);
                int startMonth = cal.get(Calendar.MONTH);

                // Initialize the workingSamples to zero watts, but with the date values
                ArrayList<Sample> workingSamples = getDayDatapoints(parsedDate);
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
                        ArrayList<Sample> temp = getDayDatapoints(cal.getTime());
                        daysIncluded += 1;
                        for (int i = 0; i < 48; i++) {
                            workingSamples.get(i).averagePowerWatts += temp.get(i).averagePowerWatts;
                        }
                    }

                    // We need to add 25 hours and then truncate the time info so that DST does not mess up the loop
                    cal.add(Calendar.HOUR, 25);
                    cal.set(Calendar.HOUR_OF_DAY, 0);
                    cal.set(Calendar.MINUTE, 0);
                    cal.set(Calendar.SECOND, 0);
                    cal.set(Calendar.MILLISECOND, 0);
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

    private final Hashtable<Date, ArrayList<Sample>> dayCache = new Hashtable<>();

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

    private ArrayList<Sample> getDayDatapoints(Date date) {
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

    private long getDateOffset(Date date) {
        return TimeZone.getTimeZone(ZoneId.of("America/New_York")).getOffset(date.getTime());
    }

    private long getUnixDate(Date date) {
        return date.getTime() - getDateOffset(date);
    }

    private Date parseDate(String dateString) {
        try {
            return new SimpleDateFormat("yyyy-MM-dd").parse(dateString);
        } catch (ParseException e) {
            e.printStackTrace();
            return new GregorianCalendar(2021, 1, 1, 0, 0, 0).getTime();
        }
    }

    public void handle(String target, Request baseRequest, HttpServletRequest request, HttpServletResponse response)
            throws IOException, ServletException {
        response.setContentType("text/html;charset=utf-8");
        response.setStatus(HttpServletResponse.SC_OK);
        baseRequest.setHandled(true);

        String pathInfo = request.getPathInfo();
        if (pathInfo.startsWith("/api/")) {
            handleApiCall(request, response);
        } else {
            handleHttpRequest(request, response);
        }
    }

    public static void main(String[] args) throws Exception
    {
        Server server = new Server(getPort());
        Application app = new Application();
        server.setHandler(app);
        server.start();

        // Warmup
        Date startDate = app.parseDate("2020-10-01");
        Calendar cal = Calendar.getInstance();
        cal.setTime(startDate);
        Date endDate = app.parseDate("2020-12-31");

        while (cal.getTime().getTime() < endDate.getTime()){
            app.getDayDatapoints(cal.getTime());

            cal.add(Calendar.HOUR, 25);
            cal.set(Calendar.HOUR_OF_DAY, 0);
            cal.set(Calendar.MINUTE, 0);
            cal.set(Calendar.SECOND, 0);
            cal.set(Calendar.MILLISECOND, 0);
        }

        server.join();
    }
}
