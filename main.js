const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const fs = require("fs");
const path = require("path");
const { VPK, VPKCopy, VPatcher } = require("./tfvpktool/")

const os = require('os');
const storage = require('electron-json-storage');


function getTextEncoding(buf) {
  var d = buf.subarray(0, 5);

  return d[0] === 0xfe && d[1] === 0xff ? "utf16be" : d[0] === 0xff && d[1] === 0xfe ? "utf16le" : "utf8";
}

// Initialise + read custom.css
const customCSSPath = app.getPath('userData') + "\\custom.css";
if(!fs.existsSync(customCSSPath)) {
  fs.writeFileSync(customCSSPath, "/* Add your own custom CSS to Harmony VPK Tool */\n\n")
}
const customCSS = fs.readFileSync(customCSSPath, "utf8");

var settings = storage.getSync('settings');
if(settings.threadCount == undefined || Number.isNaN(settings.threadCount)) {
  settings.threadCount = Math.max(8, os.cpus().length);
}
if(settings.patchWavs == undefined || typeof settings.patchWavs != 'boolean') {
  settings.patchWavs = true;
}
storage.set('settings', settings);

async function handleVPKOpen(event) {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: "Open VPK File",
    filters: [
        { name: 'VPK Archives', extensions: ['vpk'] },
      ],
    properties: ['openFile']
  })
  if (canceled) {
    return
  } else {
    return filePaths[0]
  }
}
async function handleReadVPKTree(event, vpkPath) {
  let vpk = new VPK(vpkPath);
  vpk.readTree();
  return vpk;
}

let copierCloseFunc = () => {};;

async function handleCopyFiles(event, vpkPath, files) {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: "Select Output Folder",
    properties: ['openDirectory']
  })
  if (canceled)
    return false

  let copier = new VPKCopy(vpkPath, settings.threadCount, settings.patchWavs);

  copier.on("progress", p => {
    mainWindow.webContents.send("copyProgress", p);
  })

  copier.copy(files, filePaths[0]).then(() => {
    mainWindow.webContents.send("copyDone");
    copierCloseFunc();
  })

  copierCloseFunc = () => {
    copier.close();
    copierCloseFunc = () => {};
  }

  return true;
}
async function handleCopyCancel(event) {
  copierCloseFunc();
}

async function handleSelectPatchFile(event) {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: "Select Replacement File",
    properties: ['openFile']
  })
  if (canceled) {
    return
  } else {
    return filePaths[0]
  }
}

async function handleStartPatch(event, vpkPath, files) {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: "Select Output Folder",
    properties: ['openDirectory']
  })
  if (canceled)
    return false
  
  let outDir = filePaths[0].replaceAll("\\", "/") + "/";

  let patcher = new VPatcher(vpkPath);
  
  if(outDir == path.dirname(vpkPath)+"/") {
    if(fs.existsSync(vpkPath+".bak")) {
      let bakIdx = 1;
      while(fs.existsSync(vpkPath+".bak"+bakIdx))
        bakIdx++;
        fs.renameSync(vpkPath, vpkPath+".bak"+bakIdx); 
    } else {
      fs.renameSync(vpkPath, vpkPath+".bak"); 
    }
  }

  for(let file of files) {
    await patcher.addFile(file.inPath, file.outPath);
  }

  await patcher.writeVPK(outDir + vpkPath.split("/").pop());

  return true;
}

async function handlePreviewFile(event, vpkPath, filePath, isText) {
  let vpk = new VPK(vpkPath);
  vpk.readTree();
  let buf = await vpk.readFile(filePath, true);
  vpk.close();

  let outPath = path.join(app.getPath("temp"), "vpkpreview", filePath).replaceAll("\\", "/");
  await fs.promises.mkdir(outPath.substring(0, outPath.lastIndexOf("/")+1), { recursive: true });

  if(isText) {
    await fs.promises.writeFile(outPath, buf, getTextEncoding(buf));
    return { buf: buf.toString(getTextEncoding(buf)), outPath };
  } else {
    await fs.promises.writeFile(outPath, buf);
    return { buf, outPath };
  }
}

async function handleBrowsePreviewFile(event, filePath) {
  let tempPreviewPath = filePath.substring(0, filePath.lastIndexOf("/")+1);
  shell.openPath(tempPreviewPath);
}

async function handleGetSettings(event) {
  settings = storage.getSync('settings', settings);
  return settings;
}
async function handleUpdateSettings(event, newSettings) {
  Object.assign(settings, newSettings)
  storage.set('settings', settings);
}
async function handleGetCustomCSS(event) {
  return customCSS;
}

let mainWindow;
function createWindow() {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    height: 640,
    width: 960,
    minHeight: 640,
    minWidth: 960,
    icon: __dirname + '/img/harmony.ico',
    title: "Harmony VPK Tool",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
    show: false
  });

  mainWindow.setMenu(null);
  
  if(app.commandLine.hasSwitch("dev-tools")) {
    mainWindow.openDevTools();
  }

  mainWindow.on('ready-to-show', function() {
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.loadFile(path.join(__dirname, "index.html"));
}

app.on("ready", () => {
  ipcMain.handle('openVPK', handleVPKOpen)
  ipcMain.handle('readVPKTree', handleReadVPKTree)
  ipcMain.handle('copyFiles', handleCopyFiles)
  ipcMain.handle('copyCancel', handleCopyCancel)
  ipcMain.handle('selectPatchFile', handleSelectPatchFile)
  ipcMain.handle('startPatch', handleStartPatch)
  ipcMain.handle('previewFile', handlePreviewFile)
  ipcMain.handle('browsePreviewFile', handleBrowsePreviewFile)
  ipcMain.handle('getSettings', handleGetSettings)
  ipcMain.handle('updateSettings', handleUpdateSettings)
  ipcMain.handle('getCustomCSS', handleGetCustomCSS)

  createWindow();

  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
