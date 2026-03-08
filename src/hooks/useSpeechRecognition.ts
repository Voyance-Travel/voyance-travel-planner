/**
 * useSpeechRecognition Hook
 * 
 * Provides browser-native speech-to-text via the Web Speech API.
 * Falls back gracefully when unsupported.
 */

import { useState, useRef, useCallback, useEffect } from 'react';

interface UseSpeechRecognitionOptions {
  /** Language code, e.g. 'en-US' */
  lang?: string;
  /** Keep listening after each result (continuous mode) */
  continuous?: boolean;
  /** Return interim (partial) results while speaking */
  interimResults?: boolean;
  /** Called with final transcript text */
  onResult?: (transcript: string) => void;
  /** Called with interim transcript while speaking */
  onInterim?: (transcript: string) => void;
  /** Called on any error */
  onError?: (error: string) => void;
  /** Silence timeout in ms before auto-stopping (default 8000) */
  silenceTimeout?: number;
}

// Extend Window for webkit prefix
interface SpeechRecognitionConstructor {
  new (): SpeechRecognition;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

export function useSpeechRecognition(options: UseSpeechRecognitionOptions = {}) {
  const {
    lang = 'en-US',
    continuous = true,
    interimResults = true,
    onResult,
    onInterim,
    onError,
    silenceTimeout = 8000,
  } = options;

  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const stoppedManuallyRef = useRef(false);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setIsSupported(!!getSpeechRecognition());
  }, []);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const startListening = useCallback(() => {
    const SpeechRecognitionClass = getSpeechRecognition();
    if (!SpeechRecognitionClass) {
      onError?.('Speech recognition is not supported in this browser.');
      return;
    }

    // Cleanup any existing instance
    if (recognitionRef.current) {
      recognitionRef.current.abort();
    }
    clearSilenceTimer();

    const recognition = new SpeechRecognitionClass();
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
    recognition.lang = lang;

    stoppedManuallyRef.current = false;

    const resetSilenceTimer = () => {
      clearSilenceTimer();
      if (silenceTimeout > 0) {
        silenceTimerRef.current = setTimeout(() => {
          stoppedManuallyRef.current = true;
          try {
            recognition.stop();
          } catch {
            // already stopped
          }
        }, silenceTimeout);
      }
    };

    recognition.onstart = () => {
      setIsListening(true);
      setInterimTranscript('');
      resetSilenceTimer();
    };

    recognition.onresult = (event: any) => {
      // User is speaking — reset the silence timeout
      resetSilenceTimer();

      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }

      if (interim) {
        setInterimTranscript(interim);
        onInterim?.(interim);
      }

      if (final) {
        setInterimTranscript('');
        onResult?.(final.trim());
      }
    };

    recognition.onerror = (event: any) => {
      const errorType = event.error;
      // 'no-speech' and 'aborted' are not real errors
      if (errorType === 'no-speech' || errorType === 'aborted') {
        setIsListening(false);
        clearSilenceTimer();
        return;
      }
      onError?.(errorType === 'not-allowed' 
        ? 'Microphone access denied. Please allow microphone access in your browser settings.'
        : `Speech recognition error: ${errorType}`
      );
      setIsListening(false);
      clearSilenceTimer();
    };

    recognition.onend = () => {
      clearSilenceTimer();
      setIsListening(false);
      setInterimTranscript('');
      // If continuous and not manually stopped, restart
      if (continuous && !stoppedManuallyRef.current) {
        try {
          recognition.start();
        } catch {
          // Ignore - probably already started
        }
      }
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (e: any) {
      onError?.(e.message || 'Failed to start speech recognition');
    }
  }, [lang, continuous, interimResults, onResult, onInterim, onError, silenceTimeout, clearSilenceTimer]);

  const stopListening = useCallback(() => {
    stoppedManuallyRef.current = true;
    clearSilenceTimer();
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
    setInterimTranscript('');
  }, [clearSilenceTimer]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearSilenceTimer();
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [clearSilenceTimer]);

  return {
    isListening,
    isSupported,
    interimTranscript,
    startListening,
    stopListening,
    toggleListening,
  };
}
