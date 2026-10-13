#!/usr/bin/env bash
# Signs a release APK.   Usage: scripts/sign-release.sh <built.apk> <signed.apk>
#
# The Gradle build signs with the public key committed in android/app (ADR 0001). When a private key is
# available, this script signs the APK again with it and adds a key rotation lineage from the public key, so
# a phone that has an earlier build installed still accepts the update.
#
# The private key is release/private-release.p12.enc, encrypted with the passphrase that the owner keeps in
# the GitHub secret SIGNING_PASSPHRASE (ADR 0003). Tests can supply a throwaway key instead through
# NEW_KEYSTORE, NEW_KEY_ALIAS and NEW_KEY_PASS. With neither, the APK is only copied.
set -euo pipefail

IN=${1:?built apk}
OUT=${2:?signed apk}
HERE=$(cd "$(dirname "$0")/.." && pwd)
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

if [ -z "${NEW_KEYSTORE:-}" ] && [ -n "${SIGNING_PASSPHRASE:-}" ]; then
  openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -in "$HERE/release/private-release.p12.enc" -out "$WORK/private.p12" -pass env:SIGNING_PASSPHRASE
  export NEW_KEYSTORE="$WORK/private.p12" NEW_KEY_ALIAS=mytodo-private NEW_KEY_PASS="$SIGNING_PASSPHRASE"
fi

if [ -z "${NEW_KEYSTORE:-}" ]; then
  cp "$IN" "$OUT"
  echo "signed with the public key only (no private key available)"
  exit 0
fi

SDK=${ANDROID_HOME:-${ANDROID_SDK_ROOT:-/usr/local/lib/android/sdk}}
APKSIGNER=$(ls -d "$SDK"/build-tools/*/apksigner | sort -V | tail -1)
export OLD_PASS=mytodo-public NEW_KEY_PASS

"$APKSIGNER" rotate --out "$WORK/lineage" \
  --old-signer --ks "$HERE/android/app/public-release.keystore" --ks-key-alias mytodo --ks-pass env:OLD_PASS --key-pass env:OLD_PASS \
  --new-signer --ks "$NEW_KEYSTORE" --ks-key-alias "${NEW_KEY_ALIAS:-mytodo-private}" --ks-pass env:NEW_KEY_PASS --key-pass env:NEW_KEY_PASS

# Two signers: the oldest (the public key) signs the v1 and v2 layers that Android 7 and 8 read, so those
# phones keep accepting updates; the newest (the private key) signs the v3 layer with the lineage, which
# Android 9 and newer read and which stops anyone with only the public key from updating them.
"$APKSIGNER" sign \
  --ks "$HERE/android/app/public-release.keystore" --ks-key-alias mytodo --ks-pass env:OLD_PASS --key-pass env:OLD_PASS \
  --next-signer --ks "$NEW_KEYSTORE" --ks-key-alias "${NEW_KEY_ALIAS:-mytodo-private}" --ks-pass env:NEW_KEY_PASS --key-pass env:NEW_KEY_PASS \
  --lineage "$WORK/lineage" --v1-signing-enabled true --v2-signing-enabled true --v3-signing-enabled true \
  --out "$OUT" "$IN"

"$APKSIGNER" verify --verbose --print-certs "$OUT" | grep -E "Verifies|v3|Number of signers|SHA-256" || true
echo "signed with the private key, with a rotation lineage from the public key"
