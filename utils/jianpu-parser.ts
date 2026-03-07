import type { MelodyNote } from '~/composables/skill-learning/types';

/**
 * Build the note map for a given key.
 * In jianpu, 1=tonic. E.g. KEY=G means 1=G, 2=A, 3=B, 4=C, 5=D, 6=E, 7=F#
 * We use the major scale intervals: W W H W W W H (2 2 1 2 2 1 2 semitones)
 */
const CHROMATIC = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const MAJOR_INTERVALS = [0, 2, 4, 5, 7, 9, 11]; // semitones from tonic for degrees 1-7

function buildNoteMap(key: string): Record<string, string> {
  // Normalize key: support C, D, Eb, F#, G, Ab, Bb etc.
  const keyNorm = key.replace('b', 'b').replace('#', '#');
  let tonicIndex = CHROMATIC.indexOf(keyNorm);

  // Handle flats: Db=C#, Eb=D#, Gb=F#, Ab=G#, Bb=A#
  if (tonicIndex < 0) {
    const flatMap: Record<string, string> = {
      Db: 'C#', Eb: 'D#', Fb: 'E', Gb: 'F#', Ab: 'G#', Bb: 'A#', Cb: 'B',
    };
    tonicIndex = CHROMATIC.indexOf(flatMap[keyNorm] || '');
  }

  if (tonicIndex < 0) tonicIndex = 0; // fallback to C

  const map: Record<string, string> = {};
  for (let deg = 0; deg < 7; deg++) {
    const semitones = MAJOR_INTERVALS[deg];
    const noteIndex = (tonicIndex + semitones) % 12;
    map[String(deg + 1)] = CHROMATIC[noteIndex];
  }
  return map;
}

export interface JianpuToken {
  type: 'note' | 'rest' | 'extend' | 'bar' | 'dot';
  raw: string;
  note?: string;
  octave?: number;
  degree?: string;
  accidental?: string;
  beatFraction: number;
  melodyIndex?: number;
}

/**
 * Jianpu text notation parser.
 *
 * Header (one per line, before notation):
 *   BPM=120         tempo (default 90)
 *   KEY=G           key signature (default C). Supports C D E F G A B and #/b variants
 *
 * Pitch:
 *   1-7       middle octave (degree 1 = tonic at octave 4)
 *   1'-7'     one octave up
 *   1''-7''   two octaves up
 *   1,-7,     one octave down
 *   1,,-7,,   two octaves down
 *   4#  7b    accidentals (raise/lower a half step from the scale note)
 *
 * Duration (each space-separated token = 1 beat):
 *   3           quarter note (1 beat)
 *   3 -         half note (2 beats)
 *   3 - - -     whole note (4 beats)
 *   3 .         dotted (1.5 beats)
 *   (12)        2 eighth notes sharing 1 beat
 *   (1234)      4 sixteenth notes sharing 1 beat
 *   (012)       rest + 2 notes sharing 1 beat
 *   0           rest (1 beat)
 *
 * Structure:
 *   |           bar line (visual, no time)
 *   newline     same as space
 */
export function parseJianpu(text: string): { tokens: JianpuToken[]; melody: MelodyNote[] } {
  const tokens: JianpuToken[] = [];
  const melody: MelodyNote[] = [];

  // Extract BPM
  let bpm = 90;
  const bpmMatch = text.match(/BPM\s*=\s*(\d+)/i);
  if (bpmMatch) bpm = parseInt(bpmMatch[1]);
  const beatDuration = 60 / bpm;

  // Extract KEY
  let key = 'C';
  const keyMatch = text.match(/KEY\s*=\s*([A-Ga-g][#b]?)/i);
  if (keyMatch) key = keyMatch[1].charAt(0).toUpperCase() + keyMatch[1].slice(1);
  const noteMap = buildNoteMap(key);

  // Determine tonic octave base. In key of C, degree 1 at octave 4 = C4.
  // In key of G, degree 1 at octave 4 = G4. But degrees 4-7 in G major
  // (C D E F#) are higher than G, so they stay in octave 4.
  // Degrees where the note letter is "below" the tonic in chromatic order
  // need to be bumped up one octave to maintain ascending order.
  const tonicIdx = CHROMATIC.indexOf(noteMap['1']);

  function resolveNoteName(degree: string, octaveMark: string, accidental: string): { note: string; octave: number } {
    let octave = 4;
    if (octaveMark.startsWith("'")) octave = 4 + octaveMark.length;
    else if (octaveMark.startsWith(',')) octave = 4 - octaveMark.length;

    let noteName = noteMap[degree];
    if (!noteName) noteName = 'C';

    // Apply accidental on top of the scale note
    if (accidental === '#') {
      const idx = CHROMATIC.indexOf(noteName);
      noteName = CHROMATIC[(idx + 1) % 12];
      if (idx + 1 >= 12) octave++;
    } else if (accidental === 'b') {
      const idx = CHROMATIC.indexOf(noteName);
      noteName = CHROMATIC[(idx - 1 + 12) % 12];
      if (idx - 1 < 0) octave--;
    }

    // Octave correction: in keys other than C, higher degrees may wrap.
    // E.g. in G major: 1=G4, 2=A4, 3=B4, 4=C5, 5=D5, 6=E5, 7=F#5
    // The note index of the degree might be lower than the tonic, meaning it's in the next octave.
    const degreeNoteIdx = CHROMATIC.indexOf(noteMap[degree]);
    if (degreeNoteIdx < tonicIdx) {
      octave += 1;
    }

    return { note: `${noteName}${octave}`, octave };
  }

  // Clean: remove metadata lines, keep notation
  const lines = text.split('\n');
  const notationLines = lines.filter(line => {
    const trimmed = line.trim();
    if (!trimmed) return false;
    if (/^BPM\s*=/i.test(trimmed)) return false;
    if (/^KEY\s*=/i.test(trimmed)) return false;
    if (/^1\s*=\s*[A-G]/i.test(trimmed)) return false;
    if (/^\d\/\d/.test(trimmed)) return false;
    if (/^[\u4e00-\u9fff（）()：:]+\s*$/.test(trimmed)) return false;
    return true;
  });

  // Pre-process: replace 'i' with "1'" (common OCR error: 1 with dot above looks like 'i')
  const notation = notationLines.join(' ').replace(/i/g, "1'");
  const rawTokens = notation.split(/\s+/).filter(Boolean);

  for (const raw of rawTokens) {
    if (raw === '|') {
      tokens.push({ type: 'bar', raw, beatFraction: 0 });
      continue;
    }
    if (raw === '-') {
      tokens.push({ type: 'extend', raw, beatFraction: 1 });
      continue;
    }
    if (raw === '.') {
      tokens.push({ type: 'dot', raw, beatFraction: 0 });
      continue;
    }
    if (raw === '0') {
      tokens.push({ type: 'rest', raw, note: 'rest', beatFraction: 1 });
      continue;
    }

    // Parenthesized group
    const groupMatch = raw.match(/^\((.+)\)$/);
    if (groupMatch) {
      const subItems = parseGroup(groupMatch[1], resolveNoteName);
      assignGroupFractions(subItems);
      for (const item of subItems) {
        tokens.push(item);
      }
      continue;
    }

    // Single note (may return array if dotted, e.g. "6.")
    const parsed = parseSingle(raw, resolveNoteName);
    if (parsed) {
      if (Array.isArray(parsed)) {
        for (const t of parsed) tokens.push(t);
      } else {
        tokens.push({ ...parsed, beatFraction: 1 });
      }
    }
  }

  // Convert to MelodyNote[]
  let time = 0;
  for (const token of tokens) {
    if (token.type === 'note' || token.type === 'rest') {
      const dur = beatDuration * token.beatFraction;
      token.melodyIndex = melody.length;
      melody.push({ note: token.note!, duration: dur, time });
      time += dur;
    } else if (token.type === 'extend') {
      if (melody.length > 0) {
        melody[melody.length - 1].duration += beatDuration * token.beatFraction;
      }
      time += beatDuration * token.beatFraction;
    } else if (token.type === 'dot') {
      if (melody.length > 0) {
        const prev = melody[melody.length - 1];
        const extra = prev.duration * 0.5;
        prev.duration += extra;
        time += extra;
      }
    }
  }

  return { tokens, melody };
}

type NoteResolver = (degree: string, octaveMark: string, accidental: string) => { note: string; octave: number };

function parseSingle(raw: string, resolve: NoteResolver): JianpuToken | JianpuToken[] | null {
  // Support attached dot: "6." = dotted note 6 (1.5 beats)
  const m = raw.match(/^([1-7])('+|,+)?(#|b)?(\.)?$/);
  if (!m) return null;
  const degree = m[1];
  const octaveMark = m[2] || '';
  const accidental = m[3] || '';
  const hasDot = !!m[4];
  const { note, octave } = resolve(degree, octaveMark, accidental);
  const noteToken: JianpuToken = { type: 'note', raw, note, octave, degree, accidental: accidental || undefined, beatFraction: 1 };
  if (hasDot) {
    return [noteToken, { type: 'dot', raw: '.', beatFraction: 0 }];
  }
  return noteToken;
}

function parseGroup(inner: string, resolve: NoteResolver): JianpuToken[] {
  const results: JianpuToken[] = [];
  const regex = /(0)|([1-7])('+|,+)?(#|b)?/g;
  let m;
  while ((m = regex.exec(inner)) !== null) {
    if (m[1] === '0') {
      results.push({ type: 'rest', raw: '0', note: 'rest', beatFraction: 1 });
    } else {
      const degree = m[2];
      const octaveMark = m[3] || '';
      const accidental = m[4] || '';
      const { note, octave } = resolve(degree, octaveMark, accidental);
      results.push({ type: 'note', raw: m[0], note, octave, degree, accidental: accidental || undefined, beatFraction: 1 });
    }
  }
  return results;
}

/**
 * Assign beat fractions to a group of notes sharing 1 beat.
 * - 2 notes: equal (1/2 each) — two eighth notes
 * - 3 notes: 1/4 + 1/4 + 1/2 — two sixteenths + one eighth (most common in Chinese pop)
 * - 4 notes: equal (1/4 each) — four sixteenth notes
 * - 5 notes: 1/4 + 1/4 + 1/4 + 1/4 + skip last as tied — treat as 4+1, last gets remainder
 * - 6 notes: split as 4 sixteenths (1 beat) + 2 eighths (1 beat) → 2 beats total
 * - Other: equal subdivision
 */
function assignGroupFractions(items: JianpuToken[]): { tokens: JianpuToken[]; totalBeats: number } {
  const n = items.length;
  if (n === 3) {
    // 16th + 16th + 8th = 1 beat
    items[0].beatFraction = 0.25;
    items[1].beatFraction = 0.25;
    items[2].beatFraction = 0.5;
    return { tokens: items, totalBeats: 1 };
  }
  if (n === 5) {
    // Likely 4 sixteenths + 1 eighth = 1.5 beats, or treat all as equal in 1 beat
    // Most common: 4 sixteenths (1 beat) + 1 eighth that starts next beat
    // Safest: treat first 4 as sixteenths in 1 beat, last note as separate half-beat
    for (let i = 0; i < 4; i++) items[i].beatFraction = 0.25;
    items[4].beatFraction = 0.5;
    return { tokens: items, totalBeats: 1.5 };
  }
  if (n === 6) {
    // Likely 4 sixteenths (1 beat) + 2 eighths (1 beat) = 2 beats
    for (let i = 0; i < 4; i++) items[i].beatFraction = 0.25;
    items[4].beatFraction = 0.5;
    items[5].beatFraction = 0.5;
    return { tokens: items, totalBeats: 2 };
  }
  // Default: equal subdivision within 1 beat
  const fraction = n > 0 ? 1 / n : 1;
  for (const item of items) item.beatFraction = fraction;
  return { tokens: items, totalBeats: 1 };
}
