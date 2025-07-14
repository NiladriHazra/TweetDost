// background.js
let tweetForPopup = null;
let croppedImageForPopup = null;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Handle request to open popup with tweet content
    if (request.action === 'openPopupWithTweet') {
        tweetForPopup = request.tweetText;
        chrome.action.openPopup();
        sendResponse({ success: true });
        return true;
    }

    // Handle request from popup to get tweet content
    if (request.action === 'getTweetForPopup') {
        if (tweetForPopup) {
            sendResponse({ tweetText: tweetForPopup });
            tweetForPopup = null; // Clear after sending
        } else {
            sendResponse({ tweetText: null });
        }
        return true;
    }

    // Handle Gemini API calls
    if (request.action === 'callGeminiApi') {
        fetch(request.url, request.options)
            .then(response => response.json())
            .then(data => sendResponse({ success: true, data }))
            .catch(error => sendResponse({ success: false, error: error.toString() }));
        return true; // Indicates asynchronous response
    }

    // Handle request to start cropping
    if (request.action === 'startCrop') {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.scripting.executeScript({
                    target: { tabId: tabs[0].id },
                    files: ['content/cropper.js']
                });
            }
        });
        return true;
    }

    // Handle request to capture the screen with given rectangle
    if (request.action === 'captureScreen') {
        chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
            if (chrome.runtime.lastError || !dataUrl) {
                sendResponse({ success: false, error: 'Failed to capture tab.' });
                return;
            }

            const { x, y, width, height } = request.rect;

            // Use OffscreenCanvas to crop the image in the service worker
            const image = new Image();
            image.onload = () => {
                const canvas = new OffscreenCanvas(width, height);
                const ctx = canvas.getContext('2d');
                ctx.drawImage(image, x, y, width, height, 0, 0, width, height);

                canvas.convertToBlob({ type: 'image/png' }).then(blob => {
                    const reader = new FileReader();
                    reader.onload = () => {
                        croppedImageForPopup = reader.result; // Store the image data
                        chrome.action.openPopup(); // Re-open the popup
                        sendResponse({ success: true }); // Let the content script know it's done
                    };
                    reader.onerror = () => {
                        sendResponse({ success: false, error: 'Failed to read cropped image.' });
                    };
                    reader.readAsDataURL(blob);
                });
            };
            image.onerror = () => {
                sendResponse({ success: false, error: 'Failed to load captured image.' });
            };
            image.src = dataUrl;
        });
        return true; // Indicates asynchronous response
    }

    // Handle request from popup to get cropped image
    if (request.action === 'getCroppedImageForPopup') {
        if (croppedImageForPopup) {
            sendResponse({ imageData: croppedImageForPopup });
            croppedImageForPopup = null; // Clear after sending
        } else {
            sendResponse({ imageData: null });
        }
        return true;
    }
});