#!/usr/bin/env bash
#
# electron-builder notarises the .app, but not the .dmg that wraps it. A
# downloaded disk image is assessed by Gatekeeper in its own right, so without
# this step the app inside is fine while opening the DMG still warns.
#
# Run it after `npm run package:mac`, with the same credentials in the
# environment (APPLE_API_KEY / APPLE_API_KEY_ID / APPLE_API_ISSUER, or
# APPLE_KEYCHAIN_PROFILE, or APPLE_ID / APPLE_APP_SPECIFIC_PASSWORD).

set -euo pipefail

cd "$(dirname "$0")/.."

DMG=$(ls -t release/*.dmg 2>/dev/null | head -1)
if [ -z "$DMG" ]; then
    echo "No .dmg in release/ - run npm run package:mac first." >&2
    exit 1
fi

IDENTITY=$(security find-identity -v -p codesigning \
    | grep "Developer ID Application" \
    | head -1 \
    | sed -E 's/.*"(.*)"/\1/')
if [ -z "$IDENTITY" ]; then
    echo "No Developer ID Application certificate in the keychain - see BUILD.md." >&2
    exit 1
fi

echo "==> Signing $DMG"
echo "    with: $IDENTITY"
codesign --force --sign "$IDENTITY" --timestamp "$DMG"

echo "==> Submitting to Apple (this takes a few minutes)"
if [ -n "${APPLE_API_KEY:-}" ]; then
    xcrun notarytool submit "$DMG" \
        --key "$APPLE_API_KEY" \
        --key-id "$APPLE_API_KEY_ID" \
        --issuer "$APPLE_API_ISSUER" \
        --wait
elif [ -n "${APPLE_KEYCHAIN_PROFILE:-}" ]; then
    xcrun notarytool submit "$DMG" --keychain-profile "$APPLE_KEYCHAIN_PROFILE" --wait
elif [ -n "${APPLE_ID:-}" ]; then
    xcrun notarytool submit "$DMG" \
        --apple-id "$APPLE_ID" \
        --password "$APPLE_APP_SPECIFIC_PASSWORD" \
        --team-id "${APPLE_TEAM_ID:-7Q6S4366TL}" \
        --wait
else
    echo "No notarisation credentials in the environment - see BUILD.md." >&2
    exit 1
fi

echo "==> Stapling"
xcrun stapler staple "$DMG"

echo "==> Verifying the way Gatekeeper will"
spctl -a -vvv -t open --context context:primary-signature "$DMG"
echo "OK: $DMG"
