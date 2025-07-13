// content/content.js

let currentTweetText = '';
let isTwitter = window.location.hostname === 'twitter.com' || window.location.hostname === 'x.com';

function extractTweetText(tweetElement) {
  // Try multiple selectors for tweet text
  const textSelectors = [
    '[data-testid="tweetText"]',
    '[lang] > span',
    '.tweet-text',
    '.css-901oao.css-16my406.r-poiln3.r-bcqeeo.r-qvutc0'
  ];
  
  for (const selector of textSelectors) {
    const textElement = tweetElement.querySelector(selector);
    if (textElement) {
      return textElement.textContent.trim();
    }
  }
  
  return '';
}

function findTweetElements() {
  // Find all tweet containers
  const tweetSelectors = [
    'article[data-testid="tweet"]',
    '[data-testid="tweet"]',
    'article[role="article"]'
  ];
  
  for (const selector of tweetSelectors) {
    const tweets = document.querySelectorAll(selector);
    if (tweets.length > 0) {
      return Array.from(tweets);
    }
  }
  
  return [];
}

function addTweetDostButtons() {
  if (!isTwitter) return;
  
  const tweets = findTweetElements();
  
  tweets.forEach(tweet => {
    if (tweet.querySelector('.tweetdost-btn')) return;
    
    const tweetText = extractTweetText(tweet);
    if (!tweetText) return;
    
    const btn = document.createElement('button');
    btn.textContent = '💬 Reply';
    btn.className = 'tweetdost-btn';
    btn.title = 'Generate AI reply with TweetDost';
    
    btn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      currentTweetText = tweetText;
      chrome.runtime.sendMessage({
        action: 'analyzeTweet',
        tweetText: tweetText
      });
    };
    
    // Find reply button container and add our button
    const replyContainer = tweet.querySelector('[data-testid="reply"]')?.closest('div[role="group"]');
    if (replyContainer) {
      replyContainer.appendChild(btn);
    }
  });
}

function addFloatingButton() {
  if (document.querySelector('.tweetdost-floating-btn')) return;
  
  const floatingBtn = document.createElement('button');
  floatingBtn.textContent = '✂️';
  floatingBtn.className = 'tweetdost-floating-btn';
  floatingBtn.title = 'Crop and analyze tweet';
  
  floatingBtn.onclick = () => {
    chrome.runtime.sendMessage({ action: 'openCropOverlay' });
  };
  
  document.body.appendChild(floatingBtn);
}

function getTweetFromCompose() {
  const composeSelectors = [
    '[data-testid="tweetTextarea_0"]',
    '[data-testid="tweetTextarea_1"]',
    '.public-DraftEditor-content',
    '.notranslate'
  ];
  
  for (const selector of composeSelectors) {
    const textarea = document.querySelector(selector);
    if (textarea) {
      return textarea.textContent || textarea.value || '';
    }
  }
  
  return '';
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getCurrentTweet') {
    const composeTweet = getTweetFromCompose();
    sendResponse({ 
      tweetText: composeTweet || currentTweetText,
      isComposing: !!composeTweet
    });
  }
  
  if (request.action === 'cropSelected') {
    // Handle crop selection
    setTimeout(() => {
      chrome.runtime.sendMessage({
        action: 'captureTab'
      }, (response) => {
        if (response.success) {
          // Process the cropped image
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const img = new Image();
          
          img.onload = () => {
            const coords = request.coords;
            canvas.width = coords.width;
            canvas.height = coords.height;
            
            ctx.drawImage(
              img,
              coords.left,
              coords.top,
              coords.width,
              coords.height,
              0,
              0,
              coords.width,
              coords.height
            );
            
            const croppedDataUrl = canvas.toDataURL('image/png');
            
            // Send to popup for analysis
            chrome.runtime.sendMessage({
              action: 'analyzeCroppedImage',
              imageData: croppedDataUrl,
              coords: coords
            });
          };
          
          img.src = response.dataUrl;
        }
      });
    }, 100);
  }
  
  return true;
});

// Initialize when page loads
function init() {
  addTweetDostButtons();
  addFloatingButton();
}

// Observe DOM changes
const observer = new MutationObserver((mutations) => {
  let shouldUpdate = false;
  
  mutations.forEach((mutation) => {
    if (mutation.type === 'childList') {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1) { // Element node
          if (node.matches && (node.matches('article') || node.querySelector('article'))) {
            shouldUpdate = true;
          }
        }
      });
    }
  });
  
  if (shouldUpdate) {
    setTimeout(addTweetDostButtons, 100);
  }
});

// Start observing
observer.observe(document.body, {
  childList: true,
  subtree: true
});

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Re-initialize on navigation (for SPAs)
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    setTimeout(init, 1000);
  }
}).observe(document, { subtree: true, childList: true });