export interface HitboxDebugState {
  showCarHitboxes: boolean;
}

export interface ChatCommandResult {
  message: string;
  error?: boolean;
}

export function createHitboxDebugState(): HitboxDebugState {
  return { showCarHitboxes: false };
}

/**
 * Interpreta comandos do chat de debug.
 * Ex.: `/hit-boxes cars on` | `/hit-boxes cars off`
 */
export function parseChatCommand(
  raw: string,
  state: HitboxDebugState,
): ChatCommandResult {
  const text = raw.trim();
  if (!text) return { message: 'Mensagem vazia.', error: true };
  if (!text.startsWith('/')) {
    return { message: 'Comandos começam com / (ex.: /hit-boxes cars on).', error: true };
  }

  const parts = text.toLowerCase().split(/\s+/).filter(Boolean);
  if (parts[0] === '/hit-boxes' && parts[1] === 'cars') {
    if (parts[2] === 'on') {
      state.showCarHitboxes = true;
      return { message: 'Hit-boxes de carros: ligadas.' };
    }
    if (parts[2] === 'off') {
      state.showCarHitboxes = false;
      return { message: 'Hit-boxes de carros: desligadas.' };
    }
    return {
      message: 'Uso: /hit-boxes cars on | /hit-boxes cars off',
      error: true,
    };
  }

  return { message: `Comando desconhecido: ${text}`, error: true };
}
