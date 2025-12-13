"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const electron_serve_1 = __importDefault(require("electron-serve"));
const path_1 = __importDefault(require("path"));
const appServe = electron_1.app.isPackaged ? (0, electron_serve_1.default)({ directory: path_1.default.join(__dirname, '../out') }) : null;
const createWindow = () => {
    const { width, height } = electron_1.screen.getPrimaryDisplay().workAreaSize;
    const win = new electron_1.BrowserWindow({
        width: Math.min(1280, width),
        height: Math.min(800, height),
        webPreferences: {
            preload: path_1.default.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
        titleBarStyle: 'hiddenInset', // Mac style, on Windows it just hides the title bar mostly or we can frame it
        autoHideMenuBar: true,
    });
    if (electron_1.app.isPackaged && appServe) {
        appServe(win).then(() => {
            win.loadURL('app://-');
        });
    }
    else {
        win.loadURL('http://localhost:3000');
        // win.webContents.openDevTools();
        win.webContents.on('did-fail-load', (e, code, desc) => {
            win.webContents.reloadIgnoringCache();
        });
    }
};
electron_1.app.on('ready', () => {
    createWindow();
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
electron_1.app.on('activate', () => {
    if (electron_1.BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
