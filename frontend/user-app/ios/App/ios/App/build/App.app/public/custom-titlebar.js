const { ipcRenderer } = require('electron');

document.addEventListener('DOMContentLoaded', () => {
  // Botones de control de ventana
  const minimizeButton = document.getElementById('minimize-button');
  const maximizeButton = document.getElementById('maximize-button');
  const closeButton = document.getElementById('close-button');
  
  if (minimizeButton) {
    minimizeButton.addEventListener('click', () => {
      ipcRenderer.send('window-minimize');
    });
  }

  if (maximizeButton) {
    maximizeButton.addEventListener('click', () => {
      ipcRenderer.send('window-maximize');
    });
  }
  
  if (closeButton) {
    closeButton.addEventListener('click', () => {
      ipcRenderer.send('window-close');
    });
  }

  // Detectar si la ventana está maximizada para cambiar el icono
  ipcRenderer.on('window-maximized-status', (event, isMaximized) => {
    if (maximizeButton) {
      maximizeButton.title = isMaximized ? 'Restaurar' : 'Maximizar';
      maximizeButton.innerHTML = isMaximized 
        ? '<svg viewBox="0 0 16 16" width="16" height="16"><path d="M5 4h6v6H5V4z"/></svg>'
        : '<svg viewBox="0 0 16 16" width="16" height="16"><path d="M4 4v8h8V4H4z"/></svg>';
    }
  });
}); 