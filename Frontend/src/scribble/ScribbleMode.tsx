/**
 * ScribbleMode — Main orchestrator for the "Scribble" game mode.
 * Routes between all scribble screens based on scribbleStore.screen state.
 */

import { useScribbleStore } from './scribbleStore';
import { useScribbleSocket } from './scribbleSocket';
import { ScribbleLobby } from './ScribbleLobby';
import { ScribbleWordPicker } from './ScribbleWordPicker';
import { ScribbleWaitingScreen } from './ScribbleWaitingScreen';
import { ScribbleCountdownScreen } from './ScribbleCountdownScreen';
import { ScribbleDrawScreen } from './ScribbleDrawScreen';
import { ScribbleGuessScreen } from './ScribbleGuessScreen';
import { ScribbleRevealScreen } from './ScribbleRevealScreen';
import { ScribbleFinalLeaderboard } from './ScribbleFinalLeaderboard';
import { Toast } from '../components/Toast';

interface ScribbleModeProps {
  nickname: string;
  onExit: () => void;
}

export function ScribbleMode({ nickname, onExit }: ScribbleModeProps) {
  const { screen, toast, toastVisible, toastType, hideToast } = useScribbleStore();
  const resetScribble = useScribbleStore(s => s.resetScribble);

  const {
    createRoom,
    joinRoom,
    updateSettings,
    startGame,
    pickWord,
    sendDrawEvent,
    sendGuess,
    leaveScribble,
  } = useScribbleSocket();

  const handleExit = () => {
    const roomCode = useScribbleStore.getState().roomCode;
    if (roomCode) leaveScribble(roomCode);
    resetScribble();
    onExit();
  };

  const handlePlayAgain = () => {
    const roomCode = useScribbleStore.getState().roomCode;
    if (roomCode) leaveScribble(roomCode);
    resetScribble();
    useScribbleStore.getState().setScreen('lobby');
  };

  const renderScreen = () => {
    switch (screen) {
      case 'menu':
      case 'lobby':
        return (
          <ScribbleLobby
            nickname={nickname}
            onCreateRoom={createRoom}
            onJoinRoom={joinRoom}
            onUpdateSettings={updateSettings}
            onStartGame={startGame}
            onBack={handleExit}
          />
        );

      case 'picking':
        return <ScribbleWordPicker onPick={pickWord} />;

      case 'waiting':
        return <ScribbleWaitingScreen />;

      case 'countdown':
        return <ScribbleCountdownScreen />;

      case 'drawing':
        return (
          <ScribbleDrawScreen
            onSendDrawEvent={sendDrawEvent}
          />
        );

      case 'guessing':
        return <ScribbleGuessScreen onSendGuess={sendGuess} />;

      case 'reveal':
        return <ScribbleRevealScreen />;

      case 'final':
        return (
          <ScribbleFinalLeaderboard
            onPlayAgain={handlePlayAgain}
            onExit={handleExit}
          />
        );

      default:
        return (
          <ScribbleLobby
            nickname={nickname}
            onCreateRoom={createRoom}
            onJoinRoom={joinRoom}
            onUpdateSettings={updateSettings}
            onStartGame={startGame}
            onBack={handleExit}
          />
        );
    }
  };

  return (
    <>
      {renderScreen()}
      <Toast
        message={toast}
        visible={toastVisible}
        type={toastType}
        onClose={hideToast}
      />
    </>
  );
}
