// Animation Helpers - Meadow Math

/**
 * Play sound effect (if sounds are enabled)
 * @param {string} soundName - Name of sound preset
 */
function playSound(soundName) {
  // Check if sounds are enabled in settings
  const settings = typeof getSettings === 'function' ? getSettings() : { soundEnabled: true };
  if (!settings.soundEnabled) return;

  try {
    playGeneratedSound(soundName);
  } catch (e) {
    console.error('Error playing sound:', e);
  }
}

let meadowAudioContext = null;

function getMeadowAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;

  if (!meadowAudioContext) {
    meadowAudioContext = new AudioContextClass();
  }

  if (meadowAudioContext.state === 'suspended') {
    meadowAudioContext.resume().catch(() => {});
  }

  return meadowAudioContext;
}

function playTone(context, { frequency, start, duration, type = 'sine', volume = 0.18 }) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const startTime = context.currentTime + start;
  const endTime = startTime + duration;

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startTime);
  gain.gain.setValueAtTime(0.001, startTime);
  gain.gain.exponentialRampToValueAtTime(volume, startTime + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.001, endTime);

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(startTime);
  oscillator.stop(endTime + 0.02);
}

function playGeneratedSound(soundName) {
  const context = getMeadowAudioContext();
  if (!context) return;

  const presets = {
    tap: [
      { frequency: 660, start: 0, duration: 0.055, type: 'triangle', volume: 0.12 }
    ],
    success: [
      { frequency: 523.25, start: 0, duration: 0.11, type: 'sine', volume: 0.12 },
      { frequency: 659.25, start: 0.09, duration: 0.12, type: 'sine', volume: 0.14 },
      { frequency: 783.99, start: 0.19, duration: 0.18, type: 'sine', volume: 0.16 }
    ],
    error: [
      { frequency: 220, start: 0, duration: 0.14, type: 'triangle', volume: 0.13 },
      { frequency: 174.61, start: 0.13, duration: 0.18, type: 'triangle', volume: 0.12 }
    ]
  };

  (presets[soundName] || presets.tap).forEach(tone => playTone(context, tone));
}

function getSpeechLanguage() {
  const lang = window.i18n?.currentLang || document.documentElement.lang || 'en';
  if (lang.startsWith('pt')) return 'pt-BR';
  if (lang.startsWith('vi')) return 'vi-VN';
  return 'en-US';
}

function getPreferredVoice(lang) {
  if (!window.speechSynthesis) return null;

  const voices = window.speechSynthesis.getVoices();
  return voices.find(voice => voice.lang === lang) ||
    voices.find(voice => voice.lang && voice.lang.toLowerCase().startsWith(lang.slice(0, 2).toLowerCase())) ||
    null;
}

function cleanSpeechText(text) {
  return text
    .replace(/[\u{1F000}-\u{1FAFF}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function speakText(text) {
  if (!window.speechSynthesis) return false;

  const cleanedText = cleanSpeechText(text);
  if (!cleanedText) return false;

  window.speechSynthesis.cancel();

  const lang = getSpeechLanguage();
  const utterance = new SpeechSynthesisUtterance(cleanedText);
  utterance.lang = lang;
  utterance.rate = 0.9;
  utterance.pitch = 1.05;

  const voice = getPreferredVoice(lang);
  if (voice) {
    utterance.voice = voice;
  }

  window.speechSynthesis.speak(utterance);
  return utterance;
}

function getActivityNarrationText() {
  const title = document.querySelector('.activity-title')?.textContent || '';
  const instruction = document.querySelector('.activity-instruction')?.textContent || '';
  return [title, instruction].map(cleanSpeechText).filter(Boolean).join('. ');
}

function updateNarrationButton(button, isSpeaking) {
  const icon = button.querySelector('.activity-audio-icon');
  const label = button.querySelector('.activity-audio-label');
  const key = isSpeaking ? 'activity.stopNarration' : 'activity.listenNarration';
  const fallback = isSpeaking ? 'Stop' : 'Listen';
  const text = window.i18n?.t(key);

  if (icon) icon.textContent = isSpeaking ? '■' : '▶';
  if (label) label.textContent = text && text !== key ? text : fallback;
  button.classList.toggle('is-speaking', isSpeaking);
  button.setAttribute('aria-pressed', String(isSpeaking));
}

function initActivityNarration() {
  if (!window.speechSynthesis || document.querySelector('.activity-audio-btn')) return;

  const header = document.querySelector('.activity-header');
  const instruction = document.querySelector('.activity-instruction');
  if (!header || !instruction) return;

  const controls = document.createElement('div');
  controls.className = 'activity-audio-controls';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'activity-audio-btn';
  button.setAttribute('aria-pressed', 'false');
  button.innerHTML = '<span class="activity-audio-icon" aria-hidden="true">▶</span><span class="activity-audio-label">Listen</span>';

  controls.appendChild(button);
  instruction.insertAdjacentElement('afterend', controls);

  button.addEventListener('click', () => {
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      updateNarrationButton(button, false);
      return;
    }

    const utterance = speakText(getActivityNarrationText());
    if (!utterance) return;

    updateNarrationButton(button, true);
    utterance.onend = () => updateNarrationButton(button, false);
    utterance.onerror = () => updateNarrationButton(button, false);
  });

  document.addEventListener('languageChanged', () => {
    window.speechSynthesis.cancel();
    updateNarrationButton(button, false);
  });

  updateNarrationButton(button, false);
}

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    const ready = window.i18n?.ready ? window.i18n.ready() : Promise.resolve();
    ready.then(initActivityNarration);
  }, 0);
});

/**
 * Create sparkle effect at a specific position
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {HTMLElement} container - Container element (defaults to body)
 */
function createSparkle(x, y, container = document.body) {
  const sparkle = document.createElement('div');
  sparkle.innerHTML = '✨';
  sparkle.style.position = 'absolute';
  sparkle.style.left = `${x}px`;
  sparkle.style.top = `${y}px`;
  sparkle.style.fontSize = '24px';
  sparkle.style.pointerEvents = 'none';
  sparkle.style.zIndex = '1000';
  sparkle.classList.add('animate-sparkle');

  container.appendChild(sparkle);

  setTimeout(() => {
    sparkle.remove();
  }, 800);
}

/**
 * Create floating hearts animation
 * @param {HTMLElement} element - Element to emit hearts from
 * @param {number} count - Number of hearts (default: 5)
 */
function createFloatingHearts(element, count = 5) {
  if (!element) return;

  const rect = element.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  for (let i = 0; i < count; i++) {
    const heart = document.createElement('div');
    heart.innerHTML = '❤️';
    heart.style.position = 'fixed';
    heart.style.left = `${centerX + (Math.random() - 0.5) * 50}px`;
    heart.style.top = `${centerY}px`;
    heart.style.fontSize = '20px';
    heart.style.pointerEvents = 'none';
    heart.style.zIndex = '1000';
    heart.style.animation = 'float 2s ease-out forwards';
    heart.style.opacity = '1';

    document.body.appendChild(heart);

    setTimeout(() => {
      heart.remove();
    }, 2000);
  }
}

/**
 * Create star burst animation
 * @param {HTMLElement} element - Element to burst from
 * @param {number} count - Number of stars (default: 8)
 */
function createStarBurst(element, count = 8) {
  if (!element) return;

  const rect = element.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count;
    const distance = 100;

    const star = document.createElement('div');
    star.innerHTML = '⭐';
    star.style.position = 'fixed';
    star.style.left = `${centerX}px`;
    star.style.top = `${centerY}px`;
    star.style.fontSize = '16px';
    star.style.pointerEvents = 'none';
    star.style.zIndex = '1000';

    document.body.appendChild(star);

    // Animate outward
    const endX = centerX + Math.cos(angle) * distance;
    const endY = centerY + Math.sin(angle) * distance;

    star.animate([
      { left: `${centerX}px`, top: `${centerY}px`, opacity: 1 },
      { left: `${endX}px`, top: `${endY}px`, opacity: 0 }
    ], {
      duration: 1000,
      easing: 'ease-out'
    });

    setTimeout(() => {
      star.remove();
    }, 1000);
  }
}

/**
 * Shake element (for wrong answers)
 * @param {HTMLElement} element - Element to shake
 */
function shake(element) {
  if (!element) return;
  wiggle(element); // Use wiggle from utils.js
}

/**
 * Pulse element to draw attention
 * @param {HTMLElement} element - Element to pulse
 */
function pulse(element) {
  if (!element) return;

  element.style.animation = 'none';
  setTimeout(() => {
    element.style.animation = 'pulseGlow 2s ease-in-out infinite';
  }, 10);
}

/**
 * Stop pulsing animation
 * @param {HTMLElement} element - Element to stop pulsing
 */
function stopPulse(element) {
  if (!element) return;
  element.style.animation = 'none';
}

/**
 * Animate number counting up
 * @param {HTMLElement} element - Element containing the number
 * @param {number} start - Start number
 * @param {number} end - End number
 * @param {number} duration - Animation duration in ms (default: 1000)
 */
function animateNumber(element, start, end, duration = 1000) {
  if (!element) return;

  const range = end - start;
  const increment = range / (duration / 16); // 60fps
  let current = start;

  const timer = setInterval(() => {
    current += increment;

    if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
      current = end;
      clearInterval(timer);
    }

    element.textContent = Math.round(current);
  }, 16);
}

/**
 * Fade in element
 * @param {HTMLElement} element - Element to fade in
 * @param {number} duration - Duration in ms (default: 400)
 */
function fadeIn(element, duration = 400) {
  if (!element) return;

  element.style.opacity = '0';
  element.style.display = 'block';

  element.animate([
    { opacity: 0 },
    { opacity: 1 }
  ], {
    duration: duration,
    easing: 'ease-out',
    fill: 'forwards'
  });
}

/**
 * Fade out element
 * @param {HTMLElement} element - Element to fade out
 * @param {number} duration - Duration in ms (default: 400)
 */
function fadeOut(element, duration = 400) {
  if (!element) return;

  element.animate([
    { opacity: 1 },
    { opacity: 0 }
  ], {
    duration: duration,
    easing: 'ease-in',
    fill: 'forwards'
  }).onfinish = () => {
    element.style.display = 'none';
  };
}

/**
 * Show success message with animation
 * @param {string} message - Success message text
 * @param {HTMLElement} container - Container element (optional)
 */
function showSuccessMessage(message, container = document.body) {
  const messageEl = document.createElement('div');
  messageEl.className = 'success-message';
  messageEl.textContent = message;
  messageEl.style.position = 'fixed';
  messageEl.style.top = '50%';
  messageEl.style.left = '50%';
  messageEl.style.transform = 'translate(-50%, -50%)';
  messageEl.style.background = 'linear-gradient(135deg, #A8E6A8 0%, #7BC67E 100%)';
  messageEl.style.color = 'white';
  messageEl.style.padding = '20px 40px';
  messageEl.style.borderRadius = '16px';
  messageEl.style.fontSize = '24px';
  messageEl.style.fontWeight = 'bold';
  messageEl.style.fontFamily = 'Quicksand, sans-serif';
  messageEl.style.boxShadow = '0 10px 25px rgba(0, 0, 0, 0.2)';
  messageEl.style.zIndex = '10000';
  messageEl.style.animation = 'bounceIn 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55)';

  container.appendChild(messageEl);

  // Play success sound
  playSound('success');

  // Create confetti
  if (typeof createConfetti === 'function') {
    createConfetti(container);
  }

  setTimeout(() => {
    fadeOut(messageEl, 400);
    setTimeout(() => messageEl.remove(), 400);
  }, 2000);
}

// Export functions for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    playSound,
    speakText,
    initActivityNarration,
    createSparkle,
    createFloatingHearts,
    createStarBurst,
    shake,
    pulse,
    stopPulse,
    animateNumber,
    fadeIn,
    fadeOut,
    showSuccessMessage
  };
}
