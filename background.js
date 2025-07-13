// background.js
// Handles background tasks for TweetDost

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'callGeminiApi') {
      fetch(request.url, request.options)
        .then(response => response.json())
        .then(data => sendResponse({ success: true, data }))
        .catch(error => sendResponse({ success: false, error: error.toString() }));
      return true;
    }
    
    if (request.action === 'captureTab') {
      chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
        if (chrome.runtime.lastError) {
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
          sendResponse({ success: true, dataUrl });
        }
      });
      return true;
    }
    
    if (request.action === 'openCropOverlay') {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            func: () => {
              // Create crop overlay
              const overlay = document.createElement('div');
              overlay.id = 'tweetdost-crop-overlay';
              overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background: rgba(0, 0, 0, 0.5);
                z-index: 10000;
                cursor: crosshair;
              `;
              
              const instructions = document.createElement('div');
              instructions.style.cssText = `
                position: absolute;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 10px 20px;
                border-radius: 8px;
                font-family: Arial, sans-serif;
                font-size: 14px;
                backdrop-filter: blur(10px);
              `;
              instructions.textContent = 'Click and drag to select the tweet to analyze';
              
              const selectionBox = document.createElement('div');
              selectionBox.style.cssText = `
                position: absolute;
                border: 2px dashed #1da1f2;
                background: rgba(29, 161, 242, 0.1);
                display: none;
                pointer-events: none;
              `;
              
              overlay.appendChild(instructions);
              overlay.appendChild(selectionBox);
              document.body.appendChild(overlay);
              
              let isSelecting = false;
              let startX, startY;
              
              overlay.addEventListener('mousedown', (e) => {
                isSelecting = true;
                startX = e.clientX;
                startY = e.clientY;
                selectionBox.style.display = 'block';
                selectionBox.style.left = startX + 'px';
                selectionBox.style.top = startY + 'px';
                selectionBox.style.width = '0px';
                selectionBox.style.height = '0px';
              });
              
              overlay.addEventListener('mousemove', (e) => {
                if (!isSelecting) return;
                
                const currentX = e.clientX;
                const currentY = e.clientY;
                
                const left = Math.min(startX, currentX);
                const top = Math.min(startY, currentY);
                const width = Math.abs(currentX - startX);
                const height = Math.abs(currentY - startY);
                
                selectionBox.style.left = left + 'px';
                selectionBox.style.top = top + 'px';
                selectionBox.style.width = width + 'px';
                selectionBox.style.height = height + 'px';
              });
              
              overlay.addEventListener('mouseup', (e) => {
                if (!isSelecting) return;
                
                isSelecting = false;
                const currentX = e.clientX;
                const currentY = e.clientY;
                
                const left = Math.min(startX, currentX);
                const top = Math.min(startY, currentY);
                const width = Math.abs(currentX - startX);
                const height = Math.abs(currentY - startY);
                
                if (width > 50 && height > 50) {
                  // Send crop coordinates to extension
                  chrome.runtime.sendMessage({
                    action: 'cropSelected',
                    coords: { left, top, width, height }
                  });
                }
                
                document.body.removeChild(overlay);
              });
              
              // Cancel on ESC
              document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && overlay.parentNode) {
                  document.body.removeChild(overlay);
                }
              });
            }
          });
        }
      });
      return true;
    }
  });