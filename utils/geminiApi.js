export async function getSuggestions(tweet, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
  const vibes = [
    'Make this tweet funnier:',
    'Make this tweet more savage:',
    'Make this tweet more intellectual:'
  ];
  const prompts = vibes.map(vibe => ({
    parts: [{ text: `${vibe} ${tweet}` }]
  }));
  const body = JSON.stringify({ contents: prompts });
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body
  });
  if (!res.ok) throw new Error('Gemini API error: ' + res.statusText);
  const data = await res.json();
  // Gemini returns candidates per prompt
  if (!data.candidates || !Array.isArray(data.candidates)) throw new Error('No suggestions returned.');
  return data.candidates.map(c => c.content.parts[0].text);
} 