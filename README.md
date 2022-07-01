# Harmony VPK Tool
An electron-based app for unpacking Respawn VPK files.

Super-fast and made with ♥

----

## Why use Harmony VPK Tool over cra0's VPKTool?
It's over 2x faster and looks nicer

![](/screenshots/smugglers_cove_done.png?raw=true)
Unpacking the same VPK took cra0's took 1:15, over twice as long

## Installing
Builds are generated by GitHub Actions on every commit.

You can also download the [latest release](https://github.com/harmonytf/HarmonyVPKTool/releases/latest)

## Building
1. Build [TFVPKTool](https://github.com/barnabwhy/TFVPKTool) and place the contents of the `dist` directory in `tfvpktool` (Building TFVPKTool on linux is currently untested but should be possible)
2. Run `npm install`
3. Run `npm run compile:windows` to build a portable .exe if you are on windows or `npm run compile:linux` to build an AppImage if you are on linux.

## Details:
Uses [TFVPKTool](https://github.com/barnabwhy/TFVPKTool) to unpack files from VPKs.

TFVPKTool version: [v0.2.0](https://github.com/barnabwhy/TFVPKTool/releases/tag/0.2.0)