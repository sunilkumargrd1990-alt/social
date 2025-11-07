export enum ChatRole {
  USER = 'user',
  MODEL = 'model',
}

export interface GroundingChunkSource {
  uri?: string;
  title?: string;
}

export interface GroundingChunk {
  web?: GroundingChunkSource;
  maps?: {
    placeAnswerSources?: {
      reviewSnippets?: {
        uri: string;
        title: string;
      }[];
    }
  } & GroundingChunkSource;
}

export interface ChatMessage {
  role: ChatRole;
  text: string;
  image?: {
    base64: string;
    mimeType: string;
  };
  groundingChunks?: GroundingChunk[];
  isLoading?: boolean;
}

export interface VoiceTranscript {
  user: string;
  model: string;
}

export interface GeneratedAppCode {
  html: string;
  css: string;
  javascript: string;
}