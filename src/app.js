import "./style.css";
import { VOICES, loadModel, speak, isModelReady, unlockAudio } from "./tts.js";

const FULL_ALPHABET = "abcdefghijklmnopqrstuvwxyz".split("");
// Covers the most common short (<=4 letter) words in our dictionary, so a
// younger toddler can still reach real words like "cat", "dog", and "bee".
const SIMPLE_LETTERS = ["a", "o", "e", "r", "i", "n", "s", "b", "k", "t", "d", "c", "g", "l"];
const SIMPLE_MODE_KEY = "spellDiscover.simpleMode";

const typedDisplay = document.getElementById("typedDisplay");
const keyboardEl = document.getElementById("keyboard");
const illustrationEl = document.getElementById("illustration");
const resultTextEl = document.getElementById("resultText");
const definitionTextEl = document.getElementById("definitionText");
const suggestionsEl = document.getElementById("suggestions");
const clearBtn = document.getElementById("clearBtn");
const resetBtn = document.getElementById("resetBtn");
const submitBtn = document.getElementById("submitBtn");
const speakerToggle = document.getElementById("speakerToggle");
const modeToggle = document.getElementById("modeToggle");
const voicePickerEl = document.getElementById("voicePicker");
const loadingOverlay = document.getElementById("loadingOverlay");
const loadingBar = document.getElementById("loadingBar");
const loadingPct = document.getElementById("loadingPct");

let typed = [];
let wordMap = new Map();   // word -> {def, emoji}
let nameSet = new Set();   // lowercase names
let nameDisplay = new Map(); // lowercase -> original casing
let muted = false;
let currentVoice = VOICES[0].id;
let simpleMode = localStorage.getItem(SIMPLE_MODE_KEY) === "true";

let audioCtx = null;
function playTapSound(freq = 520) {
  try {
    if (muted) return;
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.15);
  } catch {
    /* ignore audio failures */
  }
}

function maxTypedLength() {
  return simpleMode ? 6 : 16;
}

function buildKeyboard() {
  keyboardEl.innerHTML = "";
  keyboardEl.classList.toggle("simple", simpleMode);
  const letters = simpleMode ? SIMPLE_LETTERS : FULL_ALPHABET;
  letters.forEach((letter, i) => {
    const btn = document.createElement("button");
    btn.className = "key";
    btn.textContent = letter;
    btn.setAttribute("aria-label", `Letter ${letter}`);
    btn.addEventListener("click", () => {
      unlockAudio();
      addLetter(letter);
      playTapSound(440 + i * 8);
    });
    keyboardEl.appendChild(btn);
  });
}

function setSimpleMode(value) {
  simpleMode = value;
  localStorage.setItem(SIMPLE_MODE_KEY, String(value));
  modeToggle.textContent = simpleMode ? "🔤 Full Keyboard" : "🧒 Simple";
  modeToggle.classList.toggle("active", simpleMode);
  typed = [];
  renderTyped();
  showIdle();
  buildKeyboard();
}

function buildVoicePicker() {
  VOICES.forEach((v, i) => {
    const chip = document.createElement("button");
    chip.className = "voice-chip" + (i === 0 ? " active" : "");
    chip.dataset.voice = v.id;
    chip.innerHTML = `<span class="voice-emoji">${v.emoji}</span><span>${v.label}</span>`;
    chip.addEventListener("click", () => {
      unlockAudio();
      currentVoice = v.id;
      [...voicePickerEl.children].forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      ensureVoiceReady().then(() => {
        speak(`Hi, I'm ${v.label}!`, currentVoice);
      });
    });
    voicePickerEl.appendChild(chip);
  });
}

function addLetter(letter) {
  if (typed.length >= maxTypedLength()) return;
  typed.push(letter);
  renderTyped();
}

function clearLast() {
  typed.pop();
  renderTyped();
  playTapSound(300);
}

function resetAll() {
  typed = [];
  renderTyped();
  showIdle();
  playTapSound(260);
}

function renderTyped() {
  typedDisplay.innerHTML = "";
  typed.forEach((l) => {
    const tile = document.createElement("div");
    tile.className = "typed-letter pop";
    tile.textContent = l;
    typedDisplay.appendChild(tile);
  });
}

function showIdle() {
  illustrationEl.innerHTML = '<span class="placeholder-emoji bounce">✨</span>';
  resultTextEl.textContent = "Spell any word or name!";
  resultTextEl.className = "result-text";
  definitionTextEl.textContent = "";
  suggestionsEl.innerHTML = "";
}

function setLoadingVisible(visible) {
  loadingOverlay.hidden = !visible;
}

function onModelProgress(info) {
  if (!info) return;
  let pct = 0;
  if (typeof info.progress === "number") pct = info.progress;
  else if (info.loaded && info.total) pct = (info.loaded / info.total) * 100;
  pct = Math.max(0, Math.min(100, pct));
  loadingBar.style.width = `${pct}%`;
  if (pct > 0) loadingPct.textContent = `Loading my voice… ${Math.round(pct)}%`;
}

let voiceReadyPromise = null;
function ensureVoiceReady() {
  if (isModelReady()) return Promise.resolve();
  if (voiceReadyPromise) return voiceReadyPromise;
  setLoadingVisible(true);
  voiceReadyPromise = loadModel(onModelProgress)
    .then(() => setLoadingVisible(false))
    .catch((err) => {
      console.error("Failed to load TTS model", err);
      loadingPct.textContent = "Couldn't load voices — playing without sound.";
      setTimeout(() => setLoadingVisible(false), 2000);
    });
  return voiceReadyPromise;
}

function letterCounts(str) {
  const counts = {};
  for (const ch of str) counts[ch] = (counts[ch] || 0) + 1;
  return counts;
}

function isSubsetWord(candidate, typedCounts) {
  const cCounts = letterCounts(candidate);
  for (const ch in cCounts) {
    if ((typedCounts[ch] || 0) < cCounts[ch]) return false;
  }
  return true;
}

function findAnagramSuggestions(typedStr) {
  const typedCounts = letterCounts(typedStr);
  const matches = [];
  for (const word of wordMap.keys()) {
    if (word === typedStr) continue;
    if (word.length < 2) continue;
    if (isSubsetWord(word, typedCounts)) {
      matches.push(word);
    }
  }
  if (simpleMode) {
    // Shorter, simpler words are more achievable for a younger toddler.
    matches.sort((a, b) => a.length - b.length || a.localeCompare(b));
    return matches.slice(0, 3);
  }
  matches.sort((a, b) => b.length - a.length || a.localeCompare(b));
  return matches.slice(0, 5);
}

function showWordResult(word) {
  const entry = wordMap.get(word);
  illustrationEl.innerHTML = `<span class="pop">${entry.emoji}</span>`;
  resultTextEl.textContent = `Yes! "${word}" is a word!`;
  resultTextEl.className = "result-text good";
  definitionTextEl.textContent = entry.def;
  suggestionsEl.innerHTML = "";
  ensureVoiceReady().then(() => {
    speak(`Yes! ${word} is a word.`, currentVoice);
    speak(entry.def, currentVoice);
  });
}

function showNameResult(name) {
  illustrationEl.innerHTML = `<span class="pop">🪪</span><div style="font-size:1.8rem;font-weight:700;margin-top:4px;">${name}</div>`;
  resultTextEl.textContent = `Yes! "${name}" is a name!`;
  resultTextEl.className = "result-text name";
  definitionTextEl.textContent = "";
  suggestionsEl.innerHTML = "";
  ensureVoiceReady().then(() => {
    speak(`Yes! ${name} is a name.`, currentVoice);
  });
}

function showNoMatch(typedStr) {
  const suggestions = findAnagramSuggestions(typedStr);
  illustrationEl.innerHTML = '<span class="placeholder-emoji bounce">🤔</span>';
  resultTextEl.textContent = `"${typedStr}" isn't a word yet.`;
  resultTextEl.className = "result-text none";
  suggestionsEl.innerHTML = "";

  if (suggestions.length === 0) {
    definitionTextEl.textContent = "Try mixing in some different letters!";
    ensureVoiceReady().then(() => {
      speak("That's not a word yet. Try some different letters!", currentVoice);
    });
    return;
  }

  definitionTextEl.textContent = "But look what's hiding in there:";
  ensureVoiceReady().then(() => {
    speak(`That's not a word yet, but ${suggestions[0]} is hiding in there!`, currentVoice);
  });

  suggestions.forEach((word) => {
    const chip = document.createElement("button");
    chip.className = "suggestion-chip";
    chip.textContent = word;
    chip.addEventListener("click", () => {
      typed = word.split("");
      renderTyped();
      showWordResult(word);
    });
    suggestionsEl.appendChild(chip);
  });
}

function submit() {
  if (typed.length === 0) return;
  const str = typed.join("").toLowerCase();

  if (wordMap.has(str)) {
    showWordResult(str);
    return;
  }
  if (nameSet.has(str)) {
    showNameResult(nameDisplay.get(str));
    return;
  }
  showNoMatch(str);
}

function toggleMute() {
  muted = !muted;
  speakerToggle.textContent = muted ? "🔇" : "🔊";
}

async function loadData() {
  const [wordsRes, namesRes] = await Promise.all([
    fetch("data/words.json"),
    fetch("data/names.json"),
  ]);
  const words = await wordsRes.json();
  const names = await namesRes.json();

  words.forEach((w) => {
    wordMap.set(w.word.toLowerCase(), { def: w.def, emoji: w.emoji });
  });
  names.forEach((n) => {
    nameSet.add(n.toLowerCase());
    nameDisplay.set(n.toLowerCase(), n);
  });
}

function init() {
  buildKeyboard();
  buildVoicePicker();
  clearBtn.addEventListener("click", clearLast);
  resetBtn.addEventListener("click", resetAll);
  submitBtn.addEventListener("click", () => {
    unlockAudio();
    playTapSound(600);
    submit();
  });
  speakerToggle.addEventListener("click", toggleMute);
  modeToggle.textContent = simpleMode ? "🔤 Full Keyboard" : "🧒 Simple";
  modeToggle.classList.toggle("active", simpleMode);
  modeToggle.addEventListener("click", () => {
    playTapSound(500);
    setSimpleMode(!simpleMode);
  });
  loadData().catch((err) => {
    console.error("Failed to load word/name data", err);
    resultTextEl.textContent = "Oops! Could not load the dictionary.";
  });
}

init();
