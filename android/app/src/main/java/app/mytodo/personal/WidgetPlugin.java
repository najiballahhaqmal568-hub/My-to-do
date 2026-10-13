package app.mytodo.personal;

import android.content.Context;
import android.util.DisplayMetrics;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.RemoteViews;
import android.widget.TextView;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONObject;

/** Receives today's snapshot from the web app, stores it, and redraws the home screen widget. */
@CapacitorPlugin(name = "Widget")
public class WidgetPlugin extends Plugin {

    @PluginMethod
    public void update(PluginCall call) {
        String json = call.getString("json");
        if (json == null) {
            call.reject("json is required");
            return;
        }
        Context context = getContext();
        context.getSharedPreferences(TodayWidgetProvider.PREFS, Context.MODE_PRIVATE).edit().putString(TodayWidgetProvider.KEY, json).apply();
        TodayWidgetProvider.refresh(context);
        call.resolve();
    }

    /**
     * Draws the widget in both text directions the way the launcher would, and reports the texts it shows.
     * Used by the emulator test, since the widget cannot be put on the home screen from a script.
     */
    @PluginMethod
    public void selfTest(PluginCall call) {
        Context context = getContext();
        JSObject result = new JSObject();
        JSArray texts = new JSArray();
        try {
            JSONObject snapshot = TodayWidgetProvider.load(context);
            for (boolean rtl : new boolean[] {true, false}) {
                JSONObject copy = snapshot == null ? new JSONObject() : new JSONObject(snapshot.toString());
                copy.put("rtl", rtl);
                RemoteViews views = TodayWidgetProvider.build(context, copy);
                View root = views.apply(context, new FrameLayout(context));
                DisplayMetrics dm = context.getResources().getDisplayMetrics();
                int w = Math.round(320 * dm.density);
                int h = Math.round(260 * dm.density);
                root.measure(View.MeasureSpec.makeMeasureSpec(w, View.MeasureSpec.EXACTLY), View.MeasureSpec.makeMeasureSpec(h, View.MeasureSpec.EXACTLY));
                root.layout(0, 0, w, h);
                if (rtl) collect(root, texts);
            }
            result.put("ok", true);
            result.put("texts", texts);
        } catch (Exception e) {
            result.put("ok", false);
            result.put("error", String.valueOf(e));
        }
        call.resolve(result);
    }

    private static void collect(View view, JSArray out) {
        if (view.getVisibility() != View.VISIBLE) return;
        if (view instanceof TextView) {
            CharSequence text = ((TextView) view).getText();
            if (text != null && text.length() > 0) out.put(text.toString());
        } else if (view instanceof ViewGroup) {
            ViewGroup group = (ViewGroup) view;
            for (int i = 0; i < group.getChildCount(); i++) collect(group.getChildAt(i), out);
        }
    }
}
