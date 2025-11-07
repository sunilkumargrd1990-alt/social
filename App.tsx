import React, { useState, useEffect } from 'react';
import ChatBot from './components/ChatBot';
import VoiceBot from './components/VoiceBot';
import VideoBot from './components/VideoBot';
import ImageEditor from './components/ImageEditor';
import VideoAnalyzer from './components/VideoAnalyzer';
import AppBuilder from './components/AppBuilder';
import { ChatMessage, VoiceTranscript } from './types';

type AppMode = 'chat' | 'voice' | 'video' | 'image' | 'analyze' | 'builder';

const ChatIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
);

const MicIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line></svg>
);

const VideoIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M22 8l-6 4 6 4V8z"></path><rect x="2" y="6" width="14" height="12" rx="2" ry="2"></rect></svg>
);

const ImageIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
);

const FilmIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect><line x1="7" y1="2" x2="7" y2="22"></line><line x1="17" y1="2" x2="17" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line><line x1="2" y1="7" x2="7" y2="7"></line><line x1="2" y1="17" x2="7" y2="17"></line><line x1="17" y1="17" x2="22" y2="17"></line><line x1="17" y1="7" x2="22" y2="7"></line></svg>
);

const CodeIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
);


const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>('chat');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [voiceHistory, setVoiceHistory] = useState<VoiceTranscript[]>([]);

  useEffect(() => {
    try {
      const savedChatHistory = localStorage.getItem('gemini-chat-history');
      if (savedChatHistory) {
        setChatHistory(JSON.parse(savedChatHistory));
      }
      const savedVoiceHistory = localStorage.getItem('gemini-voice-history');
      if (savedVoiceHistory) {
        setVoiceHistory(JSON.parse(savedVoiceHistory));
      }
    } catch (error) {
      console.error("Failed to load history from localStorage", error);
      localStorage.removeItem('gemini-chat-history');
      localStorage.removeItem('gemini-voice-history');
    }
  }, []);

  const handleChatHistoryChange = (newHistory: ChatMessage[]) => {
    setChatHistory(newHistory);
    try {
      localStorage.setItem('gemini-chat-history', JSON.stringify(newHistory));
    } catch (error) {
      console.error("Failed to save chat history to localStorage", error);
    }
  };

  const handleVoiceHistoryChange = (newHistory: VoiceTranscript[]) => {
    setVoiceHistory(newHistory);
    try {
      localStorage.setItem('gemini-voice-history', JSON.stringify(newHistory));
    } catch (error) {
      console.error("Failed to save voice history to localStorage", error);
    }
  };

  const getButtonClass = (buttonMode: AppMode) => {
    return mode === buttonMode
      ? 'bg-sky-600 text-white'
      : 'bg-gray-700 text-gray-300 hover:bg-gray-600';
  };

  const renderContent = () => {
    switch (mode) {
      case 'chat':
        return <ChatBot history={chatHistory} onHistoryChange={handleChatHistoryChange} />;
      case 'voice':
        return <VoiceBot transcriptions={voiceHistory} onHistoryChange={handleVoiceHistoryChange} />;
      case 'video':
        return <VideoBot />;
      case 'image':
        return <ImageEditor />;
      case 'analyze':
          return <VideoAnalyzer />;
      case 'builder':
          return <AppBuilder />;
      default:
        return <ChatBot history={chatHistory} onHistoryChange={handleChatHistoryChange} />;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-gray-100 font-sans">
      <header className="bg-gray-800 shadow-md p-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <h1 className="text-xl md:text-2xl font-bold text-sky-400">Your Assistant</h1>
          <div className="flex flex-wrap justify-center gap-1 rounded-lg p-1 bg-gray-900">
            <button onClick={() => setMode('chat')} className={`flex items-center space-x-2 px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${getButtonClass('chat')}`}><ChatIcon className="w-5 h-5" /><span>Chat</span></button>
            <button onClick={() => setMode('voice')} className={`flex items-center space-x-2 px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${getButtonClass('voice')}`}><MicIcon className="w-5 h-5" /><span>Voice</span></button>
            <button onClick={() => setMode('video')} className={`flex items-center space-x-2 px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${getButtonClass('video')}`}><VideoIcon className="w-5 h-5" /><span>Video Gen</span></button>
            <button onClick={() => setMode('image')} className={`flex items-center space-x-2 px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${getButtonClass('image')}`}><ImageIcon className="w-5 h-5" /><span>Image Edit</span></button>
            <button onClick={() => setMode('analyze')} className={`flex items-center space-x-2 px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${getButtonClass('analyze')}`}><FilmIcon className="w-5 h-5" /><span>Video Analyze</span></button>
            <button onClick={() => setMode('builder')} className={`flex items-center space-x-2 px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${getButtonClass('builder')}`}><CodeIcon className="w-5 h-5" /><span>App Builder</span></button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        <div className="h-full max-w-7xl mx-auto p-2 sm:p-4 md:p-6">
          {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default App;