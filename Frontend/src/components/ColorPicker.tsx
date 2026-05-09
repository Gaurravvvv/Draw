import { useState } from 'react';
import { ArrowLeft, Check } from 'lucide-react';
import { playClick } from '../engine/audio';

// ─── Color Families ───────────────────────────────────────────────────────────

const COLOR_FAMILIES = [
  // Reds / Pinks
  { name: 'Red',       preview: '#EF4444', shades: ['#FCA5A5','#F87171','#EF4444','#DC2626','#B91C1C','#7F1D1D'] },
  { name: 'Crimson',   preview: '#DC143C', shades: ['#F4A4B4','#ED5F78','#DC143C','#B01030','#840C24','#580818'] },
  { name: 'Pink',      preview: '#EC4899', shades: ['#F9A8D4','#F472B6','#EC4899','#DB2777','#BE185D','#831843'] },
  { name: 'Rose',      preview: '#F43F5E', shades: ['#FDA4AF','#FB7185','#F43F5E','#E11D48','#BE123C','#881337'] },
  { name: 'Fuchsia',   preview: '#D946EF', shades: ['#F0ABFC','#E879F9','#D946EF','#C026D3','#A21CAF','#701A75'] },
  
  // Purples
  { name: 'Purple',    preview: '#A855F7', shades: ['#D8B4FE','#C084FC','#A855F7','#9333EA','#7E22CE','#581C87'] },
  { name: 'Violet',    preview: '#8B5CF6', shades: ['#C4B5FD','#A78BFA','#8B5CF6','#7C3AED','#6D28D9','#4C1D95'] },
  { name: 'Indigo',    preview: '#6366F1', shades: ['#A5B4FC','#818CF8','#6366F1','#4F46E5','#4338CA','#312E81'] },
  { name: 'Lavender',  preview: '#E6E6FA', shades: ['#F8F8FF','#F0F0FF','#E6E6FA','#D8D8F0','#CACAED','#BCBCE0'] },
  { name: 'Plum',      preview: '#DDA0DD', shades: ['#F4DDF4','#EAC0EA','#DDA0DD','#C684C6','#B068B0','#9A4C9A'] },

  // Blues
  { name: 'Blue',      preview: '#3B82F6', shades: ['#93C5FD','#60A5FA','#3B82F6','#2563EB','#1D4ED8','#1E3A8A'] },
  { name: 'Sky',       preview: '#0EA5E9', shades: ['#7DD3FC','#38BDF8','#0EA5E9','#0284C7','#0369A1','#0C4A6E'] },
  { name: 'Azure',     preview: '#F0FFFF', shades: ['#FFFFFF','#F8FFFF','#F0FFFF','#E0F8F8','#C0E0E0','#A0C8C8'] },
  { name: 'Navy',      preview: '#000080', shades: ['#4D4DA6','#262693','#000080','#000066','#00004D','#000033'] },
  { name: 'Cyan',      preview: '#06B6D4', shades: ['#67E8F9','#22D3EE','#06B6D4','#0891B2','#0E7490','#164E63'] },

  // Greens
  { name: 'Teal',      preview: '#14B8A6', shades: ['#5EEAD4','#2DD4BF','#14B8A6','#0D9488','#0F766E','#114643'] },
  { name: 'Emerald',   preview: '#10B981', shades: ['#6EE7B7','#34D399','#10B981','#059669','#047857','#064E3B'] },
  { name: 'Green',     preview: '#22C55E', shades: ['#86EFAC','#4ADE80','#22C55E','#16A34A','#15803D','#14532D'] },
  { name: 'Lime',      preview: '#84CC16', shades: ['#BEF264','#A3E635','#84CC16','#65A30D','#4D7C0F','#365314'] },
  { name: 'Olive',     preview: '#808000', shades: ['#CCCC66','#A6A639','#808000','#666600','#4D4D00','#333300'] },

  // Yellows / Oranges
  { name: 'Yellow',    preview: '#EAB308', shades: ['#FDE68A','#FACC15','#EAB308','#CA8A04','#A16207','#713F12'] },
  { name: 'Gold',      preview: '#FFD700', shades: ['#FFEDB3','#FFE480','#FFD700','#CCA400','#997700','#664F00'] },
  { name: 'Orange',    preview: '#F97316', shades: ['#FDBA74','#FB923C','#F97316','#EA580C','#C2410C','#7C2D12'] },
  { name: 'Coral',     preview: '#FF7F50', shades: ['#FFC4B3','#FFA280','#FF7F50','#CC5C33','#99401A','#662600'] },
  { name: 'Tomato',    preview: '#FF6347', shades: ['#FFB6A8','#FF8B78','#FF6347','#CC4027','#992714','#661508'] },

  // Browns / Neutrals
  { name: 'Brown',     preview: '#92400E', shades: ['#D4A574','#B8860B','#92400E','#78350F','#5C2D0E','#3B1A06'] },
  { name: 'Sienna',    preview: '#A0522D', shades: ['#D2A38D','#B87456','#A0522D','#7F3E1F','#5E2B13','#3D1A0A'] },
  { name: 'Beige',     preview: '#F5F5DC', shades: ['#FFFFFF','#FBFBEE','#F5F5DC','#E1E1C2','#CDCDA8','#B9B98E'] },
  { name: 'Gray',      preview: '#6B7280', shades: ['#E5E7EB','#D1D5DB','#9CA3AF','#6B7280','#4B5563','#374151'] },
  { name: 'BlackWhite',preview: '#000000', shades: ['#FFFFFF','#E5E7EB','#9CA3AF','#4B5563','#111827','#000000'] },
];

// ─── Component ────────────────────────────────────────────────────────────────

interface ColorPickerProps {
  activeColor: string;
  onColorSelect: (color: string) => void;
  onClose: () => void;
}

export const ColorPicker = ({ activeColor, onColorSelect, onClose }: ColorPickerProps) => {
  const [selectedFamily, setSelectedFamily] = useState<number | null>(null);

  const handleFamilyClick = (index: number) => {
    playClick();
    setSelectedFamily(index);
  };

  const handleShadeClick = (hex: string) => {
    playClick();
    onColorSelect(hex);
    setSelectedFamily(null);
    onClose();
  };

  const handleBack = () => {
    playClick();
    setSelectedFamily(null);
  };

  // Check if a color is currently active (for the checkmark)
  const isActive = (hex: string) => hex.toUpperCase() === activeColor.toUpperCase();

  // Find which family the current color belongs to (for highlighting)
  const activeFamilyIndex = COLOR_FAMILIES.findIndex(f =>
    f.shades.some(s => s.toUpperCase() === activeColor.toUpperCase())
  );

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-3 min-w-[200px] animate-in fade-in">
      {selectedFamily === null ? (
        /* ── Category View ── */
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 px-1">Pick a color</p>
          <div className="grid grid-cols-6 gap-2">
            {COLOR_FAMILIES.map((family, i) => (
              <button
                key={family.name}
                onClick={() => handleFamilyClick(i)}
                className="group relative flex flex-col items-center gap-1"
                title={family.name}
              >
                <div
                  className={`w-7 h-7 rounded-full border-2 transition-all duration-150 hover:scale-110 active:scale-95 ${
                    activeFamilyIndex === i
                      ? 'border-gray-800 ring-2 ring-gray-300'
                      : 'border-transparent hover:border-gray-300'
                  }`}
                  style={{ backgroundColor: family.preview }}
                />
                <span className="text-[8px] text-gray-400 font-medium leading-none opacity-0 group-hover:opacity-100 transition-opacity">
                  {family.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* ── Shade View ── */
        <div>
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={handleBack}
              className="p-1 rounded-md hover:bg-gray-100 text-gray-500 transition-colors"
              title="Back to colors"
            >
              <ArrowLeft size={14} />
            </button>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              {COLOR_FAMILIES[selectedFamily].name} shades
            </p>
          </div>
          <div className="grid grid-cols-6 gap-2">
            {COLOR_FAMILIES[selectedFamily].shades.map((hex) => (
              <button
                key={hex}
                onClick={() => handleShadeClick(hex)}
                className="relative group"
                title={hex}
              >
                <div
                  className={`w-7 h-7 rounded-full border-2 transition-all duration-150 hover:scale-110 active:scale-95 ${
                    isActive(hex)
                      ? 'border-gray-800 ring-2 ring-gray-300'
                      : 'border-transparent hover:border-gray-300'
                  }`}
                  style={{ backgroundColor: hex }}
                >
                  {isActive(hex) && (
                    <Check
                      size={14}
                      className="absolute inset-0 m-auto"
                      style={{ color: hex === '#FFFFFF' || hex === '#FDE68A' || hex === '#D1D5DB' ? '#000' : '#fff' }}
                    />
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
