import React from 'react';
import { AvatarPreview } from './AvatarPreview';
import type { AvatarConfig } from './AvatarPreview';
import { ChevronLeft, ChevronRight, Dices } from 'lucide-react';
import { Eyes, Mouths } from './AvatarAssets';
import { playBloop } from '../engine/audio';

interface AvatarEditorProps {
  config: AvatarConfig;
  onChange: (newConfig: AvatarConfig) => void;
}

const COLORS = [
  '#FFD166', // 1. Yellow
  '#06D6A0', // 2. Mint
  '#118AB2', // 3. Blue
  '#EF476F', // 4. Pink
  '#FF9F1C', // 5. Orange
  '#9D4EDD', // 6. Purple
  '#F8F9FA', // 7. White/Light Gray
  '#073B4C', // 8. Dark Blue
  '#D90429', // 9. Dark Red
  '#FFB703', // 10. Amber
  '#A7C957', // 11. Lime
  '#2A9D8F', // 12. Forest Green
  '#00B4D8', // 13. Light Blue
  '#0077B6', // 14. Deep Ocean Blue
  '#03045E', // 15. Navy
  '#3A0CA3', // 16. Indigo
  '#FF85A2', // 17. Light Pink
  '#F72585', // 18. Hot Pink
  '#7F4F24', // 19. Brown
  '#6C757D'  // 20. Cool Gray
];

export const AvatarEditor: React.FC<AvatarEditorProps> = ({ config, onChange }) => {
  const handleNext = (field: keyof AvatarConfig, max: number) => {
    playBloop();
    if (field === 'baseColor') {
      const idx = COLORS.indexOf(config.baseColor);
      onChange({ ...config, baseColor: COLORS[(idx + 1) % COLORS.length] });
    } else {
      const current = config[field] as number;
      onChange({ ...config, [field]: (current + 1) % max });
    }
  };

  const handlePrev = (field: keyof AvatarConfig, max: number) => {
    playBloop();
    if (field === 'baseColor') {
      const idx = COLORS.indexOf(config.baseColor);
      onChange({ ...config, baseColor: COLORS[(idx - 1 + COLORS.length) % COLORS.length] });
    } else {
      const current = config[field] as number;
      onChange({ ...config, [field]: (current - 1 + max) % max });
    }
  };

  const handleRandomize = () => {
    playBloop();
    onChange({
      baseColor: COLORS[Math.floor(Math.random() * COLORS.length)],
      eyesId: Math.floor(Math.random() * Eyes.length),
      mouthId: Math.floor(Math.random() * Mouths.length),
    });
  };

  return (
    <div className="flex flex-col items-center py-6 px-4 bg-[#1428A0] rounded-lg border-b-4 border-[#0F1E7A] w-full max-w-sm mx-auto shadow-inner relative overflow-hidden">
      
      {/* Subtle Background Pattern (optional, gives that game feel) */}
      <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '16px 16px' }}></div>

      <div className="relative w-full h-48 flex justify-center items-center z-10">
        
        {/* LEFT ARROWS */}
        <div className="absolute left-0 sm:left-4 top-0 bottom-0 flex flex-col justify-between py-2">
          <button type="button" onClick={() => handlePrev('eyesId', Eyes.length)} className="relative flex items-center justify-center w-10 h-10 hover:scale-110 active:scale-95 transition-transform" title="Previous Eyes">
            <ChevronLeft className="absolute text-black" size={40} strokeWidth={6} />
            <ChevronLeft className="absolute text-white" size={40} strokeWidth={3} />
          </button>
          
          <button type="button" onClick={() => handlePrev('baseColor', COLORS.length)} className="relative flex items-center justify-center w-10 h-10 hover:scale-110 active:scale-95 transition-transform" title="Previous Color">
            <ChevronLeft className="absolute text-black" size={40} strokeWidth={6} />
            <ChevronLeft className="absolute text-white" size={40} strokeWidth={3} />
          </button>
          
          <button type="button" onClick={() => handlePrev('mouthId', Mouths.length)} className="relative flex items-center justify-center w-10 h-10 hover:scale-110 active:scale-95 transition-transform" title="Previous Mouth">
            <ChevronLeft className="absolute text-black" size={40} strokeWidth={6} />
            <ChevronLeft className="absolute text-white" size={40} strokeWidth={3} />
          </button>
        </div>

        {/* AVATAR */}
        <div className="relative cursor-pointer hover:scale-105 active:scale-95 transition-transform duration-200" onClick={handleRandomize} title="Click to Randomize!">
           <AvatarPreview config={config} size={150} />
        </div>

        {/* RIGHT ARROWS */}
        <div className="absolute right-0 sm:right-4 top-0 bottom-0 flex flex-col justify-between py-2">
          <button type="button" onClick={() => handleNext('eyesId', Eyes.length)} className="relative flex items-center justify-center w-10 h-10 hover:scale-110 active:scale-95 transition-transform" title="Next Eyes">
            <ChevronRight className="absolute text-black" size={40} strokeWidth={6} />
            <ChevronRight className="absolute text-white" size={40} strokeWidth={3} />
          </button>

          <button type="button" onClick={() => handleNext('baseColor', COLORS.length)} className="relative flex items-center justify-center w-10 h-10 hover:scale-110 active:scale-95 transition-transform" title="Next Color">
            <ChevronRight className="absolute text-black" size={40} strokeWidth={6} />
            <ChevronRight className="absolute text-white" size={40} strokeWidth={3} />
          </button>

          <button type="button" onClick={() => handleNext('mouthId', Mouths.length)} className="relative flex items-center justify-center w-10 h-10 hover:scale-110 active:scale-95 transition-transform" title="Next Mouth">
            <ChevronRight className="absolute text-black" size={40} strokeWidth={6} />
            <ChevronRight className="absolute text-white" size={40} strokeWidth={3} />
          </button>
        </div>

        {/* RANDOMIZE DICE */}
        <button 
          type="button" 
          onClick={handleRandomize} 
          className="absolute right-0 sm:right-4 top-0 relative flex items-center justify-center w-8 h-8 hover:scale-110 active:scale-95 transition-transform text-[#9EABF0] hover:text-white" 
          title="Randomize Look"
        >
          <Dices className="absolute text-black" size={28} strokeWidth={4} />
          <Dices className="absolute text-current" size={28} strokeWidth={2} />
        </button>

      </div>
    </div>
  );
};
