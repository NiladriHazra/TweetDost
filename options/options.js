document.addEventListener('DOMContentLoaded', () => {
  const apiKeyInput = document.getElementById('apiKeyInput');
  const saveBtn = document.getElementById('saveBtn');
  const status = document.getElementById('status');

  // Load saved key
  chrome.storage.sync.get(['geminiApiKey'], (result) => {
    if (result.geminiApiKey) {
      apiKeyInput.value = result.geminiApiKey;
    }
  });

  saveBtn.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    if (!key) {
      status.textContent = 'API key cannot be empty.';
      status.style.color = 'red';
      return;
    }
    chrome.storage.sync.set({ geminiApiKey: key }, () => {
      status.textContent = 'API key saved!';
      status.style.color = 'green';
      setTimeout(() => status.textContent = '', 1500);
    });
  });
}); 