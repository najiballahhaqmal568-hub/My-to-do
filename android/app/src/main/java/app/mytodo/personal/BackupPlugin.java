package app.mytodo.personal;

import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.ContentValues;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/**
 * Saves backup files into the public Download/My-To-Do folder through MediaStore. Files created this way
 * need no storage permission and stay on the phone when the app is uninstalled. Works on Android 10 and up.
 */
@CapacitorPlugin(name = "Backup")
public class BackupPlugin extends Plugin {

    private static final String FOLDER = "Download/My-To-Do/";

    @PluginMethod
    public void save(PluginCall call) {
        String name = call.getString("name");
        String text = call.getString("text");
        int keep = call.getInt("keep", 14);
        JSObject result = new JSObject();
        if (name == null || text == null || !name.matches("my-to-do-[0-9-]+\\.json")) {
            call.reject("a backup name like my-to-do-2026-10-02.json and text are required");
            return;
        }
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            result.put("saved", false);
            result.put("reason", "unsupported");
            call.resolve(result);
            return;
        }
        try {
            ContentResolver resolver = getContext().getContentResolver();
            Uri collection = MediaStore.Downloads.EXTERNAL_CONTENT_URI;
            // Replace today's earlier backup, if this app made it.
            for (long id : find(resolver, collection, name)) deleteQuietly(resolver, collection, id);

            ContentValues values = new ContentValues();
            values.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
            values.put(MediaStore.MediaColumns.MIME_TYPE, "application/json");
            values.put(MediaStore.MediaColumns.RELATIVE_PATH, FOLDER);
            values.put(MediaStore.MediaColumns.IS_PENDING, 1);
            Uri uri = resolver.insert(collection, values);
            if (uri == null) throw new IllegalStateException("could not create the backup file");
            try (OutputStream out = resolver.openOutputStream(uri, "wt")) {
                if (out == null) throw new IllegalStateException("could not open the backup file");
                out.write(text.getBytes(StandardCharsets.UTF_8));
            }
            values.clear();
            values.put(MediaStore.MediaColumns.IS_PENDING, 0);
            resolver.update(uri, values, null, null);

            // Keep only the newest backups. Files this app cannot delete (from an earlier install) are left alone.
            List<Long> all = find(resolver, collection, null);
            for (int i = Math.max(keep, 1); i < all.size(); i++) deleteQuietly(resolver, collection, all.get(i));

            result.put("saved", true);
            result.put("path", FOLDER + name);
            call.resolve(result);
        } catch (Exception e) {
            call.reject(String.valueOf(e.getMessage()), e);
        }
    }

    /** Ids of this app's backup files in the folder, newest name first; all of them, or only those called `name`. */
    private static List<Long> find(ContentResolver resolver, Uri collection, String name) {
        List<Long> ids = new ArrayList<>();
        String selection = MediaStore.MediaColumns.RELATIVE_PATH + "=? AND " + MediaStore.MediaColumns.DISPLAY_NAME + (name == null ? " LIKE ?" : "=?");
        String[] args = {FOLDER, name == null ? "my-to-do-%.json" : name};
        try (Cursor c = resolver.query(collection, new String[] {MediaStore.MediaColumns._ID}, selection, args, MediaStore.MediaColumns.DISPLAY_NAME + " DESC")) {
            while (c != null && c.moveToNext()) ids.add(c.getLong(0));
        }
        return ids;
    }

    private static void deleteQuietly(ContentResolver resolver, Uri collection, long id) {
        try {
            resolver.delete(ContentUris.withAppendedId(collection, id), null, null);
        } catch (SecurityException ignored) {
            // Not created by this install; leave it.
        }
    }
}
