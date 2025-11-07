import React, { useState } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { GeneratedAppCode } from '../types';

type Status = 'idle' | 'generating' | 'success' | 'error';
type ResultTab = 'preview' | 'html' | 'css' | 'js';

const AppBuilder: React.FC = () => {
    const [status, setStatus] = useState<Status>('idle');
    const [prompt, setPrompt] = useState('');
    const [generatedCode, setGeneratedCode] = useState<GeneratedAppCode | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<ResultTab>('preview');

    const handleGenerate = async () => {
        if (!prompt.trim()) {
            setError("Please enter a description for the app you want to build.");
            return;
        }

        setError(null);
        setGeneratedCode(null);
        setStatus('generating');
        setActiveTab('preview');

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const responseSchema = {
                type: Type.OBJECT,
                properties: {
                    html: { type: Type.STRING, description: 'The HTML body content for the application.' },
                    css: { type: Type.STRING, description: 'The CSS styles for the application.' },
                    javascript: { type: Type.STRING, description: 'The JavaScript logic for the application.' },
                },
                required: ['html', 'css', 'javascript']
            };
            
            const systemInstruction = "You are a world-class senior frontend engineer. Your task is to generate a complete, self-contained web application based on a user's description. The application should be functional and aesthetically pleasing. You MUST provide the output as a single JSON object with three keys: 'html', 'css', and 'javascript'. The 'html' should only contain the body content. The 'css' should contain all the necessary styles. The 'javascript' should contain all the necessary functionality. Do not include markdown formatting or the word 'json' in your response.";

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-pro',
                contents: prompt,
                config: {
                    systemInstruction,
                    responseMimeType: 'application/json',
                    responseSchema,
                }
            });

            const code = JSON.parse(response.text) as GeneratedAppCode;
            setGeneratedCode(code);
            setStatus('success');
        } catch (err: any) {
            console.error("App generation error:", err);
            setError(`An error occurred: ${err.message}`);
            setStatus('error');
        }
    };

    const getPreviewSrcDoc = () => {
        if (!generatedCode) return '';
        return `
            <!DOCTYPE html>
            <html>
                <head>
                    <style>${generatedCode.css}</style>
                </head>
                <body>
                    ${generatedCode.html}
                    <script>${generatedCode.javascript}</script>
                </body>
            </html>
        `;
    };
    
    const CodeBlock: React.FC<{ code: string }> = ({ code }) => (
        <pre className="bg-gray-900 text-gray-200 p-4 rounded-b-lg text-sm overflow-auto h-full">
            <code>{code}</code>
        </pre>
    );

    const getTabClass = (tabName: ResultTab) => {
        return activeTab === tabName 
            ? 'bg-gray-800 text-sky-400 border-b-2 border-sky-400' 
            : 'bg-gray-900/50 text-gray-300 hover:bg-gray-700/50';
    }

    return (
        <div className="flex flex-col h-full bg-gray-800 rounded-lg shadow-xl overflow-hidden">
            <h2 className="text-xl font-bold text-sky-400 p-4 border-b border-gray-700 text-center">Gemini App Builder</h2>
            <div className="flex flex-1 flex-col md:flex-row min-h-0">
                {/* Left Panel: Prompt */}
                <div className="w-full md:w-1/3 p-4 flex flex-col border-r border-gray-700">
                    <h3 className="font-semibold mb-2 text-lg">Describe Your App</h3>
                    <p className="text-sm text-gray-400 mb-4">Be as descriptive as possible. For example, "a todo list app" or "a calculator with a clean, dark theme".</p>
                    <textarea 
                        value={prompt} 
                        onChange={(e) => setPrompt(e.target.value)} 
                        placeholder="e.g., A pomodoro timer with start, stop, and reset buttons." 
                        rows={10} 
                        className="w-full flex-1 bg-gray-700 p-3 rounded-lg text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none" 
                        disabled={status === 'generating'}
                    />
                     {error && <div className="p-2 my-2 text-sm bg-red-500/20 text-red-300 rounded-md">{error}</div>}
                    <button 
                        onClick={handleGenerate} 
                        className="w-full mt-4 py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-500 flex items-center justify-center gap-2" 
                        disabled={status === 'generating'}
                    >
                        {status === 'generating' && <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                        {status === 'generating' ? 'Building Your App...' : 'Generate App'}
                    </button>
                </div>

                {/* Right Panel: Results */}
                <div className="w-full md:w-2/3 p-4 flex flex-col">
                    <div className="flex-shrink-0 border-b border-gray-700">
                        <nav className="flex space-x-2">
                            <button onClick={() => setActiveTab('preview')} className={`px-4 py-2 font-medium text-sm rounded-t-lg ${getTabClass('preview')}`}>Preview</button>
                            <button onClick={() => setActiveTab('html')} className={`px-4 py-2 font-medium text-sm rounded-t-lg ${getTabClass('html')}`}>HTML</button>
                            <button onClick={() => setActiveTab('css')} className={`px-4 py-2 font-medium text-sm rounded-t-lg ${getTabClass('css')}`}>CSS</button>
                            <button onClick={() => setActiveTab('js')} className={`px-4 py-2 font-medium text-sm rounded-t-lg ${getTabClass('js')}`}>JS</button>
                        </nav>
                    </div>
                    <div className="flex-1 bg-gray-900/50 rounded-b-lg overflow-hidden">
                       {status === 'idle' && <div className="h-full flex items-center justify-center text-gray-400">Your app preview will appear here.</div>}
                       {status === 'generating' && <div className="h-full flex items-center justify-center text-gray-300"><div className="w-8 h-8 border-4 border-sky-400 border-t-transparent rounded-full animate-spin mr-4"></div>Generating...</div>}
                       {generatedCode && (
                           <div className="h-full">
                               {activeTab === 'preview' && <iframe srcDoc={getPreviewSrcDoc()} title="App Preview" className="w-full h-full border-0 bg-white" sandbox="allow-scripts allow-modals"></iframe>}
                               {activeTab === 'html' && <CodeBlock code={generatedCode.html} />}
                               {activeTab === 'css' && <CodeBlock code={generatedCode.css} />}
                               {activeTab === 'js' && <CodeBlock code={generatedCode.javascript} />}
                           </div>
                       )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AppBuilder;
