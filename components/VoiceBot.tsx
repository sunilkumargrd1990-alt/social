import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { createBlob, decode, decodeAudioData } from '../utils/audioUtils';
import { VoiceTranscript } from '../types';

type ConversationStatus = 'idle' | 'connecting' | 'active' | 'error' | 'stopped';

interface VoiceBotProps {
    transcriptions: VoiceTranscript[];
    onHistoryChange: (history: VoiceTranscript[]) => void;
}

const VoiceBot: React.FC<VoiceBotProps> = ({ transcriptions, onHistoryChange }) => {
    const [status, setStatus] = useState<ConversationStatus>('idle');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const sessionPromiseRef = useRef<Promise<any> | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);

    const currentInputTranscriptionRef = useRef('');
    const currentOutputTranscriptionRef = useRef('');
    const nextStartTimeRef = useRef(0);
    const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

    const stopAllAudio = useCallback(() => {
        if (outputAudioContextRef.current) {
            audioSourcesRef.current.forEach(source => {
                source.stop();
            });
            audioSourcesRef.current.clear();
            nextStartTimeRef.current = 0;
        }
    }, []);
    
    const cleanup = useCallback(() => {
        stopAllAudio();

        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
        }
        if (scriptProcessorRef.current) {
            scriptProcessorRef.current.disconnect();
            scriptProcessorRef.current = null;
        }
        if (mediaStreamSourceRef.current) {
            mediaStreamSourceRef.current.disconnect();
            mediaStreamSourceRef.current = null;
        }
        if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
            inputAudioContextRef.current.close();
            inputAudioContextRef.current = null;
        }
        if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
            outputAudioContextRef.current.close();
            outputAudioContextRef.current = null;
        }

        sessionPromiseRef.current = null;
        setStatus('stopped');
        console.log('Cleanup complete.');
    }, [stopAllAudio]);


    const handleStopConversation = useCallback(async () => {
        setStatus('stopped');
        if (sessionPromiseRef.current) {
            try {
                const session = await sessionPromiseRef.current;
                session.close();
            } catch (error) {
                console.error("Error closing session:", error);
            }
        }
        cleanup();
    }, [cleanup]);
    
    useEffect(() => {
        return () => {
            handleStopConversation();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleStartConversation = async () => {
        if (status === 'active' || status === 'connecting') return;

        setStatus('connecting');
        setErrorMessage(null);
        currentInputTranscriptionRef.current = '';
        currentOutputTranscriptionRef.current = '';

        try {
            mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

            inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

            sessionPromiseRef.current = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                config: {
                    responseModalities: [Modality.AUDIO],
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                },
                callbacks: {
                    onopen: () => {
                        console.log('Connection opened.');
                        setStatus('active');
                        mediaStreamSourceRef.current = inputAudioContextRef.current!.createMediaStreamSource(mediaStreamRef.current!);
                        scriptProcessorRef.current = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
                        
                        scriptProcessorRef.current.onaudioprocess = (audioProcessingEvent) => {
                            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                            const pcmBlob = createBlob(inputData);
                            if (sessionPromiseRef.current) {
                                sessionPromiseRef.current.then((session) => {
                                    session.sendRealtimeInput({ media: pcmBlob });
                                });
                            }
                        };
                        mediaStreamSourceRef.current.connect(scriptProcessorRef.current);
                        scriptProcessorRef.current.connect(inputAudioContextRef.current!.destination);
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        if (message.serverContent?.outputTranscription) {
                            currentOutputTranscriptionRef.current += message.serverContent.outputTranscription.text;
                        }
                        if (message.serverContent?.inputTranscription) {
                            currentInputTranscriptionRef.current += message.serverContent.inputTranscription.text;
                        }

                        if (message.serverContent?.turnComplete) {
                            const fullInput = currentInputTranscriptionRef.current;
                            const fullOutput = currentOutputTranscriptionRef.current;
                            if (fullInput.trim() || fullOutput.trim()) {
                                onHistoryChange([...transcriptions, { user: fullInput, model: fullOutput }]);
                            }
                            currentInputTranscriptionRef.current = '';
                            currentOutputTranscriptionRef.current = '';
                        }
                        
                        const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData.data;
                        if (audioData && outputAudioContextRef.current) {
                            const audioBuffer = await decodeAudioData(decode(audioData), outputAudioContextRef.current, 24000, 1);
                            
                            const now = outputAudioContextRef.current.currentTime;
                            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, now);

                            const source = outputAudioContextRef.current.createBufferSource();
                            source.buffer = audioBuffer;
                            source.connect(outputAudioContextRef.current.destination);
                            
                            source.onended = () => audioSourcesRef.current.delete(source);
                            audioSourcesRef.current.add(source);
                            
                            source.start(nextStartTimeRef.current);
                            nextStartTimeRef.current += audioBuffer.duration;
                        }

                        if (message.serverContent?.interrupted) {
                           stopAllAudio();
                        }
                    },
                    onerror: (e: ErrorEvent) => {
                        console.error('Connection error:', e);
                        setErrorMessage(`Connection error: ${e.message}`);
                        setStatus('error');
                        cleanup();
                    },
                    onclose: (e: CloseEvent) => {
                        console.log('Connection closed.');
                        if (status !== 'stopped') {
                           cleanup();
                        }
                    },
                },
            });

        } catch (error: any) {
            console.error("Failed to start conversation:", error);
            setErrorMessage(`Failed to start: ${error.message}`);
            setStatus('error');
            cleanup();
        }
    };
    
    const renderStatus = () => {
        switch (status) {
            case 'idle': return 'Click start to begin the conversation.';
            case 'connecting': return 'Connecting to Gemini... Please wait.';
            case 'active': return 'Listening... Feel free to speak.';
            case 'error': return `Error: ${errorMessage}`;
            case 'stopped': return 'Conversation ended. Click start to begin again.';
            default: return '';
        }
    }
    
    const getStatusIndicatorClass = () => {
        switch (status) {
            case 'active': return 'bg-green-500 animate-pulse';
            case 'connecting': return 'bg-yellow-500 animate-spin';
            case 'error': return 'bg-red-500';
            default: return 'bg-gray-500';
        }
    }

    return (
        <div className="flex flex-col h-full bg-gray-800 rounded-lg shadow-xl overflow-hidden p-6">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-sky-400">Live Voice Conversation</h2>
                <div className="flex items-center space-x-2">
                    <div className={`w-4 h-4 rounded-full transition-colors ${getStatusIndicatorClass()}`}></div>
                    <span className="text-gray-300">{status.charAt(0).toUpperCase() + status.slice(1)}</span>
                </div>
            </div>

            <p className="text-center text-gray-400 mb-6">{renderStatus()}</p>

            <div className="flex items-center justify-center space-x-4 mb-6">
                <button
                    onClick={handleStartConversation}
                    disabled={status === 'active' || status === 'connecting'}
                    className="px-6 py-3 bg-sky-600 text-white font-semibold rounded-lg shadow-md hover:bg-sky-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition-all"
                >
                    Start Conversation
                </button>
                <button
                    onClick={handleStopConversation}
                    disabled={status !== 'active' && status !== 'connecting'}
                    className="px-6 py-3 bg-red-600 text-white font-semibold rounded-lg shadow-md hover:bg-red-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition-all"
                >
                    Stop Conversation
                </button>
            </div>

            <div className="flex-1 bg-gray-900/50 rounded-lg p-4 overflow-y-auto space-y-4">
                {transcriptions.length === 0 && (
                    <div className="text-center text-gray-500 pt-8">Conversation transcript will appear here...</div>
                )}
                {transcriptions.map((turn, index) => (
                    <div key={index} className="space-y-2">
                        {turn.user && <div className="text-sky-300 text-right"><span className="font-bold">You:</span> {turn.user}</div>}
                        {turn.model && <div className="text-gray-200"><span className="font-bold text-green-400">Gemini:</span> {turn.model}</div>}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default VoiceBot;
