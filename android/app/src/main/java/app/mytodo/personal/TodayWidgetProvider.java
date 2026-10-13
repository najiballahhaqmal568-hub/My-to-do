package app.mytodo.personal;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.view.View;
import android.widget.RemoteViews;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * The home screen widget with today's tasks. It cannot read the app's database, so the web app hands it a
 * ready-made snapshot (see WidgetPlugin) that is kept in SharedPreferences and drawn here.
 */
public class TodayWidgetProvider extends AppWidgetProvider {

    static final String PREFS = "widget";
    static final String KEY = "snapshot";
    private static final int ROWS = 6;

    private static final int[] ROW = {R.id.w_row0, R.id.w_row1, R.id.w_row2, R.id.w_row3, R.id.w_row4, R.id.w_row5};
    private static final int[] DOT = {R.id.w_dot0, R.id.w_dot1, R.id.w_dot2, R.id.w_dot3, R.id.w_dot4, R.id.w_dot5};
    private static final int[] TITLE = {R.id.w_title0, R.id.w_title1, R.id.w_title2, R.id.w_title3, R.id.w_title4, R.id.w_title5};
    private static final int[] TIME = {R.id.w_time0, R.id.w_time1, R.id.w_time2, R.id.w_time3, R.id.w_time4, R.id.w_time5};

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) manager.updateAppWidget(id, build(context, load(context)));
    }

    /** Redraws every widget on the home screen from the stored snapshot. */
    public static void refresh(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, TodayWidgetProvider.class));
        JSONObject snapshot = load(context);
        for (int id : ids) manager.updateAppWidget(id, build(context, snapshot));
    }

    static JSONObject load(Context context) {
        try {
            String raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, null);
            return raw == null ? null : new JSONObject(raw);
        } catch (Exception e) {
            return null;
        }
    }

    /** Builds the widget from a snapshot; with none yet, asks the user to open the app once. */
    static RemoteViews build(Context context, JSONObject s) {
        boolean rtl = s == null || s.optBoolean("rtl", true);
        RemoteViews v = new RemoteViews(context.getPackageName(), rtl ? R.layout.widget_today : R.layout.widget_today_ltr);

        String today = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
        boolean stale = s != null && !today.equals(s.optString("day"));

        if (s == null) {
            v.setTextViewText(R.id.w_title, context.getString(R.string.widget_name));
            v.setTextViewText(R.id.w_summary, "");
            v.setTextViewText(R.id.w_tomorrow, "");
        } else if (stale) {
            // A new day has begun and the app has not run yet: do not show yesterday's list as today's.
            v.setTextViewText(R.id.w_title, s.optString("staleHint"));
            v.setTextViewText(R.id.w_summary, "");
            v.setTextViewText(R.id.w_tomorrow, "");
        } else {
            v.setTextViewText(R.id.w_title, s.optString("title"));
            v.setTextViewText(R.id.w_summary, s.optString("summary"));
            v.setTextViewText(R.id.w_tomorrow, s.optString("tomorrow"));
        }
        v.setProgressBar(R.id.w_progress, 100, s == null || stale ? 0 : s.optInt("progress"), false);

        JSONArray items = s == null || stale ? new JSONArray() : s.optJSONArray("items");
        for (int i = 0; i < ROWS; i++) {
            JSONObject item = items != null && i < items.length() ? items.optJSONObject(i) : null;
            v.setViewVisibility(ROW[i], item == null ? View.GONE : View.VISIBLE);
            if (item == null) continue;
            v.setTextViewText(TITLE[i], item.optString("title"));
            v.setTextViewText(TIME[i], item.optString("time"));
            v.setTextColor(TITLE[i], context.getColor(item.optBoolean("overdue") ? R.color.widget_danger : R.color.widget_text));
            try {
                v.setInt(DOT[i], "setColorFilter", Color.parseColor(item.optString("color", "#5B645E")));
            } catch (IllegalArgumentException ignored) {
                // Keep the default dot colour.
            }
        }
        String more = s == null || stale ? "" : s.optString("more");
        v.setViewVisibility(R.id.w_more, more.isEmpty() ? View.GONE : View.VISIBLE);
        v.setTextViewText(R.id.w_more, more);

        Intent open = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (open != null) {
            PendingIntent pending = PendingIntent.getActivity(context, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            v.setOnClickPendingIntent(R.id.w_root, pending);
        }
        return v;
    }
}
