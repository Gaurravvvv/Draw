/**
 * Predefined word lists for "Draw This Shytt" game mode.
 * Categorized into Animals, Objects, Food, and Places.
 */

export const WORD_LISTS: Record<string, string[]> = {
  Animals: [
    'cat', 'dog', 'elephant', 'giraffe', 'penguin', 'dolphin', 'butterfly',
    'snake', 'rabbit', 'turtle', 'owl', 'shark', 'horse', 'monkey', 'bear',
    'lion', 'frog', 'eagle', 'octopus', 'whale', 'parrot', 'spider',
    'kangaroo', 'zebra', 'flamingo', 'crocodile', 'bat', 'duck', 'pig',
    'chicken', 'bee', 'crab', 'snail', 'koala', 'panda', 'wolf',
    'deer', 'squirrel', 'jellyfish', 'scorpion',
  ],
  Objects: [
    'umbrella', 'guitar', 'clock', 'lamp', 'scissors', 'bicycle', 'camera',
    'telescope', 'microphone', 'headphones', 'keyboard', 'candle', 'balloon',
    'hammer', 'rocket', 'anchor', 'crown', 'sword', 'trophy', 'diamond',
    'book', 'pencil', 'paintbrush', 'glasses', 'key', 'ladder', 'chair',
    'television', 'phone', 'envelope', 'compass', 'binoculars', 'backpack',
    'skateboard', 'drum', 'violin', 'flag', 'magnet', 'lightbulb', 'parachute',
  ],
  Food: [
    'pizza', 'burger', 'ice cream', 'cake', 'donut', 'apple', 'banana',
    'watermelon', 'sushi', 'taco', 'hotdog', 'cookie', 'popcorn', 'sandwich',
    'cupcake', 'pineapple', 'grapes', 'mushroom', 'cheese', 'lollipop',
    'broccoli', 'carrot', 'avocado', 'cherry', 'strawberry', 'egg',
    'bread', 'pancake', 'corn', 'pepper', 'onion', 'pretzel', 'waffle',
    'pie', 'muffin', 'coconut', 'lemon', 'orange', 'pear', 'noodles',
  ],
  Places: [
    'beach', 'castle', 'volcano', 'lighthouse', 'bridge', 'pyramid',
    'igloo', 'hospital', 'church', 'school', 'library', 'museum',
    'airport', 'island', 'mountain', 'forest', 'desert', 'waterfall',
    'cave', 'farm', 'zoo', 'park', 'stadium', 'cinema', 'restaurant',
    'hotel', 'prison', 'spaceship', 'factory', 'windmill', 'tent',
    'treehouse', 'skyscraper', 'submarine', 'train station', 'garden',
    'temple', 'tower', 'playground', 'campfire',
  ],
};

export const WORD_CATEGORIES = Object.keys(WORD_LISTS);

/**
 * Pick N random unique words from a category
 */
export function getRandomWords(category: string, count: number = 3): string[] {
  const list = WORD_LISTS[category];
  if (!list || list.length < count) {
    // Fallback to Objects if invalid
    const fallback = WORD_LISTS['Objects'];
    const shuffled = [...fallback].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }
  const shuffled = [...list].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
