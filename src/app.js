const { app, BrowserWindow, ipcMain, dialog } = require('electron');
var exec = require('child_process').exec;

function createWindow () {
  const window = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    icon: __dirname + "/icon.ico",
    title: "Virtual Gamepad",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      devTools: true,
    }
  })
  
  window.menuBarVisible = false;
  window.loadFile(__dirname + '/view/index.html')
}

app.whenReady().then(() => {
    createWindow()

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    });

    ipcMain.handle('showOpenDialog', async handle => {
        var selected = await dialog.showOpenDialog({ properties: ['openFile'] });
        return selected;
    });

    ipcMain.handle('showSaveDialog', async handle => {
      var selected = await dialog.showSaveDialog();
      return selected;
    });

})

app.on('window-all-closed', function () {
  exec('taskkill /IM "winpy.exe" /F')
    if (process.platform !== 'darwin') app.quit()
});