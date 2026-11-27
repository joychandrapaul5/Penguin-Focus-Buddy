# Penguin Focus Buddy

A baby penguin that sits on your Windows desktop, closes distracting tabs while you focus, and reminds you to take breaks.

## Install kora (shobar jonno, shohoj)

1. GitHub page er **Releases** theke `Penguin-Focus-Buddy-Setup-1.7.0.exe` download kore double-click korun. Node.js ba terminal lagbe na.
2. "Windows protected your PC" ashle **More info** > **Run anyway** chapun (app e paid signature nei, tai ei warning).
3. Install nijei hobe, app chalu hobe, desktop e shortcut ashbe.
4. Prothombar Settings khulbe. Sekhane lekha 3 ta step e Chrome extension ta ekbar add korun.

## Source code theke chalano (developer)

1. **Node.js** na thakle https://nodejs.org theke LTS version (22.12 ba notun) install korun.
2. Ei folder er **start.bat** double-click korun. Prothombar internet lagbe, koyek minute somoy nibe.
3. Chrome e `chrome://extensions` khulun, upore dane **Developer mode** on korun.
4. **Load unpacked** click kore ei folder er **extension** folder ta select korun.
5. Penguin er **Settings** e "Browser extension connected" lekha ashle sob ready.

## Babohar

- **Focus** chaplei timer shuru hoy.
- Focus er somoy blocked site khulle toolbar er penguin icon theke arekta penguin ber hoy, tab bar dhore hete ese lathi mare (Settings e Warning 0 er beshi dile age warning dibe), tab ta ghurte ghurte ude jay ar close hoy.
- Update er por `chrome://extensions` e extension er reload icon chapun, ar app bondho kore abar chalu korun.
- Lathi marar penguin er jonno extension icon ta toolbar e **pin** kore puzzle icon er thik bame rakhun.
- Lathir jaygata Chrome er window dekhe andaz kora hoy; tab group ba vertical tab thakle ektu edik-odik hote pare.
- Focus sesh hole break shuru hoy ar notification ashe.
- Desktop er penguin boro ba chhoto, duto obosthatei mouse diye dhore sorano jay. Jaygata mone thake.
- Bubble er **–** button e penguin chhoto hoy. Chhoto penguin ba timer e click korle abar boro hoy. Tray menu thekeo kora jay, ar app bondho korle o pochhonder size mone thake.
- Hide, Settings ar Quit: ghori r pashe tray icon e right-click.

## Janar bishoy

- Lathi khawa tab **Ctrl+Shift+T** diye fire ana jay. Fire ana oi tab ta oi focus round e ar lathi khay na; notun kore khulle khay.
- Tab close hole oi page er save na kora lekha harate pare.
- Extension shudhu site er naam (jemon `youtube.com`) apnar PC r bhitorei app ke pathay.
- Incognito te kaj korate extension er Details e **Allow in Incognito** on korun.
- Settings save hoy `data/settings.json` e (installer version e Windows er AppData te).
- Port `47821` babohar hoy.
- App shudhu ei folder er extension ke connect korte dey. `manifest.json` er `key` line ta bodlaben na.
- `extension.pem` (Pack extension korle toiri hoy) gopon chabi. Kauke diben na, upload korben na.

## Developer

```
npm test        # logic test
npm start       # app chalano
npm run dist    # dist/ folder e Windows installer banano
```

| File | Kaj |
|---|---|
| `main.js` | Electron window, tray, notification |
| `src/focus.js` | Timer ar tab close korar niyom |
| `src/server.js` | Extension er sathe local jogajog |
| `src/kicker.js`, `renderer/kick.*` | Lathi marar animation |
| `renderer/` | Penguin ar Settings er design |
| `extension/` | Chrome extension |
