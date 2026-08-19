// src/utils/beep.js
// A very short tone (under half a second) for reminders - not music, just a
// simple alert sound. Generated directly in the browser, no audio file needed.

export function playReminderBeep() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();

    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = 880; // pleasant, short tone
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

    oscillator.connect(gain);
    gain.connect(ctx.destination);

    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.35);

    oscillator.onended = () => ctx.close();
  } catch {
    // Some browsers block audio before the first user interaction - fail silently
  }
}