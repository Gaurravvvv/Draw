import React from 'react';
import { BaseBody, Eyes, Mouths } from './AvatarAssets';

export interface AvatarConfig {
  baseColor: string;
  eyesId: number;
  mouthId: number;
}

interface AvatarPreviewProps {
  config: AvatarConfig;
  size?: number;
  className?: string;
}

export const AvatarPreview: React.FC<AvatarPreviewProps> = ({ config, size = 64, className = '' }) => {
  return (
    <div 
      className={`relative inline-block ${className}`} 
      style={{ width: size, height: size }}
    >
      <svg 
        viewBox="0 0 100 100" 
        width="100%" 
        height="100%" 
        className="absolute top-0 left-0 drop-shadow-sm"
      >
        {/* Base Layer */}
        <BaseBody fill={config.baseColor} />
        
        {/* Eyes Layer */}
        {Eyes[config.eyesId % Eyes.length]}
        
        {/* Mouth Layer */}
        {Mouths[config.mouthId % Mouths.length]}
      </svg>
    </div>
  );
};
