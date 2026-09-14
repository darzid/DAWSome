/**
 * Standard MIDI File parser (SMF format 0/1, PPQ division).
 *
 * Note times are returned in beats (ticks divided by the file's PPQ), so the
 * result is tempo independent and can be dropped straight into a clip.
 */

/**
 * Parse a Standard MIDI File.
 *
 * Each MIDI track is split by channel: every channel that carries at least one
 * note becomes one entry in `tracks`, sharing the MIDI track's name.
 *
 * @param {ArrayBuffer|Uint8Array} buffer raw file bytes
 * @returns {{ format: number, bpm: number|null, tracks: Array<{ name: string, channel: number,
 *   notes: Array<{ pitch: number, start: number, duration: number, velocity: number }> }> }}
 *   `bpm` is the first tempo meta event, or null when the file sets no tempo;
 *   `start` and `duration` are in beats.
 * @throws {Error} when the header is missing, a track chunk is malformed, or the
 *   file uses SMPTE time division.
 */
export function parseMidiFile(buffer) {
  const bytes = new Uint8Array(buffer);
  let pos = 0;
  const u8 = () => bytes[pos++];
  const u16 = () => { const v = (bytes[pos] << 8) | bytes[pos + 1]; pos += 2; return v; };
  const u32 = () => { const v = ((bytes[pos] << 24) | (bytes[pos + 1] << 16) | (bytes[pos + 2] << 8) | bytes[pos + 3]) >>> 0; pos += 4; return v; };
  const str = (n) => { let s = ""; for (let i = 0; i < n; i++) s += String.fromCharCode(bytes[pos++]); return s; };
  const vlq = () => { let v = 0, b; do { b = u8(); v = (v << 7) | (b & 0x7f); } while (b & 0x80); return v; };

  if (str(4) !== "MThd") throw new Error("Not a MIDI file (missing MThd header).");
  const headerLength = u32();
  const format = u16();
  const trackCount = u16();
  const division = u16();
  pos += headerLength - 6;
  if (division & 0x8000) throw new Error("SMPTE time division is not supported.");
  const ppq = division;

  let bpm = null;
  const tracks = [];
  for (let t = 0; t < trackCount && pos < bytes.length; t++) {
    if (str(4) !== "MTrk") throw new Error("Malformed track chunk.");
    const length = u32();
    const end = pos + length;
    let tick = 0, status = 0, name = "";
    const open = new Map();         // channel*128+pitch → { tick, vel }
    const byChannel = new Map();    // channel → notes
    const noteOff = (key, at) => {
      const o = open.get(key);
      if (!o) return;
      open.delete(key);
      byChannel.get(key >> 7).push({
        pitch: key & 127, start: o.tick / ppq, duration: Math.max(at - o.tick, 1) / ppq, velocity: o.vel,
      });
    };
    while (pos < end) {
      tick += vlq();
      let b = u8();
      if (b === 0xff) {                       // meta event
        const type = u8();
        const len = vlq();
        if (type === 0x03 && !name) name = str(len);
        else if (type === 0x51 && bpm === null) {
          bpm = 60000000 / ((bytes[pos] << 16) | (bytes[pos + 1] << 8) | bytes[pos + 2]);
          pos += len;
        } else pos += len;
        continue;
      }
      if (b === 0xf0 || b === 0xf7) { const len = vlq(); pos += len; continue; }   // sysex
      if (b >= 0xf1 && b <= 0xfe) { pos += b === 0xf2 ? 2 : (b === 0xf1 || b === 0xf3) ? 1 : 0; continue; }
      if (b & 0x80) { status = b; b = u8(); }                            // else running status
      const type = status & 0xf0, channel = status & 0x0f;
      const d1 = b;
      const d2 = (type === 0xc0 || type === 0xd0) ? 0 : u8();
      const key = channel * 128 + d1;
      if (type === 0x90 && d2 > 0) {
        if (!byChannel.has(channel)) byChannel.set(channel, []);
        noteOff(key, tick);
        open.set(key, { tick, vel: d2 });
      } else if (type === 0x80 || (type === 0x90 && d2 === 0)) {
        noteOff(key, tick);
      }
    }
    pos = end;
    for (const key of [...open.keys()]) noteOff(key, tick);
    for (const [channel, notes] of byChannel) {
      if (notes.length) tracks.push({ name, channel, notes });
    }
  }
  return { format, bpm, tracks };
}
