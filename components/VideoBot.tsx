import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { fileToBase64 } from '../utils/imageUtils';

type Status = 'idle' | 'selecting_key' | 'ready' | 'generating' | 'success' | 'error';

const loadingMessages = [
    "Warming up the video generators...",
    "Gathering creative digital energies...",
    "Translating your prompt into pixels...",
    "This can take a few minutes. Great art needs patience!",
    "Almost there, rendering the final frames...",
    "Polishing the video for its grand debut...",
];

const VideoBot: React.FC = () => {
    const [status, setStatus] = useState<Status>('idle');
    const [apiKeySelected, setApiKeySelected] = useState(false);
    const [prompt, setPrompt] = useState('');
    const [image, setImage] = useState<{ base64: string; mimeType: string; name: string } | null>(null);
    const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
    const [loadingMessage, setLoadingMessage] = useState('');
    const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const videoUrlRef = useRef<string | null>(null);
    const loadingIntervalRef = useRef<number | null>(null);

    useEffect(() => {
        const checkApiKey = async () => {
            const hasKey = await window.aistudio.hasSelectedApiKey();
            setApiKeySelected(hasKey);
            setStatus(hasKey ? 'ready' : 'idle');
        };
        checkApiKey();
        return () => {
            if (videoUrlRef.current) {
                URL.revokeObjectURL(videoUrlRef.current);
            }
            if (loadingIntervalRef.current) {
                clearInterval(loadingIntervalRef.current);
            }
        };
    }, []);

    const handleSelectKey = async () => {
        setStatus('selecting_key');
        await window.aistudio.openSelectKey();
        setApiKeySelected(true);
        setStatus('ready');
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const imgData = await fileToBase64(file);
            setImage(imgData);
        }
    };

    const handleGenerateVideo = async () => {
        if (!prompt.trim() && !image) {
            setError("Please provide a prompt or an image.");
            return;
        }

        setError(null);
        setStatus('generating');
        if (generatedVideoUrl) URL.revokeObjectURL(generatedVideoUrl);
        setGeneratedVideoUrl(null);
        setLoadingMessage(loadingMessages[0]);
        
        let messageIndex = 0;
        loadingIntervalRef.current = window.setInterval(() => {
            messageIndex = (messageIndex + 1) % loadingMessages.length;
            setLoadingMessage(loadingMessages[messageIndex]);
        }, 5000);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            
            const requestPayload: any = {
                model: 'veo-3.1-fast-generate-preview',
                prompt: prompt,
                config: {
                    numberOfVideos: 1,
                    resolution: '720p',
                    aspectRatio: aspectRatio
                }
            };

            if (image) {
                requestPayload.image = {
                    imageBytes: image.base64,
                    mimeType: image.mimeType,
                };
            }
            
            let operation = await ai.models.generateVideos(requestPayload);

            while (!operation.done) {
                await new Promise(resolve => setTimeout(resolve, 10000));
                operation = await ai.operations.getVideosOperation({ operation: operation });
            }
            
            const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
            if (!downloadLink) {
                throw new Error("Video generation completed, but no download link was found.");
            }

            const videoResponse = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
            if (!videoResponse.ok) {
                throw new Error(`Failed to download video: ${videoResponse.statusText}`);
            }
            
            const blob = await videoResponse.blob();
            const url = URL.createObjectURL(blob);
            videoUrlRef.current = url;
            setGeneratedVideoUrl(url);
            setStatus('success');

        } catch (err: any) {
            console.error("Video generation error:", err);
            if (err.message?.includes("Requested entity was not found")) {
                setError("API Key is invalid. Please select a valid key.");
                setApiKeySelected(false);
                setStatus('idle');
            } else {
                setError(`An error occurred: ${err.message}`);
                setStatus('error');
            }
        } finally {
            if (loadingIntervalRef.current) clearInterval(loadingIntervalRef.current);
        }
    };

    const renderContent = () => {
        if (!apiKeySelected) {
            return (
                <div className="text-center p-8 bg-gray-700/50 rounded-lg">
                    <h2 className="text-xl font-semibold mb-4">API Key Required for Video Generation</h2>
                    <p className="mb-6 text-gray-300">Veo is a premium model and requires you to select an API key associated with a project that has billing enabled.</p>
                    <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline mb-6 block">Learn more about billing</a>
                    <button onClick={handleSelectKey} className="px-6 py-3 bg-sky-600 text-white font-semibold rounded-lg shadow-md hover:bg-sky-700 transition-colors">
                        Select API Key
                    </button>
                </div>
            );
        }

        if (status === 'generating') {
            return (
                <div className="text-center p-8 bg-gray-700/50 rounded-lg">
                    <div className="w-12 h-12 border-4 border-sky-400 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
                    <h2 className="text-xl font-semibold mb-4">Generating Your Masterpiece...</h2>
                    <p className="text-gray-300">{loadingMessage}</p>
                </div>
            );
        }

        if (status === 'success' && generatedVideoUrl) {
            return (
                <div className="text-center p-4">
                     <video src={generatedVideoUrl} controls autoPlay className="w-full rounded-lg shadow-lg mb-4" />
                     <button onClick={() => setStatus('ready')} className="mt-4 px-6 py-2 bg-sky-600 text-white font-semibold rounded-lg hover:bg-sky-700">Create Another</button>
                </div>
            )
        }
        
        return (
             <div className="space-y-4">
                 {error && <div className="p-3 bg-red-500/20 text-red-300 rounded-md">{error}</div>}
                 <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="A neon hologram of a cat driving at top speed..." rows={4} className="w-full bg-gray-700 p-3 rounded-lg text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500"></textarea>
                 
                 <div className="flex items-center justify-between bg-gray-700/50 p-3 rounded-lg">
                     <label htmlFor="image-upload" className="cursor-pointer text-sky-400 hover:text-sky-300">
                         {image ? `Image: ${image.name}` : "Upload Optional Start Image"}
                     </label>
                     <input id="image-upload" type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                     {image && <button onClick={() => setImage(null)} className="text-red-400 hover:text-red-300">&times;</button>}
                 </div>

                 <div className="flex items-center gap-4">
                     <span className="font-semibold">Aspect Ratio:</span>
                     <button onClick={() => setAspectRatio('16:9')} className={`px-4 py-2 rounded-lg ${aspectRatio === '16:9' ? 'bg-sky-600' : 'bg-gray-600'}`}>16:9 Landscape</button>
                     <button onClick={() => setAspectRatio('9:16')} className={`px-4 py-2 rounded-lg ${aspectRatio === '9:16' ? 'bg-sky-600' : 'bg-gray-600'}`}>9:16 Portrait</button>
                 </div>
                 
                 {/* FIX: Removed redundant `status === 'generating'` check which caused a TypeScript error. The button is disabled based on input presence. */}
                 <button onClick={handleGenerateVideo} className="w-full py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-500" disabled={!prompt.trim() && !image}>
                     Generate Video
                 </button>
             </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-gray-800 rounded-lg shadow-xl overflow-hidden p-6">
            <h2 className="text-xl font-bold text-sky-400 mb-4 text-center">Veo Video Generation</h2>
            {renderContent()}
        </div>
    );
};

export default VideoBot;