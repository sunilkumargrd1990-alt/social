import { fileToGenerativePart } from "./imageUtils";

export const extractFrames = (videoFile: File, numFrames: number = 10): Promise<any[]> => {
    return new Promise(async (resolve, reject) => {
        try {
            const video = document.createElement('video');
            video.preload = 'metadata';
            video.src = URL.createObjectURL(videoFile);
            video.muted = true;

            const cleanup = () => {
                URL.revokeObjectURL(video.src);
            };

            video.onloadedmetadata = async () => {
                // Ensure video is seekable
                if (video.duration === Infinity) {
                    video.currentTime = 1e101; // seek to end to get duration
                    await new Promise(r => setTimeout(r, 200));
                    video.currentTime = 0;
                }
                
                const duration = video.duration;
                if (duration === 0) {
                    cleanup();
                    return reject(new Error("Video has no duration."));
                }
                const interval = duration / numFrames;
                const frames = [];
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');

                for (let i = 0; i < numFrames; i++) {
                    video.currentTime = i * interval;
                    await new Promise(r => {
                        const onSeeked = () => {
                            video.removeEventListener('seeked', onSeeked);
                            r(null);
                        };
                        video.addEventListener('seeked', onSeeked);
                    });
                    
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    context!.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
                    
                    const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg'));
                    if (blob) {
                        const frameFile = new File([blob], `frame_${i}.jpg`, { type: 'image/jpeg' });
                        const part = await fileToGenerativePart(frameFile);
                        frames.push(part);
                    }
                }
                cleanup();
                resolve(frames);
            };

            video.onerror = (e) => {
                cleanup();
                reject(new Error("Failed to load video metadata. The file may be corrupt or in an unsupported format."));
            };
        } catch (error) {
            reject(error);
        }
    });
};
