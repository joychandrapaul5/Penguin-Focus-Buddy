# Penguin Focus Buddy

A baby penguin that sits on your Windows desktop, closes distracting tabs while you focus, and reminds you to take breaks.

**[Download the latest installer](https://github.com/joychandrapaul5/Penguin-Focus-Buddy/releases/latest)** (Windows 64-bit, Google Chrome)

## Install

1. Download `Penguin-Focus-Buddy-Setup-1.7.0.exe` from the **Releases** page and double-click it. You do not need Node.js or a terminal.
2. If Windows shows "Windows protected your PC", click **More info** > **Run anyway**. The warning appears because the app is not code signed.
3. The app installs itself, starts, and adds a desktop shortcut.
4. On the first run the **Settings** window opens. Connect your browser once, as described below.

## Connect Chrome (one time only)

1. In **Settings**, click **Open extension folder** and copy the address of the folder that opens.
2. Open `chrome://extensions` and turn on **Developer mode** (top right).
3. Click **Load unpacked**, paste the address into the folder picker, and select the folder.
4. **Pin** the penguin extension to the toolbar, just left of the puzzle icon, so the kicking penguin starts from the right place.
5. When Settings shows "Browser extension connected", you are ready.

## Use

- Press **Focus** to start the timer.
- If you open a blocked site during focus, a small penguin comes out of the toolbar icon, walks along the tab bar and kicks the tab away. With a warning time above 0, it warns you first.
- Press **Ctrl+Shift+T** to bring a kicked tab back. That tab is left alone for the rest of the focus round. Opening the site again gets it kicked again.
- When focus ends, a break starts and you get a notification.
- Drag the desktop penguin anywhere with the mouse, big or small. It remembers the spot.
- The **–** button makes the penguin small. Click the small penguin or its timer to make it big again.
- Right-click the tray icon near the clock to show or hide the penguin, open Settings, or quit.

## Good to know

- Closing a tab may lose text you have not saved on that page.
- Sites are blocked only while a focus timer is running.
- The extension sends only the site name (for example `youtube.com`), tab number and window size, and only to the app on your own computer.
- To use it in Incognito, turn on **Allow in Incognito** in the extension's Details.
- The app does not start with Windows and does not update itself.
- Settings are saved in `%APPDATA%\Penguin Focus Buddy\settings.json` (`data/settings.json` when run from source).
- The app uses port `47821`.
- Only this extension may connect to the app. Do not change the `key` line in `extension/manifest.json`.
- An `extension.pem` file (created by Chrome's "Pack extension") is a private key. Never share or upload it.

## Run from source

Install the LTS version of [Node.js](https://nodejs.org) (22.12 or newer), then double-click `start.bat`, or use:

```
npm install     # first time only
npm start       # run the app
npm test        # logic tests
npm run dist    # build the Windows installer into dist/
```

Then load the `extension` folder of the project in Chrome. After changing extension files, press the reload icon in `chrome://extensions`.

| File | Purpose |
|---|---|
| `main.js` | Electron windows, tray, notifications |
| `src/focus.js` | Timer and tab closing rules |
| `src/server.js` | Local link to the extension |
| `src/kicker.js`, `renderer/kick.*` | Kick animation |
| `renderer/` | Penguin and Settings design |
| `extension/` | Chrome extension |

## Guides

- [English guide (PDF)](Penguin-Focus-Buddy-English-Guide.pdf)
- [Bangla guide (PDF)](Penguin-Focus-Buddy-Bangla-Guide.pdf)
