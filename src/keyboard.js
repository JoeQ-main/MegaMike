// Note input: the on-screen 44-key keyboard, the computer keyboard and MIDI.
// All three funnel into noteOn/noteOff callbacks.

export const LOWEST = 29; // F1
export const KEY_COUNT = 44; // F1 .. C5
const BLACK = new Set([1, 3, 6, 8, 10]);

const LOWER_ROW = ['z', 's', 'x', 'd', 'c', 'v', 'g', 'b', 'h', 'n', 'j', 'm', ',', 'l', '.', ';', '/'];
const UPPER_ROW = ['q', '2', 'w', '3', 'e', 'r', '5', 't', '6', 'y', '7', 'u', 'i', '9', 'o', '0', 'p'];

export function isBlack(note) {
  return BLACK.has(note % 12);
}

export function buildKeyboard(container, handlers) {
  const keys = new Map();
  let whiteIndex = 0;
  for (let i = 0; i < KEY_COUNT; i++) {
    const note = LOWEST + i;
    const key = document.createElement('div');
    key.className = isBlack(note) ? 'key black' : 'key white';
    key.dataset.note = note;
    if (isBlack(note)) {
      key.style.left = `calc(${whiteIndex} * var(--white-w) - var(--black-w) / 2)`;
    } else {
      whiteIndex++;
    }
    if (note % 12 === 0) {
      const lbl = document.createElement('span');
      lbl.className = 'key-label';
      lbl.textContent = `C${Math.floor(note / 12) - 1}`;
      key.append(lbl);
    }
    container.append(key);
    keys.set(note, key);
  }
  container.style.setProperty('--white-count', whiteIndex);

  // Pointer handling with glissando: moving across keys while held plays them.
  const pointers = new Map(); // pointerId -> note
  const noteAt = (x, y) => {
    const el = document.elementFromPoint(x, y);
    const key = el && el.closest && el.closest('.key');
    return key ? parseInt(key.dataset.note, 10) : null;
  };
  container.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const note = noteAt(e.clientX, e.clientY);
    if (note == null) return;
    e.preventDefault();
    container.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, note);
    handlers.noteOn(note, 'mouse');
  });
  container.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    const note = noteAt(e.clientX, e.clientY);
    const prev = pointers.get(e.pointerId);
    if (note != null && note !== prev) {
      handlers.noteOn(note, 'mouse');
      handlers.noteOff(prev, 'mouse');
      pointers.set(e.pointerId, note);
    }
  });
  const release = (e) => {
    if (!pointers.has(e.pointerId)) return;
    handlers.noteOff(pointers.get(e.pointerId), 'mouse');
    pointers.delete(e.pointerId);
  };
  container.addEventListener('pointerup', release);
  container.addEventListener('pointercancel', release);

  return {
    setPressed(note, on) {
      const key = keys.get(note);
      if (key) key.classList.toggle('pressed', on);
    },
  };
}

export function attachComputerKeyboard(handlers) {
  let octave = 0; // shift in octaves applied to both rows
  const down = new Map(); // key -> note
  const noteFor = (key) => {
    const lower = LOWER_ROW.indexOf(key);
    if (lower >= 0) return 48 + lower + octave * 12;
    const upper = UPPER_ROW.indexOf(key);
    if (upper >= 0) return 60 + upper + octave * 12;
    return null;
  };
  const inField = (e) => ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(e.target.tagName);

  window.addEventListener('keydown', (e) => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || inField(e)) return;
    const key = e.key.toLowerCase();
    if (key === '[' || key === ']') {
      octave = Math.max(-2, Math.min(2, octave + (key === ']' ? 1 : -1)));
      handlers.octaveChanged && handlers.octaveChanged(octave);
      return;
    }
    if (key === 'escape') { handlers.panic && handlers.panic(); return; }
    const note = noteFor(key);
    if (note == null || down.has(key)) return;
    e.preventDefault();
    down.set(key, note);
    handlers.noteOn(note, 'keys');
  });
  window.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    if (!down.has(key)) return;
    handlers.noteOff(down.get(key), 'keys');
    down.delete(key);
  });
  window.addEventListener('blur', () => {
    for (const note of down.values()) handlers.noteOff(note, 'keys');
    down.clear();
  });
  return { getOctave: () => octave };
}

export async function attachMidi(handlers) {
  if (!navigator.requestMIDIAccess) return { available: false };
  let access;
  try {
    access = await navigator.requestMIDIAccess();
  } catch {
    return { available: false };
  }
  const bind = (input) => {
    input.onmidimessage = (e) => {
      const [status, d1, d2] = e.data;
      const cmd = status & 0xf0;
      if (cmd === 0x90 && d2 > 0) handlers.noteOn(d1, 'midi');
      else if (cmd === 0x80 || (cmd === 0x90 && d2 === 0)) handlers.noteOff(d1, 'midi');
      else if (cmd === 0xb0 && d1 === 1) handlers.modWheel && handlers.modWheel(d2 / 127);
      else if (cmd === 0xb0 && (d1 === 120 || d1 === 123)) handlers.panic && handlers.panic();
      else if (cmd === 0xe0) handlers.bend && handlers.bend(((d2 << 7) | d1) / 8192 - 1);
    };
  };
  const names = () => [...access.inputs.values()].map((i) => i.name);
  for (const input of access.inputs.values()) bind(input);
  access.onstatechange = (e) => {
    if (e.port.type === 'input' && e.port.state === 'connected') bind(e.port);
    handlers.midiChanged && handlers.midiChanged(names());
  };
  handlers.midiChanged && handlers.midiChanged(names());
  return { available: true, names };
}
