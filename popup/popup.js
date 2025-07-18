let croppedImageData = null;

document.addEventListener('DOMContentLoaded', () => {
    const tweetInput = document.getElementById('tweetInput');
    const enhanceBtn = document.getElementById('enhanceBtn');
    const cropBtn = document.getElementById('cropBtn');
    const suggestionsDiv = document.getElementById('suggestions');
    const charCount = document.getElementById('charCount');
    const imagePreviewContainer = document.getElementById('imagePreviewContainer');
    const imagePreview = document.getElementById('imagePreview');
    const removeImageBtn = document.getElementById('removeImageBtn');
    const container = document.querySelector('.container');
    const apiKeyMessage = document.getElementById('apiKeyMessage');

    // Unified State Loading Logic
    const loadInitialState = async () => {
        // First, check for the API key. This is essential.
        const apiKeyResult = await new Promise(resolve => chrome.storage.sync.get(['geminiApiKey'], resolve));
        if (!apiKeyResult.geminiApiKey) {
            apiKeyMessage.style.display = 'block';
            tweetInput.disabled = true;
            enhanceBtn.disabled = true;
            cropBtn.disabled = true;
            return;
        }

        // The popup's state is determined by a clear priority:
        // 1. A freshly cropped image.
        // 2. A tweet sent from the content script.
        // 3. Saved suggestions from a previous session.

        const imageResponse = await new Promise(resolve => chrome.runtime.sendMessage({ action: 'getCroppedImageForPopup' }, resolve));
        if (imageResponse && imageResponse.imageData) {
            croppedImageData = imageResponse.imageData;
            imagePreview.src = croppedImageData;
            imagePreviewContainer.style.display = 'block';
            tweetInput.placeholder = 'Image selected! Enhance to get suggestions.';
            enhanceBtn.click(); // Auto-enhance the image
            return; // Highest priority handled
        }

        const tweetResponse = await new Promise(resolve => chrome.runtime.sendMessage({ action: 'getTweetForPopup' }, resolve));
        if (tweetResponse && tweetResponse.tweetText) {
            tweetInput.value = tweetResponse.tweetText;
            enhanceBtn.click(); // Auto-enhance the tweet
            return; // Second priority handled
        }

        const sessionResult = await new Promise(resolve => chrome.storage.session.get(['lastSuggestions'], resolve));
        if (sessionResult && sessionResult.lastSuggestions) {
            displaySuggestions(sessionResult.lastSuggestions);
        }
    };

    loadInitialState();

    // 2. Update character count
    tweetInput.addEventListener('input', () => {
        const limit = 400;
        const count = tweetInput.value.length;
        charCount.textContent = `${count}/${limit}`;
    });

    // 3. Handle Enhance button click
    enhanceBtn.addEventListener('click', async () => {
        const text = tweetInput.value.trim();
        if (!text && !croppedImageData) {
            showError('Please write a tweet or crop an image.');
            return;
        }

        // Clear previous suggestions before fetching new ones
        await new Promise(resolve => chrome.storage.session.remove(['lastSuggestions'], resolve));
        showLoading(true);

        const apiKey = await new Promise(resolve => chrome.storage.sync.get(['geminiApiKey'], result => resolve(result.geminiApiKey)));
        
        try {
            const suggestions = await getSuggestions(apiKey, text, croppedImageData);
            // Save new suggestions to session storage
            await new Promise(resolve => chrome.storage.session.set({ lastSuggestions: suggestions }, resolve));
            displaySuggestions(suggestions);
        } catch (error) {
            showError(error.message);
        } finally {
            showLoading(false);
        }
    });

    // 4. Handle Crop button click
    cropBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'startCrop' }, () => window.close());
    });

    // 5. Handle Remove Image button click
    removeImageBtn.addEventListener('click', () => {
        croppedImageData = null;
        imagePreview.removeAttribute('src');
        imagePreviewContainer.style.display = 'none';
        tweetInput.placeholder = '✨ Write your tweet and watch the magic happen...';
    });

    // Helper functions
    function showLoading(isLoading) {
        if (isLoading) {
            suggestionsDiv.innerHTML = `<div class="loading-indicator"></div>`;
            container.classList.add('expanded');
        } 
        enhanceBtn.disabled = isLoading;
    }

    function showError(message) {
        suggestionsDiv.innerHTML = `<div class="error-message">${message}</div>`;
        container.classList.add('expanded');
    }

    function displaySuggestions(suggestions) {
        suggestionsDiv.innerHTML = '';
        if (!suggestions || suggestions.length === 0) {
            showError('Could not generate suggestions.');
            return;
        }

        suggestions.forEach(suggestion => {
            if (!suggestion.vibe || !suggestion.text) return;

            const div = document.createElement('div');
            div.className = 'suggestion';
            div.innerHTML = `
                <div class="suggestion-header">
                    <span class="suggestion-label">${suggestion.vibe}:</span>
                    <button class='copy-btn' title='Copy text'>Copy</button>
                </div>
                <div class="suggestion-text" title='Click to paste'>${suggestion.text}</div>
            `;

            div.querySelector('.suggestion-text').addEventListener('click', () => {
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    if (tabs[0]) {
                        chrome.tabs.sendMessage(tabs[0].id, { action: 'pasteSuggestion', text: suggestion.text });
                    }
                });
            });

            div.querySelector('.copy-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(suggestion.text);
                const btn = e.target;
                btn.textContent = 'Copied!';
                setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
            });

            suggestionsDiv.appendChild(div);
        });

        container.classList.add('expanded');
    }

    async function getSuggestions(apiKey, text, imageData) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;
        
        const vibes = ['Professional', 'Witty', 'Savage', 'Intellectual'];
        const promptContext = text ? `Respond to the following tweet:\n\"${text}\"` : "Respond to the attached image.";
        const prompt = `${promptContext}\nGenerate exactly 4 reply tweets, one for each of the following vibes: ${vibes.join(', ')}. Each reply must embody the specified vibe while directly replying to the original content. Format the output as a numbered list where each item starts with the vibe, a colon, then the reply. Example: '1. Professional: [reply text]'`;

        let contents;
        if (imageData) {
            contents = [{
                role: 'user',
                parts: [
                    { text: prompt },
                    { inline_data: { mime_type: 'image/png', data: imageData.split(',')[1] } }
                ]
            }];
        } else {
            contents = [{ role: 'user', parts: [{ text: prompt }] }];
        }

        const response = await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
                action: 'callGeminiApi',
                url,
                options: {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents })
                }
            }, (res) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(res);
                }
            });
        });

        if (!response.success) {
            throw new Error(response.error || 'API request failed.');
        }

        const candidate = response.data.candidates?.[0];
        if (!candidate || !candidate.content.parts[0].text) {
            throw new Error('Invalid response from Gemini API.');
        }

        const responseText = candidate.content.parts[0].text;
        return responseText.split('\n')
            .map(line => line.trim())
            .filter(line => line)
            .map(line => {
                // Match patterns like "1. Professional: ..." or "**Professional**: ..."
                const match = line.match(/(?:\d+\.\s*)?(?:\*\*)?(\w+)(?:\*\*)?:\s*(.*)/);
                if (match && match[1] && match[2]) {
                    const cleanedText = match[2].trim().replace(/^\*{1,2}/, '').replace(/\*{1,2}$/,'').trim();
                    return { vibe: match[1], text: cleanedText };
                }
                return null;
            })
            .filter(item => item !== null);
    }
});