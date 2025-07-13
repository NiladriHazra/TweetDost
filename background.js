// background.js
// Handles background tasks for TweetBoost

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'callGeminiApi') {
    fetch(request.url, request.options)
      .then(response => response.json())
      .then(data => sendResponse({ success: true, data }))
      .catch(error => sendResponse({ success: false, error: error.toString() }));
    return true; // Keep the message channel open for async response
  }
}); 