import React, { useState, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { extractFrames } from '../utils/videoUtils';

type Status = 'idle' | 'extracting' | 'analyzing' | 'success' | 'error';

const VideoAnalyzer: React.FC = () => {
    const [status, setStatus] = useState<Status>('idle');
    const [prompt, setPrompt] = useState('');
    const [video, setVideo] = useState<{ file: File, url: string } | null>(null);
    const [analysis, setAnalysis] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setVideo({ file, url: URL.createObjectURL(file) });
            setAnalysis(null);
            setStatus('idle');
        }
    };
    
    const handleAnalyze = async () => {
        if (!video || !prompt.trim()) {
            setError("Please upload a video and ask a question.");
            return;
        }

        setError(null);
        setAnalysis(null);
        
        try {
            setStatus('extracting');
            const frames = await extractFrames(video.file, 10);
            
            setStatus('analyzing');
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            
            const requestParts = [
                { text: prompt },
                ...frames
            ];
            
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-pro',
                contents: { parts: requestParts }
            });

            setAnalysis(response.text);
            setStatus('success');

        } catch (err: any) {
            console.error("Video analysis error:", err);
            setError(`An error occurred: ${err.message}`);
            setStatus('error');
        }
    };

    const reset = () => {
        setVideo(null);
        setAnalysis(null);
        setPrompt('');
        setStatus('idle');
        setError(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const getStatusMessage = () => {
        switch (status) {
            case 'extracting': return "Extracting frames from video...";
            case 'analyzing': return "Analyzing video with Gemini...";
            default: return "Analyze Video";
        }
    }

    return (
        <div className="flex flex-col h-full bg-gray-800 rounded-lg shadow-xl overflow-hidden p-6">
            <h2 className="text-xl font-bold text-sky-400 mb-4 text-center">Gemini Video Analyzer</h2>
            
            <div className="flex-1 overflow-y-auto space-y-4">
                {!video ? (
                    <div className="flex items-center justify-center h-full border-2 border-dashed border-gray-600 rounded-lg">
                        <input type="file" ref={fileInputRef} onChange={handleVideoUpload} accept="video/*" className="hidden" />
                        <button onClick={() => fileInputRef.current?.click()} className="px-6 py-3 bg-sky-600 text-white font-semibold rounded-lg shadow-md hover:bg-sky-700">
                            Upload a Video to Analyze
                        </button>
                    </div>
                ) : (
                    <>
                        <video src={video.url} controls className="w-full rounded-lg shadow-md" />
                        
                        {error && <div className="p-3 my-2 bg-red-500/20 text-red-300 rounded-md">{error}</div>}
                        
                        <div className="space-y-4 pt-4">
                            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="e.g., What is the main subject of this video?" rows={3} className="w-full bg-gray-700 p-3 rounded-lg text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500" disabled={status === 'extracting' || status === 'analyzing'}></textarea>
                            
                            <div className="flex gap-4">
                                <button onClick={handleAnalyze} className="flex-1 py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-500 flex items-center justify-center gap-2" disabled={status === 'extracting' || status === 'analyzing' || !prompt.trim()}>
                                    {(status === 'extracting' || status === 'analyzing') && <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                                    {getStatusMessage()}
                                </button>
                                <button onClick={reset} className="py-3 px-6 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors">
                                    Reset
                                </button>
                            </div>

                            {analysis && (
                                <div className="p-4 bg-gray-900/50 rounded-lg">
                                    <h3 className="font-bold text-sky-300 mb-2">Analysis Result:</h3>
                                    <p className="text-gray-200 whitespace-pre-wrap">{analysis}</p>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default VideoAnalyzer;
