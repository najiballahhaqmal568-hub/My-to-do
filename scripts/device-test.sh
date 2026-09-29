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
if grep -q "FATAL EXCEPTION" device-shots/logcat.txt; then
  echo "[device] FAIL: the app crashed"
  grep -A 25 "FATAL EXCEPTION" device-shots/logcat.txt | head -60
  exit 1
fi
exit $status
