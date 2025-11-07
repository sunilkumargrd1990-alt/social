import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Chat, Modality, GenerateContentResponse } from "@google/genai";
import { ChatMessage, ChatRole, GroundingChunk } from '../types';
import { fileToGenerativePart } from '../utils/imageUtils';
import { decode, decodeAudioData } from '../utils/audioUtils';

const UserIcon: React.FC<{ className?: string }> = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>);
const BotIcon: React.FC<{ className?: string }> = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>);
const PlayIcon: React.FC<{ className?: string }> = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>);
const LoadingSpinner: React.FC = () => (<div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>);

const Toggle: React.FC<{ label: string; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean; }> = ({ label, checked, onChange, disabled }) => (
    <label className="flex items-center cursor-pointer">
        <div className="relative">
            <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} disabled={disabled} />
            <div className={`block w-10 h-6 rounded-full transition-colors ${checked ? 'bg-sky-500' : 'bg-gray-600'}`}></div>
            <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${checked ? 'translate-x-4' : ''}`}></div>
        </div>
        <div className="ml-3 text-gray-300 text-sm">{label}</div>
    </label>
);

const GroundingSources: React.FC<{ chunks: GroundingChunk[] }> = ({ chunks }) => (
    <div className="mt-2">
        <h4 className="text-xs font-bold text-gray-400 mb-1">Sources:</h4>
        <div className="flex flex-wrap gap-2">
            {/* FIX: Check for source.uri before rendering the link and provide a fallback for the title. */}
            {chunks.map((chunk, index) => {
                const source = chunk.web || chunk.maps;
                if (!source || !source.uri) return null;
                return <a key={index} href={source.uri} target="_blank" rel="noopener noreferrer" className="text-xs bg-gray-600 hover:bg-sky-600 text-sky-200 px-2 py-1 rounded-md transition-colors">{source.title || source.uri}</a>
            })}
        </div>
    </div>
);


interface ChatBotProps {
    history: ChatMessage[];
    onHistoryChange: (history: ChatMessage[]) => void;
}

const ChatBot: React.FC<ChatBotProps> = ({ history, onHistoryChange }) => {
    const [input, setInput] = useState('');
    const [image, setImage] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [ttsLoading, setTtsLoading] = useState<number | null>(null);

    // Settings
    const [useLite, setUseLite] = useState(false);
    const [thinkingMode, setThinkingMode] = useState(false);
    const [useSearch, setUseSearch] = useState(false);
    const [useMaps, setUseMaps] = useState(false);
    
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [history]);

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setImage(e.target.files[0]);
        }
    };

    const handleSendMessage = async () => {
        if ((!input.trim() && !image) || isLoading) return;

        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        let userMessage: ChatMessage;
        const parts: any[] = [];
        
        if (image) {
            const imagePart = await fileToGenerativePart(image);
            parts.push(imagePart);
            const { base64, mimeType } = await fileToGenerativePart(image).then(p => ({ base64: p.inlineData.data, mimeType: p.inlineData.mimeType }));
            userMessage = { role: ChatRole.USER, text: input, image: { base64, mimeType } };
        } else {
            userMessage = { role: ChatRole.USER, text: input };
        }
        if (input.trim()) {
            parts.push({ text: input });
        }
        
        const newHistoryWithUserAndPlaceholder = [...history, userMessage, { role: ChatRole.MODEL, text: "", isLoading: true }];
        onHistoryChange(newHistoryWithUserAndPlaceholder);

        setInput('');
        setImage(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        setIsLoading(true);

        try {
            const model = thinkingMode ? 'gemini-2.5-pro' : (useLite ? 'gemini-flash-lite-latest' : 'gemini-2.5-flash');
            
            const config: any = {};
            const tools: any[] = [];
            if (thinkingMode) config.thinkingConfig = { thinkingBudget: 32768 };
            if (useSearch) tools.push({ googleSearch: {} });
            if (useMaps) tools.push({ googleMaps: {} });
            if (tools.length > 0) config.tools = tools;

            if (useMaps) {
                const location = await new Promise<any>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject));
                config.toolConfig = { retrievalConfig: { latLng: { latitude: location.coords.latitude, longitude: location.coords.longitude } } };
            }

            const responseStream = await ai.models.generateContentStream({
                model,
                contents: { parts },
                config,
            });
            
            let fullText = "";
            let finalResponse: GenerateContentResponse | undefined;
            for await (const chunk of responseStream) {
                fullText += chunk.text;
                finalResponse = chunk;
                onHistoryChange(prev => {
                    const updated = [...prev];
                    updated[updated.length - 1].text = fullText;
                    return updated;
                });
            }

            onHistoryChange(prev => {
                const updated = [...prev];
                const lastMessage = updated[updated.length - 1];
                lastMessage.isLoading = false;
                lastMessage.groundingChunks = finalResponse?.candidates?.[0]?.groundingMetadata?.groundingChunks as GroundingChunk[] | undefined;
                return updated;
            });

        } catch (error) {
            console.error("Error sending message:", error);
            onHistoryChange(prev => {
                const updated = [...prev];
                const lastMessage = updated[updated.length - 1];
                lastMessage.isLoading = false;
                lastMessage.text = "Sorry, I encountered an error. Please try again.";
                return updated;
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleTTS = async (text: string, index: number) => {
        setTtsLoading(index);
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash-preview-tts",
                contents: [{ parts: [{ text }] }],
                config: { responseModalities: [Modality.AUDIO] },
            });
            
            const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
            if (audioData) {
                const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
                const audioBuffer = await decodeAudioData(decode(audioData), outputAudioContext, 24000, 1);
                const source = outputAudioContext.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(outputAudioContext.destination);
                source.start();
            }
        } catch (error) {
            console.error("TTS Error:", error);
        } finally {
            setTtsLoading(null);
        }
    };

    return (
        <div className="flex flex-col h-full bg-gray-800 rounded-lg shadow-xl overflow-hidden">
            <div className="flex-1 p-6 space-y-6 overflow-y-auto">
                {history.map((msg, index) => (
                    <div key={index} className={`flex items-start gap-4 ${msg.role === ChatRole.USER ? 'justify-end' : ''}`}>
                        {msg.role === ChatRole.MODEL && <BotIcon className="w-8 h-8 p-1.5 bg-sky-500 rounded-full text-white flex-shrink-0" />}
                        <div className={`max-w-md p-4 rounded-xl ${msg.role === ChatRole.USER ? 'bg-sky-600 text-white rounded-br-none' : 'bg-gray-700 text-gray-200 rounded-bl-none'}`}>
                            {msg.image && <img src={`data:${msg.image.mimeType};base64,${msg.image.base64}`} alt="user upload" className="rounded-lg mb-2 max-h-48" />}
                            {msg.isLoading && !msg.text ? (
                               <div className="flex items-center space-x-2"><div className="w-2 h-2 bg-sky-400 rounded-full animate-pulse"></div><div className="w-2 h-2 bg-sky-400 rounded-full animate-pulse delay-75"></div><div className="w-2 h-2 bg-sky-400 rounded-full animate-pulse delay-150"></div></div>
                            ) : (
                               <div className="whitespace-pre-wrap">{msg.text}</div>
                            )}

                            {msg.role === ChatRole.MODEL && !msg.isLoading && msg.text && (
                                <div className="flex items-center mt-2">
                                    <button onClick={() => handleTTS(msg.text, index)} className="text-gray-400 hover:text-white transition-colors disabled:opacity-50" disabled={ttsLoading !== null}>
                                        {ttsLoading === index ? <LoadingSpinner /> : <PlayIcon className="w-5 h-5" />}
                                    </button>
                                </div>
                            )}
                            {msg.groundingChunks && <GroundingSources chunks={msg.groundingChunks} />}
                        </div>
                        {msg.role === ChatRole.USER && <UserIcon className="w-8 h-8 p-1.5 bg-gray-600 rounded-full text-white flex-shrink-0" />}
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            <div className="p-4 bg-gray-900/50 border-t border-gray-700">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-sm p-2 mb-2 bg-gray-700/50 rounded-lg">
                    <Toggle label="Low Latency" checked={useLite} onChange={setUseLite} disabled={thinkingMode} />
                    <Toggle label="Thinking Mode" checked={thinkingMode} onChange={setThinkingMode} disabled={useLite} />
                    <Toggle label="Use Search" checked={useSearch} onChange={setUseSearch} />
                    <Toggle label="Use Maps" checked={useMaps} onChange={setUseMaps} />
                </div>
                {image && <div className="mb-2 flex items-center bg-gray-700 p-2 rounded-lg"><img src={URL.createObjectURL(image)} alt="preview" className="w-12 h-12 rounded-md object-cover" /><span className="ml-3 text-sm text-gray-300 truncate">{image.name}</span><button onClick={() => setImage(null)} className="ml-auto text-red-400 hover:text-red-300 text-xl">&times;</button></div>}
                <div className="flex items-center bg-gray-700 rounded-lg px-2">
                    <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
                    <button onClick={() => fileInputRef.current?.click()} className="p-2 rounded-full text-gray-300 hover:bg-sky-600 hover:text-white transition-colors"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg></button>
                    <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()} placeholder="Ask Gemini anything..." className="flex-1 w-full bg-transparent p-3 text-gray-100 placeholder-gray-400 focus:outline-none" disabled={isLoading} />
                    <button onClick={handleSendMessage} disabled={isLoading || (!input.trim() && !image)} className="p-2 rounded-full text-gray-300 hover:bg-sky-600 hover:text-white disabled:hover:bg-transparent disabled:opacity-50 transition-colors">{isLoading ? <LoadingSpinner /> : <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>}</button>
                </div>
            </div>
        </div>
    );
};

export default ChatBot;