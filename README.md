# Harmony VPK Tool
A tauri-based app for unpacking VPK files.

Super-fast and made with ♥

----

## Why use Harmony VPK Tool over cra0's VPKTool?
It's over 4x faster and looks nicer

![Unpacking englishclient_mp_smugglers_cove.bsp.pak000_dir.vpk took 34.73s](/screenshots/smugglers_cove_done.png?raw=true)
Unpacking the same VPK took cra0's tool 1:15, over four times as long

## Installing
Builds are generated by GitHub Actions on every commit.

You can also download the [latest release](https://github.com/harmonytf/HarmonyVPKTool/releases/latest)

## Building
1. Run `yarn`
3. Run `yarn tauri build` to build a portable executable and bundled installs for your OS

To build only the executable, instead run `yarn tauri build -b none`.

## Details:
Uses [sourcepak](https://github.com/barnabwhy/sourcepak-rs) to unpack files from VPKs.

sourcepak version: [v0.1.0](https://crates.io/crates/sourcepak/0.1.0)
