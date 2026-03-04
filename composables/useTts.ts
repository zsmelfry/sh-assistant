// ===== 平台级 TTS Composable =====
// 使用 Web Speech API，优先选择本地语音引擎
// 参考: french-words/src/services/ttsService.ts

const PREFERRED_FRENCH_VOICES = [
  'Google français',
  'Thomas',
  'Amelie',
  'Amélie',
  'Thomas (Enhanced)',
  'Amélie (Enhanced)',
  'Microsoft Denise Online',
  'Microsoft Sylvie Online',
];

let voiceCache = { voice: null as SpeechSynthesisVoice | null, lang: '', checkedAt: 0 };

function findBestVoice(lang: string): SpeechSynthesisVoice | null {
  const voices = speechSynthesis.getVoices();
  const langPrefix = lang.split('-')[0];
  const langVoices = voices.filter(v => v.lang.startsWith(langPrefix));

  const localVoices = langVoices.filter(v => v.localService);
  const onlineVoices = langVoices.filter(v => !v.localService);

  // French-specific preferred voice matching
  if (langPrefix === 'fr') {
    for (const name of PREFERRED_FRENCH_VOICES) {
      const match = localVoices.find(v => v.name.includes(name));
      if (match) return match;
    }
  }

  if (localVoices.length > 0) return localVoices[0];

  if (langPrefix === 'fr') {
    for (const name of PREFERRED_FRENCH_VOICES) {
      const match = onlineVoices.find(v => v.name.includes(name));
      if (match) return match;
    }
  }

  return langVoices[0] || null;
}

export function useTts() {
  const speaking = ref(false);
  const available = ref(
    typeof window !== 'undefined' && 'speechSynthesis' in window,
  );

  function speak(text: string, lang = 'fr-FR', rate = 0.9): Promise<void> {
    if (!available.value) return Promise.resolve();

    speechSynthesis.cancel();

    return new Promise<void>((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.rate = rate;

      const langPrefix = lang.split('-')[0];
      const now = Date.now();
      if (!voiceCache.voice || voiceCache.lang !== langPrefix || now - voiceCache.checkedAt > 30000) {
        voiceCache = { voice: findBestVoice(lang), lang: langPrefix, checkedAt: now };
      }
      if (voiceCache.voice) {
        utterance.voice = voiceCache.voice;
      }

      speaking.value = true;

      let hasResolved = false;
      const resolveOnce = () => {
        if (!hasResolved) {
          hasResolved = true;
          speaking.value = false;
          resolve();
        }
      };

      utterance.onend = resolveOnce;
      utterance.onerror = () => {
        voiceCache = { voice: null, lang: '', checkedAt: 0 };
        resolveOnce();
      };

      speechSynthesis.speak(utterance);

      // Chrome bug workaround: 10s safety timeout
      setTimeout(resolveOnce, 10000);
    });
  }

  function stop() {
    if (available.value) {
      speechSynthesis.cancel();
      speaking.value = false;
    }
  }

  return {
    speak,
    stop,
    speaking,
    available,
  };
}
