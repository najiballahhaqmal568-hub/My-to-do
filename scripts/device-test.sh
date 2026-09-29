#!/bin/bash
# Runs inside an Android emulator job: installs the debug APK, drives the app through
# scripts/device-test.mjs, and fails if the app crashed.
set -uo pipefail
APK=android/app/build/outputs/apk/debug/app-debug.apk
PKG=app.mytodo.personal
mkdir -p device-shots
adb install -r "$APK"
adb shell pm grant $PKG android.permission.POST_NOTIFICATIONS || true
adb shell appops set $PKG SCHEDULE_EXACT_ALARM allow || true
adb logcat -c
adb shell am start -W -n $PKG/.MainActivity
status=0
node scripts/device-test.mjs || status=$?
adb logcat -d > device-shots/logcat.txt
# Small copies of key screenshots, printed into the log so they can be read without downloading artifacts.
for name in 1-dashboard 2-editor 5-notification 8-dark; do
  f=device-shots/$name.png
  [ -f "$f" ] || continue
  if command -v magick >/dev/null; then magick "$f" -resize 280x -quality 40 "/tmp/$name.jpg"
  elif command -v convert >/dev/null; then convert "$f" -resize 280x -quality 40 "/tmp/$name.jpg"
  else python3 -c "import sys" && echo "[img] no image converter on this runner" && break; fi
  base64 -w 4000 "/tmp/$name.jpg" | sed "s/^/[img $name] /"
done
if grep -q "FATAL EXCEPTION" device-shots/logcat.txt; then
  echo "[device] FAIL: the app crashed"
  grep -A 25 "FATAL EXCEPTION" device-shots/logcat.txt | head -60
  exit 1
fi
exit $status
