// content/content.js

function injectButton() {
  // Twitter's tweet box selector (may change if Twitter updates UI)
  const tweetBox = document.querySelector('[data-testid="tweetTextarea_0"]')?.closest('div[role="region"]');
  if (!tweetBox || tweetBox.querySelector('.tweetboost-btn')) return;

  const btn = document.createElement('button');
  btn.textContent = '✨ TweetBoost';
  btn.className = 'tweetboost-btn';
  btn.style.marginLeft = '8px';
  btn.style.background = '#1da1f2';
  btn.style.color = '#fff';
  btn.style.border = 'none';
  btn.style.borderRadius = '4px';
  btn.style.padding = '4px 10px';
  btn.style.cursor = 'pointer';
  btn.style.fontSize = '1em';

  btn.onclick = () => {
    chrome.runtime.sendMessage({ action: 'openPopup' });
    // Optionally, focus the extension popup
    alert('Click the TweetBoost extension icon to enhance your tweet!');
  };

  // Insert after the tweet button
  const tweetBtn = tweetBox.querySelector('[data-testid="tweetButtonInline"]');
  if (tweetBtn) {
    tweetBtn.parentNode.insertBefore(btn, tweetBtn.nextSibling);
  } else {
    tweetBox.appendChild(btn);
  }
}

// Observe DOM changes to re-inject if needed
const observer = new MutationObserver(() => {
  injectButton();
});
observer.observe(document.body, { childList: true, subtree: true });

// Initial inject
injectButton(); 