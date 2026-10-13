# 3. A private signing key, introduced without stranding installed apps

## Status

Accepted. Narrows the risk accepted in ADR 0001; the public key stays as the default and as the old half of the rotation.

## Context

ADR 0001 signs releases with a key committed to this public repository, so anyone could produce an APK that installs over the owner's app. A private key fixes that, but a phone only accepts an update signed by the same key as the installed app. Switching keys the plain way would make every phone uninstall the app first and lose its data.

GitHub secrets cannot be set from the environment the app is developed in, and the owner works from a phone, where creating a keystore with Java tools is impractical.

## Decision

- A new private key (RSA 4096, PKCS12) is stored **encrypted** in `release/private-release.p12.enc` (AES-256-CBC, PBKDF2 with 600,000 iterations) under a random 40-character passphrase. The passphrase is not in the repository. The owner keeps it and adds it to GitHub as the repository secret `SIGNING_PASSPHRASE`; that single secret is the only manual step.
- `scripts/sign-release.sh` runs after the Gradle build. With `SIGNING_PASSPHRASE` set it decrypts the key and signs the APK again with APK Signature Scheme v3 and a **rotation lineage** from the public key to the private one. Phones that have a build signed with the public key accept this update and keep their data. Without the secret, the script keeps the APK signed with the public key, exactly as before.
- If the private signing fails (wrong passphrase, tool error) the release fails loudly. Falling back to the public key would be dangerous: after a phone has accepted the rotation, an APK signed only with the old key can no longer update it.
- The Device test workflow proves the mechanism on an Android 14 emulator with a throwaway key: an update signed with a new key and the lineage installs over a build signed with the public key, and the same update without the lineage is refused.

## Consequences

- Once the secret is set and a release has been built, only someone with the passphrase can produce an update that existing installs accept. The public key still works for installs from before the rotation, so there is no flag day.
- Key rotation needs Android 9 or newer (API 28). Phones on Android 7 or 8 cannot take a rotated update: for them the owner must export a backup, uninstall, install the new APK and import.
- The passphrase must be kept safely. If it is lost, nothing breaks for installed apps, but no further private-key releases can be built; generate a new key (a new ADR) and rotate again, or remove the secret to return to the public key (a release made that way will not install over a phone that already took a rotated one).
- The encrypted key is public. Its safety rests on the passphrase being long and random and never committed.
