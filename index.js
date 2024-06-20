const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  desktopCapturer,
  Tray,
  Menu,
  powerSaveBlocker,
} = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const net = require("net");
const fs = require("fs");
const { customMedia } = require("electron");

powerSaveBlocker.start("prevent-app-suspension");
powerSaveBlocker.start("prevent-display-sleep");

let store;
let mainWindow;
let tray;
let isWindowClosed = false;
let server;
let latestBitmapData;
async function initializeStore() {
  const { default: Store } = await import("electron-store");
  store = new Store();
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: true,
      backgroundThrottling: false,
    },
  });

  const isConnected = store.get("VantageMDMScreenCastingConnect", false);
  if (isConnected) {
    mainWindow.loadFile("main.html");
  } else {
    mainWindow.loadFile("index.html");
  }

  mainWindow.on("minimize", function (event) {
    event.preventDefault();
    mainWindow.hide();
  });

  mainWindow.on("close", function (event) {
    if (!app.isQuiting) {
      event.preventDefault();
      mainWindow.hide();
    } else {
      isWindowClosed = true;
      // if (server) server.close();
      // if (cppProgram) cppProgram.kill();
    }
  });

  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow.webContents.send("trigger-button-click");
  });

  ipcMain.handle("show-message-box", async (event, options) => {
    const result = await dialog.showMessageBox(
      BrowserWindow.getFocusedWindow(),
      options
    );
    return result;
  });

  ipcMain.on("load-other-html", async (event, htmlFile) => {
    if (mainWindow) {
      mainWindow.loadFile(htmlFile);
    }
  });

  // const exePath = path.join(__dirname, "ScreenCapture.exe");
  // // const exePath = path.join(process.resourcesPath, 'ScreenCapture.exe');

  // if (!fs.existsSync(exePath)) {
  //   console.error(`Executable not found at: ${exePath}`);
  // }

  // const cppProgram = spawn(exePath);

  // cppProgram.stdout.on("data", (data) => {
  //   console.log(`stdout: ${data}`);
  // });

  // cppProgram.stderr.on("data", (data) => {
  //   console.error(`stderr: ${data}`);
  // });

  // cppProgram.on("close", (code) => {
  //   console.log(`C++ program exited with code ${code}`);
  // });

  // const capClient = new net.Socket();
  // const SERVER_PORT = 23456;
  // const SERVER_HOST = "127.0.0.1";

  // capClient.connect(SERVER_PORT, SERVER_HOST, () => {
  //   console.log("Connected to Server");
  // });
  // // server = net.createServer((socket) => {
  // let fileBuffer = Buffer.alloc(0);

  // capClient.on("data", (data) => {
  //   // console.log(`Received ${data.length} bytes from client`);
  //   fileBuffer = Buffer.concat([fileBuffer, data]);

  //   while (fileBuffer.length >= 54) {
  //     const fileSize = fileBuffer.readUInt32LE(2);

  //     if (fileBuffer.length >= fileSize) {
  //       const bmpData = fileBuffer.slice(0, fileSize);
  //       // console.log(bmpData.toString("base64").length);
  //       if (!isWindowClosed && mainWindow) {
  //         mainWindow.webContents.send("get-stream", bmpData.toString("base64"));
  //         latestBitmapData = bmpData.toString("base64");
  //       }

  //       // const fileName = `image_${Date.now()}.bmp`;
  //       // fs.writeFile(fileName, bmpData, (err) => {
  //       //   if (err) {
  //       //     console.error(`Error writing file ${fileName}:`, err);
  //       //   } else {
  //       //     console.log(`File ${fileName} saved successfully.`);
  //       //   }
  //       // });

  //       fileBuffer = fileBuffer.slice(fileSize);
  //     } else {
  //       break;
  //     }
  //   }
  // });
}

app.whenReady().then(async () => {
  await initializeStore();
  createWindow();
  tray = new Tray(path.join(__dirname, "img", "128x128.png"));
  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Show App",
      click: function () {
        mainWindow.show();
      },
    },
    {
      label: "Quit",
      click: function () {
        app.isQuiting = true;
        app.quit();
      },
    },
  ]);

  tray.setToolTip("ScreenShareApp");
  tray.setContextMenu(contextMenu);

  tray.on("click", function () {
    mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    await initializeStore();
    createWindow();
  }
});

ipcMain.handle("setItem", (event, key, value) => {
  store.set(key, value);
});

ipcMain.handle("getItem", (event, key) => {
  return store.get(key);
});

ipcMain.handle("get-bitmap-data", (event) => {
  return latestBitmapData;
});
