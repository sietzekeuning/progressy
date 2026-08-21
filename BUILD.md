# Building Progressy

```bash
npm install
npm run package:mac     # or package:win / package:linux
```

Output lands in `release/`:

| Platform | Files |
| --- | --- |
| macOS | `Progressy-1.0.0-arm64.dmg`, `Progressy-1.0.0-arm64-mac.zip` |
| Windows | `Progressy Setup 1.0.0.exe`, `Progressy-1.0.0-win-portable.exe` |
| Linux | `Progressy-1.0.0.AppImage`, `progressy_1.0.0_amd64.deb` |

Each platform has to be built on that platform (or in CI); electron-builder cannot cross-compile the
Windows and Linux targets from macOS.

## Signing and notarising the macOS build

Without this, anyone who downloads the DMG gets *"Progressy cannot be opened because the developer
cannot be verified"* and has to right-click → Open, or run
`xattr -dr com.apple.quarantine /Applications/Progressy.app`. Notarising removes that entirely.

It needs a paid Apple Developer Program membership. **An "Apple Development" or "Apple Distribution"
certificate is not enough** — those are for local testing and the App Store. Downloads outside the
App Store need a *Developer ID Application* certificate.

### 1. Create the Developer ID certificate (once)

1. Open **Keychain Access** → menu **Certificate Assistant** → **Request a Certificate From a
   Certificate Authority**. Enter your email, leave CA Email empty, pick **Saved to disk**. That
   writes a `.certSigningRequest` file.
2. Go to <https://developer.apple.com/account/resources/certificates/add>.
3. Choose **Developer ID Application** → Continue → upload the CSR from step 1 → Continue.
4. Download the `.cer` and double-click it to add it to your login keychain.

Check that it landed:

```bash
security find-identity -v -p codesigning | grep "Developer ID Application"
```

### 2. Create an app-specific password (once)

Notarisation signs in to Apple on your behalf, and your Apple ID password will not do:

1. Go to <https://appleid.apple.com> → **Sign-In and Security** → **App-Specific Passwords**.
2. Generate one, name it something like `progressy-notarize`, and copy the value.

### 3. Build

```bash
export APPLE_ID="your@appleid.email"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="7Q6S4366TL"
npm run package:mac
```

electron-builder signs with the Developer ID certificate, uploads the app to Apple, waits for the
result, and staples the ticket to the DMG so it also works offline. Expect the notarisation step to
add a few minutes to the build.

The team id is already in `electron-builder.json` under `mac.notarize`. If the environment variables
are missing, the build still succeeds but logs `skipped macOS notarization` — that is the tell-tale
that you would be shipping a build with the Gatekeeper prompt.

### 4. Verify before releasing

```bash
spctl -a -vvv -t install /Applications/Progressy.app   # expect: accepted, source=Notarized Developer ID
xcrun stapler validate release/Progressy-1.0.0-arm64.dmg
```

If `spctl` says `source=Notarized Developer ID`, a downloaded copy opens with a plain double-click.

## Windows signing (optional)

Add to `electron-builder.json`:

```json
"win": {
  "certificateFile": "path/to/certificate.pfx",
  "certificatePassword": "…"
}
```

Prefer environment variables (`CSC_LINK`, `CSC_KEY_PASSWORD`) over putting a password in a file that
is committed.

## Development

```bash
npm run dev                   # vite + electron, hot reload
PROGRESSY_DEMO=1 npm start    # fake runs, to work on the cards without waiting for CI
PROGRESSY_VERBOSE=1 npm start # log every poll: repos swept, how many were unchanged, runs tracked
```

`PROGRESSY_DEMO=1` seeds a few fake workflow runs that move through queued → running → passed and
failed, so the popup, the animations and the auto-dismiss can all be checked in about 40 seconds.

To try the first-run experience without touching your real settings, point Electron at a scratch
profile:

```bash
./node_modules/.bin/electron . --user-data-dir=/tmp/progressy-test
```
