const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');
const isDev = !app.isPackaged;

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      enableRemoteModule: false,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    win.loadURL('http://localhost:3000'); // ⚡️ Carga en modo desarrollo
    win.webContents.openDevTools(); // opcional
  } else {
    win.loadFile(path.join(__dirname, 'build', 'index.html')); // 🛠️ Carga en producción
  }

  return win;
}

const { exec } = require('child_process');
exec('node server/index.js', (err, stdout, stderr) => {
  if (err) console.error('Backend error:', err.message);
  if (stderr) console.error('Backend stderr:', stderr);
  console.log('Backend started:', stdout);
});

app.whenReady().then(() => {
  const mainWindow = createWindow();

  // Configura Content-Security-Policy
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': ["default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';"],
      },
    });
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  // Manejar la impresión de stickers
  ipcMain.on('print-sticker', (event, stickerData) => {
    const printWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        preload: path.join(__dirname, 'public', 'preload.js'), // Usar el mismo preload
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { margin: 0; padding: 10mm; font-family: Arial, sans-serif; font-size: 10px; }
            .sticker { width: 30mm; height: 40mm; border: 1px solid #000; padding: 2mm; }
            .field { margin: 1mm 0; }
          </style>
        </head>
        <body>
          <div class="sticker">
            <div class="field">Ref: ${stickerData.reference}</div>
            <div class="field">Color: ${stickerData.color}</div>
            <div class="field">Talla: ${stickerData.size}</div>
            <div class="field">Código: ${stickerData.barcode}</div>
          </div>
        </body>
      </html>
    `;

    printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

    printWindow.webContents.on('did-finish-load', () => {
      printWindow.webContents.print(
        {
          silent: true,
          printBackground: true,
          deviceName: 'DigitalPOS', // Ajusta según tu impresora
          pageSize: { width: 30, height: 40 }, // En milímetros
        },
        (success, errorType) => {
          if (!success) console.error('Error al imprimir:', errorType);
          printWindow.close();
        }
      );
    });
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});