#!/bin/bash
# Runs inside an Android emulator job. Checks that an update signed with a new key and a rotation lineage
# installs over a build signed with the public key, and that the same update without the lineage is refused.
set -uo pipefail
PKG=app.mytodo.personal
status=0
check() { if [ "$2" = ok ]; then echo "[rotation] PASS: $1"; else echo "[rotation] FAIL: $1"; status=1; fi; }

adb install -r out/old.apk 2>&1 | tee install-old.txt
grep -q Success install-old.txt && check "the build signed with the public key installs" ok || check "the build signed with the public key installs" fail

adb install -r out/rotated.apk 2>&1 | tee install-rotated.txt
grep -q Success install-rotated.txt && check "an update signed with the new key and a lineage installs over it" ok || check "an update signed with the new key and a lineage installs over it" fail
version=$(adb shell dumpsys package $PKG | grep -m1 versionCode)
echo "$version" | grep -q "versionCode=2" && check "the app is now version 2 ($version)" ok || check "the app is now version 2 ($version)" fail

# Control: without the lineage Android must refuse, which is what the lineage is for.
adb uninstall $PKG >/dev/null
adb install out/old.apk >/dev/null 2>&1
adb install -r out/unrotated.apk 2>&1 | tee install-unrotated.txt
grep -q "INSTALL_FAILED_UPDATE_INCOMPATIBLE" install-unrotated.txt && check "without the lineage the update is refused" ok || check "without the lineage the update is refused" fail
exit $status
