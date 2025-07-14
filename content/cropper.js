(() => {
  // Avoid re-injecting the cropper
  if (window.cropperHasBeenInjected) {
    return;
  }
  window.cropperHasBeenInjected = true;

  const overlay = document.createElement('div');
  overlay.id = 'tweetboost-cropper-overlay';
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100vw';
  overlay.style.height = '100vh';
  overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
  overlay.style.cursor = 'crosshair';
  overlay.style.zIndex = '99999999';
  document.body.appendChild(overlay);

  const instructions = document.createElement('div');
  instructions.id = 'tweetboost-cropper-instructions';
  instructions.textContent = 'Click and drag to select an area. Press Esc to cancel.';
  instructions.style.position = 'fixed';
  instructions.style.top = '20px';
  instructions.style.left = '50%';
  instructions.style.transform = 'translateX(-50%)';
  instructions.style.padding = '10px 20px';
  instructions.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
  instructions.style.color = 'white';
  instructions.style.borderRadius = '20px';
  instructions.style.fontFamily = 'Arial, sans-serif';
  instructions.style.fontSize = '16px';
  instructions.style.zIndex = '100000000';
  overlay.appendChild(instructions);

  let startX, startY, endX, endY;
  let isDrawing = false;
  const selectionBox = document.createElement('div');
  selectionBox.id = 'tweetboost-cropper-selection';
  selectionBox.style.position = 'absolute';
  selectionBox.style.border = '2px dashed #fff';
  selectionBox.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
  selectionBox.style.zIndex = '100000000';
  overlay.appendChild(selectionBox);

  overlay.addEventListener('mousedown', (e) => {
    isDrawing = true;
    startX = e.clientX;
    startY = e.clientY;
    selectionBox.style.left = `${startX}px`;
    selectionBox.style.top = `${startY}px`;
    selectionBox.style.width = '0px';
    selectionBox.style.height = '0px';
  });

  overlay.addEventListener('mousemove', (e) => {
    if (!isDrawing) return;
    endX = e.clientX;
    endY = e.clientY;
    const width = Math.abs(endX - startX);
    const height = Math.abs(endY - startY);
    const left = Math.min(startX, endX);
    const top = Math.min(startY, endY);
    selectionBox.style.width = `${width}px`;
    selectionBox.style.height = `${height}px`;
    selectionBox.style.left = `${left}px`;
    selectionBox.style.top = `${top}px`;
  });

  overlay.addEventListener('mouseup', (e) => {
    if (!isDrawing) return;
    isDrawing = false;
    const rect = {
      x: Math.min(startX, endX),
      y: Math.min(startY, endY),
      width: Math.abs(endX - startX),
      height: Math.abs(endY - startY)
    };

    // Hide overlay before taking screenshot
    overlay.style.display = 'none';

    chrome.runtime.sendMessage({ action: 'captureScreen', rect }, () => {
      // The response from background script will trigger the cleanup via a message
      cleanup();
    });
  });

  const handleKeydown = (e) => {
    if (e.key === 'Escape') {
      cleanup();
    }
  };

  document.addEventListener('keydown', handleKeydown);

  function cleanup() {
    document.removeEventListener('keydown', handleKeydown);
    if (document.body.contains(overlay)) {
      document.body.removeChild(overlay);
    }
    window.cropperHasBeenInjected = false; // Allow re-injection next time
  }
})();
