/**
 * Build-time helpers for the Events page (V1.0): lengths and timecodes as
 * they are printed beside the media.
 */
const pad = (n: number, w = 2) => String(Math.max(0, Math.floor(n))).padStart(w, '0');

/** 97.5 -> "1:37" (a film's length). */
export const clockLabel = (s: number) => `${Math.floor(s / 60)}:${pad(s % 60)}`;

/** 50.3 -> "00:50" (a moment in a film, for a chapter). */
export const momentLabel = (s: number) => `${pad(s / 60)}:${pad(s % 60)}`;

/** Broadcast timecode at 24 frames a second: 50.3 -> "00:00:50:07". */
export const timecodeLabel = (s: number) => `${pad(s / 3600)}:${pad((s / 60) % 60)}:${pad(s % 60)}:${pad((s % 1) * 24)}`;
