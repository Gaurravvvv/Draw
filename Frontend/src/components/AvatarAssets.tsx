import React from 'react';

// Common base viewBox is 100x100

export const BaseBody: React.FC<{ fill: string }> = ({ fill }) => (
  <g id="body">
    {/* Classic Skribbl-style silhouette with thick black outline */}
    <path 
      d="M 15 100 Q 15 75 32 68 A 24 24 0 1 1 68 68 Q 85 75 85 100 Z" 
      fill={fill} 
      stroke="#000" 
      strokeWidth="5" 
      strokeLinejoin="round" 
    />
  </g>
);

export const Eyes = [
  // 0: Normal / Happy
  <g key="eyes-0">
    <ellipse cx="40" cy="40" rx="4" ry="6" fill="#000" />
    <circle cx="41" cy="39" r="1.5" fill="white" />
    <ellipse cx="60" cy="40" rx="4" ry="6" fill="#000" />
    <circle cx="61" cy="39" r="1.5" fill="white" />
  </g>,
  
  // 1: Angry / Determined
  <g key="eyes-1">
    <path d="M 32 35 L 45 40 M 68 35 L 55 40" stroke="#000" strokeWidth="3" strokeLinecap="round" />
    <circle cx="40" cy="45" r="3" fill="#000" />
    <circle cx="60" cy="45" r="3" fill="#000" />
  </g>,

  // 2: Goofy / Derp
  <g key="eyes-2">
    <circle cx="38" cy="40" r="7" fill="white" stroke="#000" strokeWidth="2.5" />
    <circle cx="38" cy="38" r="2" fill="#000" />
    <circle cx="62" cy="40" r="4.5" fill="white" stroke="#000" strokeWidth="2.5" />
    <circle cx="63" cy="41" r="1.5" fill="#000" />
  </g>,

  // 3: Closed / Happy ^ ^
  <g key="eyes-3">
    <path d="M 33 42 Q 40 33 47 42 M 53 42 Q 60 33 67 42" stroke="#000" strokeWidth="3.5" fill="none" strokeLinecap="round" />
  </g>,

  // 4: Surprised / Wide
  <g key="eyes-4">
    <circle cx="40" cy="40" r="8" fill="white" stroke="#000" strokeWidth="2" />
    <circle cx="40" cy="40" r="1.5" fill="#000" />
    <circle cx="60" cy="40" r="8" fill="white" stroke="#000" strokeWidth="2" />
    <circle cx="60" cy="40" r="1.5" fill="#000" />
  </g>,

  // 5: Hearts
  <g key="eyes-5">
    <path d="M 40 45 C 30 35, 40 30, 40 38 C 40 30, 50 35, 40 45 Z" fill="#ef4444" stroke="#000" strokeWidth="1.5" />
    <path d="M 60 45 C 50 35, 60 30, 60 38 C 60 30, 70 35, 60 45 Z" fill="#ef4444" stroke="#000" strokeWidth="1.5" />
  </g>,

  // 6: Stars
  <g key="eyes-6">
    <path d="M 40 33 L 42 38 L 47 38 L 43 41 L 44 46 L 40 43 L 36 46 L 37 41 L 33 38 L 38 38 Z" fill="#fbbf24" stroke="#000" strokeWidth="1.5" />
    <path d="M 60 33 L 62 38 L 67 38 L 63 41 L 64 46 L 60 43 L 56 46 L 57 41 L 53 38 L 58 38 Z" fill="#fbbf24" stroke="#000" strokeWidth="1.5" />
  </g>,

  // 7: Sleepy - -
  <g key="eyes-7">
    <line x1="33" y1="42" x2="45" y2="42" stroke="#000" strokeWidth="3.5" strokeLinecap="round" />
    <line x1="55" y1="42" x2="67" y2="42" stroke="#000" strokeWidth="3.5" strokeLinecap="round" />
  </g>,

  // 8: Crying
  <g key="eyes-8">
    <circle cx="40" cy="40" r="3" fill="#000" />
    <circle cx="60" cy="40" r="3" fill="#000" />
    <path d="M 38 45 Q 40 52 42 45 Z" fill="#3b82f6" />
    <path d="M 58 45 Q 60 52 62 45 Z" fill="#3b82f6" />
  </g>,

  // 9: Cool / Sunglasses
  <g key="eyes-9">
    <path d="M 28 38 L 72 38 L 68 46 Q 60 48 53 43 L 47 43 Q 40 48 32 46 Z" fill="#000" />
    <path d="M 33 40 L 41 40 L 39 44 Z" fill="white" opacity="0.3" />
    <path d="M 55 40 L 63 40 L 61 44 Z" fill="white" opacity="0.3" />
  </g>,

  // 10: Monocle
  <g key="eyes-10">
    <circle cx="40" cy="40" r="3" fill="#000" />
    <circle cx="60" cy="40" r="7" fill="none" stroke="#fbbf24" strokeWidth="2" />
    <circle cx="60" cy="40" r="3" fill="#000" />
    <path d="M 65 45 Q 70 55 60 70" fill="none" stroke="#fbbf24" strokeWidth="1" />
  </g>,

  // 11: Hypnotized (Spirals)
  <g key="eyes-11">
    <path d="M 40 40 m -5 0 a 5 5 0 1 0 10 0 a 4 4 0 1 1 -8 0 a 3 3 0 1 0 6 0" fill="none" stroke="#000" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M 60 40 m -5 0 a 5 5 0 1 0 10 0 a 4 4 0 1 1 -8 0 a 3 3 0 1 0 6 0" fill="none" stroke="#000" strokeWidth="1.5" strokeLinecap="round" />
  </g>,

  // 12: Nerd (Thick Glasses)
  <g key="eyes-12">
    <rect x="30" y="33" width="16" height="14" rx="2" fill="none" stroke="#000" strokeWidth="3" />
    <rect x="54" y="33" width="16" height="14" rx="2" fill="none" stroke="#000" strokeWidth="3" />
    <line x1="46" y1="38" x2="54" y2="38" stroke="#000" strokeWidth="3" />
    <line x1="38" y1="36" x2="38" y2="44" stroke="#000" strokeWidth="2" opacity="0.5" />
    <line x1="62" y1="36" x2="62" y2="44" stroke="#000" strokeWidth="2" opacity="0.5" />
  </g>,

  // 13: Wink
  <g key="eyes-13">
    <circle cx="40" cy="40" r="3" fill="#000" />
    <path d="M 53 40 Q 60 35 67 40" stroke="#000" strokeWidth="3" fill="none" strokeLinecap="round" />
  </g>,

  // 14: Cyclops
  <g key="eyes-14">
    <circle cx="50" cy="38" r="9" fill="white" stroke="#000" strokeWidth="2" />
    <circle cx="50" cy="38" r="3" fill="#000" />
    <circle cx="51" cy="37" r="1" fill="white" />
  </g>,

  // 15: Dizzy (X X)
  <g key="eyes-15">
    <line x1="35" y1="35" x2="45" y2="45" stroke="#000" strokeWidth="2.5" strokeLinecap="round" />
    <line x1="45" y1="35" x2="35" y2="45" stroke="#000" strokeWidth="2.5" strokeLinecap="round" />
    <line x1="55" y1="35" x2="65" y2="45" stroke="#000" strokeWidth="2.5" strokeLinecap="round" />
    <line x1="65" y1="35" x2="55" y2="45" stroke="#000" strokeWidth="2.5" strokeLinecap="round" />
  </g>,

  // 16: Anime / Sparkle
  <g key="eyes-16">
    <ellipse cx="40" cy="40" rx="6" ry="8" fill="#000" />
    <circle cx="42" cy="36" r="2.5" fill="white" />
    <circle cx="38" cy="43" r="1.5" fill="white" />
    <ellipse cx="60" cy="40" rx="6" ry="8" fill="#000" />
    <circle cx="62" cy="36" r="2.5" fill="white" />
    <circle cx="58" cy="43" r="1.5" fill="white" />
  </g>,

  // 17: Zombie
  <g key="eyes-17">
    <circle cx="40" cy="40" r="6" fill="#000" opacity="0.8" />
    <circle cx="40" cy="40" r="2" fill="white" />
    <circle cx="60" cy="40" r="5" fill="none" stroke="#000" strokeWidth="2" />
    <circle cx="60" cy="40" r="1" fill="#ef4444" />
    <line x1="35" y1="48" x2="40" y2="52" stroke="#000" strokeWidth="1" />
  </g>,

  // 18: Alien
  <g key="eyes-18">
    <path d="M 32 40 Q 40 30 45 42 Q 40 45 32 40 Z" fill="#000" />
    <path d="M 68 40 Q 60 30 55 42 Q 60 45 68 40 Z" fill="#000" />
    <circle cx="40" cy="38" r="1" fill="white" />
    <circle cx="60" cy="38" r="1" fill="white" />
  </g>,

  // 19: Suspicious (half-closed)
  <g key="eyes-19">
    <path d="M 33 38 Q 40 36 47 38 L 47 43 Q 40 45 33 43 Z" fill="white" stroke="#000" strokeWidth="2" />
    <circle cx="40" cy="40" r="2" fill="#000" />
    <path d="M 53 38 Q 60 36 67 38 L 67 43 Q 60 45 53 43 Z" fill="white" stroke="#000" strokeWidth="2" />
    <circle cx="60" cy="40" r="2" fill="#000" />
    <line x1="33" y1="38" x2="47" y2="38" stroke="#000" strokeWidth="2" />
    <line x1="53" y1="38" x2="67" y2="38" stroke="#000" strokeWidth="2" />
  </g>
];

export const Mouths = [
  // 0: Simple Smile
  <g key="mouth-0">
    <path d="M 40 60 Q 50 70 60 60" stroke="#000" strokeWidth="3.5" fill="none" strokeLinecap="round" />
  </g>,

  // 1: Open Mouth / Teeth
  <g key="mouth-1">
    <path d="M 38 60 C 38 60, 50 75, 62 60 Z" fill="#000" stroke="#000" strokeWidth="2" strokeLinejoin="round" />
    <path d="M 40 60 L 60 60 L 60 63 L 40 63 Z" fill="white" />
  </g>,

  // 2: Tongue Out
  <g key="mouth-2">
    <path d="M 42 60 Q 50 65 58 60" stroke="#000" strokeWidth="3" fill="none" strokeLinecap="round" />
    <path d="M 47 62 L 47 70 Q 50 75 53 70 L 53 62 Z" fill="#ef4444" stroke="#000" strokeWidth="2" strokeLinejoin="round" />
    <line x1="50" y1="62" x2="50" y2="68" stroke="#000" strokeWidth="1" />
  </g>,

  // 3: Frown (Sad)
  <g key="mouth-3">
    <path d="M 40 68 Q 50 58 60 68" stroke="#000" strokeWidth="3.5" fill="none" strokeLinecap="round" />
  </g>,

  // 4: Surprise (O)
  <g key="mouth-4">
    <circle cx="50" cy="65" r="5" fill="#000" />
  </g>,

  // 5: Zigzag / Nervous
  <g key="mouth-5">
    <path d="M 38 65 L 43 62 L 48 65 L 53 62 L 58 65 L 63 62" stroke="#000" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </g>,

  // 6: Vampire Fangs
  <g key="mouth-6">
    <path d="M 38 60 Q 50 68 62 60" stroke="#000" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    <path d="M 43 64 L 45 68 L 47 65 Z" fill="white" stroke="#000" strokeWidth="1" />
    <path d="M 53 65 L 55 68 L 57 64 Z" fill="white" stroke="#000" strokeWidth="1" />
  </g>,

  // 7: Cat :3
  <g key="mouth-7">
    <path d="M 42 60 Q 46 66 50 62 Q 54 66 58 60" stroke="#000" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </g>,

  // 8: Buck Teeth
  <g key="mouth-8">
    <path d="M 38 60 Q 50 65 62 60" stroke="#000" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    <rect x="46" y="62" width="4" height="6" fill="white" stroke="#000" strokeWidth="1" />
    <rect x="50" y="62" width="4" height="6" fill="white" stroke="#000" strokeWidth="1" />
  </g>,

  // 9: Mustache
  <g key="mouth-9">
    <path d="M 30 65 Q 40 55 50 65 Q 60 55 70 65 Q 65 70 50 68 Q 35 70 30 65 Z" fill="#000" />
    <circle cx="50" cy="72" r="2" fill="#000" />
  </g>,

  // 10: Pout
  <g key="mouth-10">
    <path d="M 47 65 Q 50 62 53 65 Q 50 68 47 65 Z" fill="#000" />
  </g>,

  // 11: Big Grin (D-shape)
  <g key="mouth-11">
    <path d="M 35 60 L 65 60 A 15 15 0 0 1 35 60 Z" fill="#000" />
    <path d="M 38 60 L 62 60 L 62 64 L 38 64 Z" fill="white" />
  </g>,

  // 12: Laughing (with tongue)
  <g key="mouth-12">
    <path d="M 35 60 L 65 60 A 15 15 0 0 1 35 60 Z" fill="#000" />
    <path d="M 45 68 A 5 5 0 0 0 55 68 Z" fill="#ef4444" />
  </g>,

  // 13: Drooling
  <g key="mouth-13">
    <path d="M 45 62 A 5 7 0 0 0 55 62 Z" fill="#000" />
    <path d="M 52 65 L 52 72 Q 52 75 55 75 Q 58 75 58 72 L 58 65 Z" fill="#93c5fd" opacity="0.8" />
  </g>,

  // 14: Kiss
  <g key="mouth-14">
    <path d="M 48 62 Q 45 65 48 68 Q 50 65 48 62 Z" fill="none" stroke="#000" strokeWidth="2" />
    <path d="M 52 62 Q 55 65 52 68 Q 50 65 52 62 Z" fill="none" stroke="#000" strokeWidth="2" />
  </g>,

  // 15: Stitched
  <g key="mouth-15">
    <line x1="35" y1="65" x2="65" y2="65" stroke="#000" strokeWidth="2" />
    <line x1="40" y1="62" x2="40" y2="68" stroke="#000" strokeWidth="2" />
    <line x1="50" y1="62" x2="50" y2="68" stroke="#000" strokeWidth="2" />
    <line x1="60" y1="62" x2="60" y2="68" stroke="#000" strokeWidth="2" />
  </g>,

  // 16: Braces
  <g key="mouth-16">
    <path d="M 35 62 Q 50 72 65 62" stroke="#000" strokeWidth="3" fill="none" strokeLinecap="round" />
    <rect x="42" y="64" width="3" height="3" fill="#94a3b8" />
    <rect x="48" y="66" width="3" height="3" fill="#94a3b8" />
    <rect x="54" y="64" width="3" height="3" fill="#94a3b8" />
    <path d="M 38 65 Q 50 72 62 65" stroke="#cbd5e1" strokeWidth="1" fill="none" />
  </g>,

  // 17: Whistling
  <g key="mouth-17">
    <circle cx="45" cy="65" r="3" fill="#000" />
    <path d="M 55 58 L 55 65 A 2 2 0 1 0 58 65 L 58 58 Z" fill="#000" />
    <line x1="58" y1="58" x2="62" y2="56" stroke="#000" strokeWidth="1.5" />
  </g>,

  // 18: Zipper
  <g key="mouth-18">
    <line x1="35" y1="65" x2="65" y2="65" stroke="#000" strokeWidth="2" strokeLinecap="round" />
    <line x1="38" y1="63" x2="38" y2="67" stroke="#000" strokeWidth="1.5" />
    <line x1="42" y1="63" x2="42" y2="67" stroke="#000" strokeWidth="1.5" />
    <line x1="46" y1="63" x2="46" y2="67" stroke="#000" strokeWidth="1.5" />
    <line x1="50" y1="63" x2="50" y2="67" stroke="#000" strokeWidth="1.5" />
    <line x1="54" y1="63" x2="54" y2="67" stroke="#000" strokeWidth="1.5" />
    <line x1="58" y1="63" x2="58" y2="67" stroke="#000" strokeWidth="1.5" />
    <line x1="62" y1="63" x2="62" y2="67" stroke="#000" strokeWidth="1.5" />
    <rect x="65" y="63" width="4" height="4" fill="#000" rx="1" />
  </g>,

  // 19: Bubblegum
  <g key="mouth-19">
    <path d="M 45 65 A 3 3 0 0 1 55 65" fill="#000" />
    <circle cx="50" cy="65" r="12" fill="#f472b6" stroke="#db2777" strokeWidth="1.5" opacity="0.9" />
    <path d="M 43 60 A 5 5 0 0 1 48 55" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" />
  </g>
];
