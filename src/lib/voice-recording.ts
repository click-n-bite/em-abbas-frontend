import { extractWebmOpus, muxOggOpus } from "@/lib/webm-opus-to-ogg";

export type VoiceContainer = "ogg" | "webm" | "mp4" | "aac";

export interface VoiceRecordFormat {
  mimeType: string;
  container: VoiceContainer;
}

/**
 * Prefer a real Ogg/Opus recording. Chrome and Edge only offer WebM/Opus,
 * which is remuxed to Ogg before upload. WhatsApp rejects WebM bytes even
 * when the file name says .ogg.
 */
export function pickVoiceRecordFormat(
  isTypeSupported: (mimeType: string) => boolean,
): VoiceRecordFormat | null {
  if (isTypeSupported("audio/ogg;codecs=opus")) {
    return { mimeType: "audio/ogg;codecs=opus", container: "ogg" };
  }

  if (isTypeSupported("audio/webm;codecs=opus")) {
    return { mimeType: "audio/webm;codecs=opus", container: "webm" };
  }

  if (isTypeSupported("audio/webm")) {
    return { mimeType: "audio/webm", container: "webm" };
  }

  if (isTypeSupported("audio/mp4")) {
    return { mimeType: "audio/mp4", container: "mp4" };
  }

  if (isTypeSupported("audio/aac")) {
    return { mimeType: "audio/aac", container: "aac" };
  }

  return null;
}

/** Create this during the mic click, before any await, so playback policy allows it. */
export function primeVoiceContext(): AudioContext | null {
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;

  if (!Ctor) return null;

  try {
    const context = new Ctor();

    void context.resume();

    return context;
  } catch {
    return null;
  }
}

export async function createVoiceRecorder(
  raw: MediaStream,
  mimeType: string,
  context: AudioContext | null,
): Promise<{ recorder: MediaRecorder; release: () => void }> {
  const mono = await openMonoStream(raw, context);

  const candidates = mono.stream === raw ? [raw] : [mono.stream, raw];

  let lastError: unknown = null;

  for (const stream of candidates) {
    try {
      const recorder = new MediaRecorder(stream, { mimeType });

      return {
        recorder,
        release: () => {
          mono.release();
          raw.getTracks().forEach((track) => track.stop());
        },
      };
    } catch (error) {
      lastError = error;
    }
  }

  mono.release();
  raw.getTracks().forEach((track) => track.stop());
  throw lastError instanceof Error
    ? lastError
    : new Error("MediaRecorder failed");
}

export async function voiceFileFromChunks(
  chunks: Blob[],
  container: VoiceContainer,
): Promise<File> {
  const recorded = new Blob(chunks);

  const bytes = new Uint8Array(await recorded.arrayBuffer());

  const stamp = Date.now();

  if (container === "webm") {
    const ogg = oggBytesFromWebm(bytes);

    return new File([ogg], `voice-${stamp}.ogg`, { type: "audio/ogg" });
  }

  if (container === "ogg") {
    return new File([bytes], `voice-${stamp}.ogg`, { type: "audio/ogg" });
  }

  if (container === "mp4") {
    return new File([bytes], `voice-${stamp}.m4a`, { type: "audio/mp4" });
  }

  return new File([bytes], `voice-${stamp}.aac`, { type: "audio/aac" });
}

function oggBytesFromWebm(bytes: Uint8Array): Uint8Array {
  const extracted = extractWebmOpus(bytes);

  return muxOggOpus(extracted.head, extracted.packets);
}

async function openMonoStream(
  raw: MediaStream,
  context: AudioContext | null,
): Promise<{
  stream: MediaStream;
  release: () => void;
}> {
  if (!context) return { stream: raw, release: () => undefined };

  try {
    if (context.state !== "running") {
      await Promise.race([
        context.resume().catch(() => undefined),
        new Promise((resolve) => {
          window.setTimeout(resolve, 250);
        }),
      ]);
    }

    if (context.state !== "running") {
      void context.close();

      return { stream: raw, release: () => undefined };
    }

    const source = context.createMediaStreamSource(raw);

    const destination = context.createMediaStreamDestination();

    destination.channelCountMode = "explicit";
    destination.channelCount = 1;
    source.connect(destination);

    const audioContext = context;

    let released = false;

    return {
      stream: destination.stream,
      release: () => {
        if (released) return;

        released = true;
        destination.stream.getTracks().forEach((track) => track.stop());
        void audioContext.close();
      },
    };
  } catch {
    void context.close();

    return { stream: raw, release: () => undefined };
  }
}
