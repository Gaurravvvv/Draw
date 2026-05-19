/**
 * GameMode — Main orchestrator for "Draw This Shytt" game mode.
 * Routes between all game screens based on gameStore.screen state.
 */

import { useGameStore } from './gameStore';
import { useGameSocket } from './gameSocket';
import { GameLobby } from './GameLobby';
import { WordPicker } from './WordPicker';
import { WaitingScreen } from './WaitingScreen';
import { CountdownScreen } from './CountdownScreen';
import { DrawingScreen } from './DrawingScreen';
import { SpectatorScreen } from './SpectatorScreen';
import { ScoringScreen } from './ScoringScreen';
import { RevealScreen } from './RevealScreen';
import { FinalLeaderboard } from './FinalLeaderboard';
import { Toast } from '../components/Toast';

interface GameModeProps {
  nickname: string;
  onExit: () => void;
}

export function GameMode({ nickname, onExit }: GameModeProps) {
  const { screen, gameToast, gameToastVisible, gameToastType, hideGameToast } = useGameStore();
  const resetGame = useGameStore(s => s.resetGame);

  const {
    createRoom,
    joinRoom,
    updateSettings,
    startGame,
    pickWord,
    sendCanvasSnapshot,
    submitDrawing,
    leaveGame,
  } = useGameSocket();

  const handleExit = () => {
    const roomCode = useGameStore.getState().roomCode;
    if (roomCode) leaveGame(roomCode);
    resetGame();
    onExit();
  };

  const handlePlayAgain = () => {
    // Go back to lobby
    const roomCode = useGameStore.getState().roomCode;
    if (roomCode) leaveGame(roomCode);
    resetGame();
    useGameStore.getState().setScreen('lobby');
  };

  const renderScreen = () => {
    switch (screen) {
      case 'menu':
      case 'lobby':
        return (
          <GameLobby
            nickname={nickname}
            onCreateRoom={createRoom}
            onJoinRoom={joinRoom}
            onUpdateSettings={updateSettings}
            onStartGame={startGame}
            onBack={handleExit}
          />
        );

      case 'picking':
        return <WordPicker onPick={pickWord} />;

      case 'waiting':
        return <WaitingScreen />;

      case 'countdown':
        return <CountdownScreen />;

      case 'drawing':
        return (
          <DrawingScreen
            onSendSnapshot={sendCanvasSnapshot}
            onSubmitDrawing={submitDrawing}
          />
        );

      case 'spectating':
        return <SpectatorScreen />;

      case 'scoring':
        return <ScoringScreen />;

      case 'reveal':
        return <RevealScreen />;

      case 'final':
        return (
          <FinalLeaderboard
            onPlayAgain={handlePlayAgain}
            onExit={handleExit}
          />
        );

      default:
        return (
          <GameLobby
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
        message={gameToast}
        visible={gameToastVisible}
        type={gameToastType}
        onClose={hideGameToast}
      />
    </>
  );
}
