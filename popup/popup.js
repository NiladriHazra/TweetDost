import { getSuggestions } from '../utils/geminiApi.js';

document.addEventListener('DOMContentLoaded', () => {
  const tweetInput = document.getElementById('tweetInput');
  const enhanceBtn = document.getElementById('enhanceBtn');
  const suggestionsDiv = document.getElementById('suggestions');

  // Auto-read tweet from Twitter compose box if on twitter.com
  chrome.tabs && chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (tab && tab.url && tab.url.includes('twitter.com')) {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          // Try to get the tweet text from the compose box
          const textarea = document.querySelector('[data-testid="tweetTextarea_0"]');
          return textarea ? textarea.value : '';
        }
      }, (results) => {
        if (results && results[0] && results[0].result) {
          tweetInput.value = results[0].result;
        }
      });
    }
  });

  enhanceBtn.addEventListener('click', async () => {
    const tweet = tweetInput.value.trim();
    if (!tweet) return;
    suggestionsDiv.innerHTML = '<div>Loading suggestions...</div>';
    chrome.storage.sync.get(['geminiApiKey'], async (result) => {
      const apiKey = result.geminiApiKey;
      if (!apiKey) {
        suggestionsDiv.innerHTML = '<div style="color:red">Please set your Gemini API key in settings.</div>';
        return;
      }
      try {
        const suggestions = await getSuggestions(tweet, apiKey);
        suggestionsDiv.innerHTML = '';
        ['Funnier', 'More Savage', 'More Intellectual'].forEach((vibe, i) => {
          const suggestion = suggestions[i] || '';
          const div = document.createElement('div');
          div.className = 'suggestion';
          div.innerHTML = `<b>${vibe}:</b> <span>${suggestion}</span> <button class='copy-btn' data-idx='${i}'>Copy</button>`;
          suggestionsDiv.appendChild(div);
        });
        suggestionsDiv.querySelectorAll('.copy-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const idx = e.target.getAttribute('data-idx');
            const text = suggestions[idx];
            navigator.clipboard.writeText(text);
            e.target.textContent = 'Copied!';
            setTimeout(() => e.target.textContent = 'Copy', 1000);
          });
        });
      } catch (err) {
        suggestionsDiv.innerHTML = `<div style='color:red'>${err.message || err}</div>`;
      }
    });
  });
}); 