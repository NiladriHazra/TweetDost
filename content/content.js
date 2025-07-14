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

        const replyButton = tweet.querySelector('[data-testid="reply"]');
        if (!replyButton) return;

        const btn = document.createElement('button');
        btn.innerHTML = '✨'; 
        btn.className = 'tweetdost-btn';
        btn.title = 'Enhance with TweetBoost';

        btn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            currentTweetText = tweetText;

            // Send message to background to open popup and pass tweet text
            chrome.runtime.sendMessage({ 
                action: 'openPopupWithTweet', 
                tweetText: tweetText 
            });
        };

        replyButton.parentNode.insertBefore(btn, replyButton.nextSibling);
    });
}

function showNotification(message) {
  let notification = document.querySelector('.tweetdost-notification');
  if (notification) {
    notification.remove();
  }

  notification = document.createElement('div');
  notification.className = 'tweetdost-notification';
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.classList.add('show');
  }, 10);

  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => {
      if (notification) notification.remove();
    }, 500); // Match fade-out duration
  }, 2500); // Show for 2.5 seconds
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
    if (request.action === 'pasteSuggestion') {
    pasteTextIntoReplyBox(request.text);
    sendResponse({ success: true });
  }

  if (request.action === 'getCurrentTweet') {
    const composeTweet = getTweetFromCompose();
    sendResponse({ 
      tweetText: composeTweet || currentTweetText,
      isComposing: !!composeTweet
    });
  }
  
  
  
  return true;
});

// Initialize when page loads
function init() {
  addTweetDostButtons();
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
function pasteTextIntoReplyBox(text) {
    const pasteLogic = (editor) => {
        editor.focus();
        // This is a more robust way to insert text and trigger React's state update
        document.execCommand('insertText', false, text);
        showNotification('Pasted reply!');
    };

    // Twitter uses different text areas for the main composer and reply modals.
    // We need to find the one that is currently visible.
    const modalEditor = document.querySelector('div[data-testid="tweetTextarea_0_dialog"]');
    const mainEditor = document.querySelector('div[data-testid="tweetTextarea_0"]');

    // Check if the modal editor exists and is visible
    if (modalEditor && (modalEditor.offsetWidth > 0 || modalEditor.offsetHeight > 0)) {
        pasteLogic(modalEditor);
    } 
    // Otherwise, check if the main editor exists and is visible
    else if (mainEditor && (mainEditor.offsetWidth > 0 || mainEditor.offsetHeight > 0)) {
        pasteLogic(mainEditor);
    } 
    // As a final fallback, look for any focused textbox
    else {
        const focusedEditor = document.querySelector('[role="textbox"]:focus');
        if (focusedEditor) {
            pasteLogic(focusedEditor);
        } else {
            console.error('TweetBoost: Could not find an active and visible tweet composer.');
            showNotification('Could not find a reply box. Please make sure it is open.');
        }
    }
}

let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    setTimeout(init, 1000);
  }
}).observe(document, { subtree: true, childList: true });