const fs = require('fs');
require('dotenv').config({ path: '../.env' });
const key = process.env.GEMINI_API_KEY;

async function test() {
  const prompt = "You are a drawing game judge. The player had 60 seconds to draw the word: 'cat'. Look at the image and give it a score from 0 to 100 based on how well it matches the word. 0 = completely wrong or blank canvas. 100 = perfect match. YOU MUST REPLY WITH ONLY A SINGLE INTEGER NUMBER BETWEEN 0 AND 100. NO words, NO explanation, NO punctuation. Just the number.";
  
  // 1x1 transparent PNG base64
  const base64Data = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
  
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: 'image/png',
                  data: base64Data,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.0,
          maxOutputTokens: 8,
          stopSequences: ['\n', '.', ',', ' '],
        },
      }),
    }
  );

  const data = await response.json();
  console.log(JSON.stringify(data, null, 2));
}
test();
