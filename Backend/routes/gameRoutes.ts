/**
 * Game API Routes — Gemini Vision scoring endpoint
 * POST /api/game/score — Score a drawing against a word using Gemini Vision
 */

import { Router } from 'express';
import { gameRooms } from '../socket/gameHandlers';
import { WORD_CATEGORIES } from '../game/wordLists';

const router = Router();

/**
 * POST /api/game/score
 * Body: { roomCode, playerId, pngBase64 }
 * 
 * Uses Gemini Vision to score drawing accuracy (0-100)
 */
router.post('/score', async (req, res) => {
  try {
    const { roomCode, playerId, pngBase64 } = req.body;

    if (!roomCode || !playerId || !pngBase64) {
      return res.status(400).json({ error: 'Missing required fields: roomCode, playerId, pngBase64' });
    }

    const room = gameRooms[roomCode];
    if (!room) {
      return res.status(404).json({ error: 'Game room not found' });
    }

    const word = room.currentWord;
    if (!word) {
      return res.status(400).json({ error: 'No active word for scoring' });
    }

    const player = room.players.get(playerId);
    if (!player) {
      return res.status(404).json({ error: 'Player not found in room' });
    }

    // Score with Gemini Vision
    const score = await scoreWithGemini(pngBase64, word, room.settings.drawTime);

    // Store the drawing and score
    room.turnDrawings.set(playerId, pngBase64);
    room.turnScores.push({
      playerId,
      nickname: player.nickname,
      score,
      drawingPng: pngBase64,
    });

    res.json({ score, word });
  } catch (err) {
    console.error('[Game] Score endpoint error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Score a drawing using Gemini Vision API
 */
async function scoreWithGemini(pngBase64: string, word: string, drawTime: number): Promise<number> {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  console.log('[Game] Gemini key status:', GEMINI_API_KEY ? `loaded (${GEMINI_API_KEY.slice(0, 8)}...)` : 'MISSING');

  if (!GEMINI_API_KEY) {
    console.warn('[Game] No GEMINI_API_KEY set — returning random score for testing');
    return Math.floor(Math.random() * 60) + 20; // 20-80 for testing
  }

  try {
    // Remove data URL prefix and detect mime type
    const mimeMatch = pngBase64.match(/^data:(image\/\w+);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
    const base64Data = pngBase64.replace(/^data:image\/\w+;base64,/, '');

    const prompt =
      `You are a drawing game judge. The player had ${drawTime} seconds to draw the word: "${word}".` +
      ` Look at the image and give it a score from 0 to 100 based on how well it matches the word.` +
      ` 0 = completely wrong or blank canvas. 100 = perfect match.` +
      ` YOU MUST REPLY WITH ONLY A SINGLE INTEGER NUMBER BETWEEN 0 AND 100. NO words, NO explanation, NO punctuation. Just the number.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
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
                    mimeType: mimeType,
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
      },
    );

    const data = await response.json();
    console.log('[Game] Gemini raw response:', JSON.stringify(data?.candidates?.[0]?.content));

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';

    // Try exact parse first
    let score = parseInt(text, 10);

    // If that fails, extract any number 0-100 from the text (handles "Score: 72" etc.)
    if (isNaN(score)) {
      const match = text.match(/\b(\d{1,3})\b/);
      if (match) score = parseInt(match[1], 10);
    }

    if (isNaN(score) || score < 0 || score > 100) {
      console.warn('[Game] Gemini returned unparseable text:', JSON.stringify(text), '— defaulting to 40');
      return 40;
    }

    console.log(`[Game] Gemini scored "${word}": ${score}`);
    return score;
  } catch (err) {
    console.error('[Game] Gemini API error:', err);
    return Math.floor(Math.random() * 40) + 30; // Fallback 30-70
  }
}

/**
 * GET /api/game/categories
 * Returns available word categories
 */
router.get('/categories', (_req, res) => {
  res.json({ categories: WORD_CATEGORIES });
});

export default router;
