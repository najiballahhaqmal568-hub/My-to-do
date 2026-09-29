package app.mytodo.personal;

import android.content.res.Configuration;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Tells the web app whether the phone is in dark mode. The activity handles uiMode changes itself,
 * so the WebView's prefers-color-scheme would otherwise not update while the app is open.
 */
@CapacitorPlugin(name = "SystemTheme")
public class SystemThemePlugin extends Plugin {

    private static JSObject state(Configuration config) {
        JSObject result = new JSObject();
        result.put("dark", (config.uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES);
        return result;
    }

    @PluginMethod
    public void get(PluginCall call) {
        call.resolve(state(getContext().getResources().getConfiguration()));
    }

    @Override
    protected void handleOnConfigurationChanged(Configuration newConfig) {
        notifyListeners("change", state(newConfig));
    }
}
