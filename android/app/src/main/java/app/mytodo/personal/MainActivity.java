package app.mytodo.personal;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SystemThemePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
