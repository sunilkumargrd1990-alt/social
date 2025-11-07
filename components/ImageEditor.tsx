import React, { useState, useRef } from 'react';
import { GoogleGenAI, Modality } from "@google/genai";
import { fileToGenerativePart } from '../utils/imageUtils';

type Status = 'idle' | 'generating' | 'success' | 'error';

const ImageEditor: React.FC = () => {
    const [status, setStatus] = useState<Status>('idle');
    const [prompt, setPrompt] = useState('');
    const [originalImage, setOriginalImage] = useState<{ file: File, url: string } | null>(null);
    const [editedImage, setEditedImage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setOriginalImage({ file, url: URL.createObjectURL(file) });
            setEditedImage(null);
            setStatus('idle');
        }
    };
    
    const handleGenerate = async () => {
        if (!originalImage || !prompt.trim()) {
            setError("Please upload an image and provide an editing prompt.");
            return;
        }

        setError(null);
        setStatus('generating');
        setEditedImage(null);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const imagePart = await fileToGenerativePart(originalImage.file);
            const textPart = { text: prompt };

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: { parts: [imagePart, textPart] },
                config: { responseModalities: [Modality.IMAGE] },
            });
            
            const imageResponsePart = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData);
            if (imageResponsePart?.inlineData) {
                const base64ImageBytes = imageResponsePart.inlineData.data;
                const mimeType = imageResponsePart.inlineData.mimeType;
                setEditedImage(`data:${mimeType};base64,${base64ImageBytes}`);
                setStatus('success');
            } else {
                throw new Error("The model did not return an image. It might have refused the request.");
            }

        } catch (err: any) {
            console.error("Image editing error:", err);
            setError(`An error occurred: ${err.message}`);
            setStatus('error');
        }
    };

    const reset = () => {
        setOriginalImage(null);
        setEditedImage(null);
        setPrompt('');
        setStatus('idle');
        setError(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    return (
        <div className="flex flex-col h-full bg-gray-800 rounded-lg shadow-xl overflow-hidden p-6">
            <h2 className="text-xl font-bold text-sky-400 mb-4 text-center">Gemini Image Editor</h2>
            
            <div className="flex-1 overflow-y-auto space-y-4">
                {!originalImage ? (
                    <div className="flex items-center justify-center h-full border-2 border-dashed border-gray-600 rounded-lg">
                        <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
                        <button onClick={() => fileInputRef.current?.click()} className="px-6 py-3 bg-sky-600 text-white font-semibold rounded-lg shadow-md hover:bg-sky-700">
                            Upload an Image to Edit
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <h3 className="font-semibold mb-2 text-center text-gray-300">Original</h3>
                                <img src={originalImage.url} alt="Original" className="w-full rounded-lg shadow-md" />
                            </div>
                            <div>
                                <h3 className="font-semibold mb-2 text-center text-gray-300">Edited</h3>
                                <div className="w-full aspect-square bg-gray-700/50 rounded-lg flex items-center justify-center">
                                    {status === 'generating' && <div className="w-12 h-12 border-4 border-sky-400 border-t-transparent rounded-full animate-spin"></div>}
                                    {editedImage && <img src={editedImage} alt="Edited" className="w-full rounded-lg shadow-md" />}
                                    {status !== 'generating' && !editedImage && <span className="text-gray-400">Your edit will appear here</span>}
                                </div>
                            </div>
                        </div>
                        
                        {error && <div className="p-3 bg-red-500/20 text-red-300 rounded-md">{error}</div>}
                        
                        <div className="space-y-4 pt-4">
                            <input type="text" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="e.g., Add a retro filter" className="w-full bg-gray-700 p-3 rounded-lg text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500" disabled={status === 'generating'}/>
                            
                            <div className="flex gap-4">
                                <button onClick={handleGenerate} className="flex-1 py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-500" disabled={status === 'generating' || !prompt.trim()}>
                                    {status === 'generating' ? 'Generating...' : 'Generate'}
                                </button>
                                <button onClick={reset} className="py-3 px-6 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors">
                                    Reset
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default ImageEditor;
