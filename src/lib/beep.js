// Alertas sonoros compartilhados para toda leitura de QR / bipagem.
// Usa Web Audio API (sem arquivos externos). Volume "auto": o ganho é
// levado perto do teto do ouvido humano para a faixa usada, garantindo
// que o beep se destaque mesmo em ambiente de obra.

let _ctx = null;
function ctx() {
  if (typeof window === 'undefined') return null;
  if (_ctx) return _ctx;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  _ctx = new Ctx();
  return _ctx;
}

function tone(freq, start, dur, type = 'sine', gainPeak = 0.6) {
  const c = ctx();
  if (!c) return;
  if (c.state === 'suspended') c.resume();
  const o = c.createOscillator();
  const g = c.createGain();
  o.connect(g);
  g.connect(c.destination);
  o.type = type;
  o.frequency.value = freq;
  const t0 = c.currentTime + start;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gainPeak, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.start(t0);
  o.stop(t0 + dur + 0.03);
}

/**
 * Toca um som padronizado.
 * - 'ok'        : bip curto de confirmação (unidade conferida)
 * - 'sucesso'   : fanfarra de conclusão (tudo conferido)
 * - 'dup'       : bip duplo de unidade já conferida
 * - 'erro'      : alarme grave repetido (falta algo / QR inválido)
 */
export function beep(type) {
  try {
    switch (type) {
      case 'ok':
        tone(880, 0, 0.12, 'sine', 0.6);
        tone(1320, 0.11, 0.14, 'sine', 0.6);
        break;
      case 'sucesso':
        tone(660, 0, 0.12, 'sine', 0.6);
        tone(880, 0.12, 0.12, 'sine', 0.6);
        tone(1320, 0.24, 0.2, 'sine', 0.65);
        tone(1760, 0.42, 0.22, 'sine', 0.55);
        break;
      case 'dup':
        tone(440, 0, 0.1, 'square', 0.4);
        tone(440, 0.16, 0.1, 'square', 0.4);
        break;
      case 'erro':
        tone(200, 0, 0.2, 'sawtooth', 0.5);
        tone(160, 0.22, 0.22, 'sawtooth', 0.5);
        tone(130, 0.48, 0.3, 'sawtooth', 0.55);
        break;
      default:
        tone(880, 0, 0.1);
    }
  } catch { /* ignore */ }
}

// Destrava o áudio em navegadores que exigem gesto do usuário.
export function unlockAudio() {
  const c = ctx();
  if (c && c.state === 'suspended') c.resume().catch(() => {});
}