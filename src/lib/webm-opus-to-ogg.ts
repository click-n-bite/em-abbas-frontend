/**
 * Chrome and Edge can record Opus only inside a WebM container.
 * WhatsApp voice notes need those same Opus packets in an Ogg container.
 * This remuxes the container and does not re-encode mono audio.
 */

const EBML = 0x1a45dfa3;

const SEGMENT = 0x18538067;

const SEEK_HEAD = 0x114d9b74;

const INFO = 0x1549a966;

const TRACKS = 0x1654ae6b;

const CLUSTER = 0x1f43b675;

const CUES = 0x1c53bb6b;

const TAGS = 0x1254c367;

const VOID = 0xec;

const CRC32 = 0xbf;

const TRACK_ENTRY = 0xae;

const TRACK_NUMBER = 0xd7;

const CODEC_ID = 0x86;

const CODEC_PRIVATE = 0x63a2;

const AUDIO = 0xe1;

const TIMECODE = 0xe7;

const SIMPLE_BLOCK = 0xa3;

const BLOCK_GROUP = 0xa0;

const BLOCK = 0xa1;

const DISCARD_PADDING = 0x75a2;

const SEGMENT_CHILDREN = new Set([
  SEEK_HEAD,
  INFO,
  TRACKS,
  CLUSTER,
  CUES,
  TAGS,
  VOID,
  CRC32,
  0x1941a469,
  0x1043a770,
]);

const CLUSTER_CHILDREN = new Set([
  TIMECODE,
  SIMPLE_BLOCK,
  BLOCK_GROUP,
  VOID,
  CRC32,
  0xa7,
  0xab,
  0x5854,
]);

const BLOCK_GROUP_CHILDREN = new Set([
  BLOCK,
  DISCARD_PADDING,
  VOID,
  CRC32,
  0x9b,
  0xfb,
]);

const OPUS_FRAME_SAMPLES = [
  480, 960, 1920, 2880, 480, 960, 1920, 2880, 480, 960, 1920, 2880, 480, 960,
  480, 960, 120, 240, 480, 960, 120, 240, 480, 960, 120, 240, 480, 960, 120,
  240, 480, 960,
];

export interface OpusAudio {
  head: Uint8Array;
  packets: Uint8Array[];
}

interface Vint {
  length: number;
  /** Size value with the length marker removed. Unused for element IDs. */
  value: number;
  /** Full big-endian integer, including the length marker. Used for IDs. */
  raw: number;
  unknown: boolean;
}

interface Track {
  number: number;
  codec: string;
  head: Uint8Array | null;
}

export function webmOpusToOgg(bytes: Uint8Array): Uint8Array {
  const audio = extractWebmOpus(bytes);

  return muxOggOpus(audio.head, audio.packets);
}

export function extractWebmOpus(bytes: Uint8Array): OpusAudio {
  if (bytes.length < 4 || readId(bytes, 0).raw !== EBML) {
    throw new Error("recording is not a WebM file");
  }

  const tracks: Track[] = [];

  const packets: Uint8Array[] = [];

  walk(bytes, 0, bytes.length, null, tracks, packets);

  const track = tracks.find((item) => item.codec === "A_OPUS");

  if (!track?.head || !startsWith(track.head, "OpusHead")) {
    throw new Error("recording is not Opus");
  }

  if (packets.length === 0) throw new Error("recording has no audio");

  return { head: track.head, packets };
}

export function muxOggOpus(
  head: Uint8Array,
  packets: Uint8Array[],
): Uint8Array {
  if (!startsWith(head, "OpusHead")) throw new Error("missing Opus header");

  if (packets.length === 0) throw new Error("recording has no audio");

  const serial = randomSerial();

  const pages = [
    encodePage([head], 0, 0x02, serial, 0),
    encodePage([opusTags()], 0, 0, serial, 1),
    ...audioPages(packets, preSkip(head), serial, 2),
  ];

  const total = pages.reduce((sum, page) => sum + page.length, 0);

  const output = new Uint8Array(total);

  let offset = 0;

  for (const page of pages) {
    output.set(page, offset);
    offset += page.length;
  }

  return output;
}

export function opusPacketSamples(packet: Uint8Array): number {
  if (packet.length === 0) throw new Error("empty opus packet");

  const toc = packet[0];

  const config = toc >> 3;

  const code = toc & 0x03;

  const samples = OPUS_FRAME_SAMPLES[config];

  if (!samples) throw new Error("invalid opus packet");

  if (code === 0) return samples;

  if (code === 1 || code === 2) return samples * 2;

  const count = packet.length > 1 ? packet[1] & 0x3f : 0;

  if (count === 0) throw new Error("invalid opus packet");

  return samples * count;
}

function walk(
  bytes: Uint8Array,
  start: number,
  end: number,
  unknownParent: number | null,
  tracks: Track[],
  packets: Uint8Array[],
): number {
  let offset = start;

  while (offset + 2 <= end && offset + 2 <= bytes.length) {
    const id = readId(bytes, offset);

    if (!allowedChild(unknownParent, id.raw)) return offset;

    const size = readVint(bytes, offset + id.length);

    const contentStart = offset + id.length + size.length;

    if (!size.unknown && contentStart + size.value > bytes.length) {
      throw new Error("truncated WebM recording");
    }

    const contentEnd = size.unknown ? end : contentStart + size.value;

    if (id.raw === TRACK_ENTRY) {
      tracks.push(readTrack(bytes, contentStart, contentEnd));
      offset = size.unknown ? end : contentEnd;
      continue;
    }

    if (
      id.raw === SEGMENT ||
      id.raw === CLUSTER ||
      id.raw === BLOCK_GROUP ||
      id.raw === TRACKS
    ) {
      const consumed = walk(
        bytes,
        contentStart,
        contentEnd,
        size.unknown ? id.raw : null,
        tracks,
        packets,
      );

      offset = size.unknown ? consumed : contentEnd;
      continue;
    }

    if (id.raw === SIMPLE_BLOCK || id.raw === BLOCK) {
      const opusTrack = tracks.find((item) => item.codec === "A_OPUS");

      if (opusTrack) {
        packets.push(
          ...readBlockFrames(
            bytes.subarray(contentStart, contentEnd),
            opusTrack.number,
          ),
        );
      }
    }

    if (size.unknown) return contentStart;

    offset = contentEnd;
  }

  return offset;
}

function readTrack(bytes: Uint8Array, start: number, end: number): Track {
  const track: Track = { number: 1, codec: "", head: null };

  let offset = start;

  while (offset + 2 <= end && offset + 2 <= bytes.length) {
    const id = readId(bytes, offset);

    const size = readVint(bytes, offset + id.length);

    const contentStart = offset + id.length + size.length;

    if (size.unknown || contentStart + size.value > bytes.length) break;

    const contentEnd = contentStart + size.value;

    if (id.raw === TRACK_NUMBER) {
      track.number = readUnsigned(bytes, contentStart, contentEnd);
    }

    if (id.raw === CODEC_ID) {
      track.codec = decodeText(bytes.subarray(contentStart, contentEnd));
    }

    if (id.raw === CODEC_PRIVATE) {
      track.head = bytes.slice(contentStart, contentEnd);
    }

    if (id.raw === AUDIO) {
      offset = contentEnd;
      continue;
    }

    offset = contentEnd;
  }

  return track;
}

function readBlockFrames(block: Uint8Array, trackNumber: number): Uint8Array[] {
  const track = readVint(block, 0);

  if (track.value !== trackNumber) return [];

  let offset = track.length + 2;

  if (offset >= block.length) throw new Error("truncated audio block");

  const flags = block[offset];

  offset += 1;

  const lacing = (flags >> 1) & 0x03;

  if (lacing !== 0) throw new Error("unsupported audio frame layout");

  const frame = block.slice(offset);

  if (frame.length === 0) return [];

  return [frame];
}

function allowedChild(parent: number | null, id: number): boolean {
  if (parent === SEGMENT) return SEGMENT_CHILDREN.has(id);

  if (parent === CLUSTER) return CLUSTER_CHILDREN.has(id);

  if (parent === BLOCK_GROUP) return BLOCK_GROUP_CHILDREN.has(id);

  if (parent === TRACKS)
    return id === TRACK_ENTRY || id === VOID || id === CRC32;

  return true;
}

function audioPages(
  packets: Uint8Array[],
  preskip: number,
  serial: number,
  sequenceStart: number,
): Uint8Array[] {
  const pages: Uint8Array[] = [];

  let index = 0;

  let sequence = sequenceStart;

  let granule = preskip;

  while (index < packets.length) {
    const batch: Uint8Array[] = [];

    let segments = 0;

    let samples = 0;

    while (index < packets.length) {
      const packet = packets[index];

      const needed = segmentCount(packet.length);

      if (needed > 255) throw new Error("opus packet is too large");

      if (batch.length > 0 && segments + needed > 255) break;

      batch.push(packet);
      segments += needed;
      samples += opusPacketSamples(packet);
      index += 1;
    }

    granule += samples;
    pages.push(
      encodePage(
        batch,
        granule,
        index >= packets.length ? 0x04 : 0x00,
        serial,
        sequence,
      ),
    );
    sequence += 1;
  }

  return pages;
}

function encodePage(
  packets: Uint8Array[],
  granule: number,
  flags: number,
  serial: number,
  sequence: number,
): Uint8Array {
  const tables = packets.map((packet) => segmentTable(packet.length));

  const segmentCountTotal = tables.reduce(
    (sum, table) => sum + table.length,
    0,
  );

  const dataLength = packets.reduce((sum, packet) => sum + packet.length, 0);

  const page = new Uint8Array(27 + segmentCountTotal + dataLength);

  const view = new DataView(page.buffer);

  page.set([0x4f, 0x67, 0x67, 0x53], 0);
  page[5] = flags;
  writeUint64(page, 6, granule);
  view.setUint32(14, serial, true);
  view.setUint32(18, sequence, true);
  page[26] = segmentCountTotal;

  let offset = 27;

  for (const table of tables) {
    page.set(table, offset);
    offset += table.length;
  }

  for (const packet of packets) {
    page.set(packet, offset);
    offset += packet.length;
  }

  view.setUint32(22, oggCrc(page), true);

  return page;
}

function segmentTable(length: number): Uint8Array {
  const parts: number[] = [];

  let remaining = length;

  while (remaining >= 255) {
    parts.push(255);
    remaining -= 255;
  }

  parts.push(remaining);

  return Uint8Array.from(parts);
}

function segmentCount(length: number): number {
  return Math.floor(length / 255) + 1;
}

function opusTags(): Uint8Array {
  const vendor = new TextEncoder().encode("ema-portal");

  const packet = new Uint8Array(8 + 4 + vendor.length + 4);

  const view = new DataView(packet.buffer);

  packet.set(new TextEncoder().encode("OpusTags"), 0);
  view.setUint32(8, vendor.length, true);
  packet.set(vendor, 12);
  view.setUint32(12 + vendor.length, 0, true);

  return packet;
}

function preSkip(head: Uint8Array): number {
  if (head.length < 12) return 384;

  return head[10] | (head[11] << 8);
}

function readId(bytes: Uint8Array, offset: number): Vint {
  return readVint(bytes, offset);
}

function readVint(bytes: Uint8Array, offset: number): Vint {
  if (offset >= bytes.length || bytes[offset] === 0) {
    throw new Error("invalid WebM recording");
  }

  const first = bytes[offset];

  let length = 1;

  let mask = 0x80;

  while ((first & mask) === 0) {
    length += 1;
    mask >>= 1;

    if (length > 8) throw new Error("invalid WebM recording");
  }

  if (offset + length > bytes.length)
    throw new Error("truncated WebM recording");

  let unknown = (first & (mask - 1)) === mask - 1;

  let value = first & (mask - 1);

  let raw = first;

  for (let index = 1; index < length; index += 1) {
    const byte = bytes[offset + index];

    if (byte !== 0xff) unknown = false;

    value = value * 256 + byte;
    raw = raw * 256 + byte;
  }

  if (!unknown && !Number.isSafeInteger(value)) {
    throw new Error("WebM element is too large");
  }

  return { length, value: unknown ? -1 : value, raw, unknown };
}

function readUnsigned(bytes: Uint8Array, start: number, end: number): number {
  let value = 0;

  for (let index = start; index < end; index += 1) {
    value = value * 256 + bytes[index];
  }

  return value;
}

function decodeText(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes).replace(/\0+$/, "");
}

function startsWith(bytes: Uint8Array, text: string): boolean {
  if (bytes.length < text.length) return false;

  for (let index = 0; index < text.length; index += 1) {
    if (bytes[index] !== text.charCodeAt(index)) return false;
  }

  return true;
}

function writeUint64(bytes: Uint8Array, offset: number, value: number): void {
  let remaining = value;

  for (let index = 0; index < 8; index += 1) {
    bytes[offset + index] = remaining & 0xff;
    remaining = Math.floor(remaining / 256);
  }
}

function randomSerial(): number {
  const values = new Uint32Array(1);

  crypto.getRandomValues(values);

  return values[0];
}

const OGG_CRC_TABLE = (() => {
  const table = new Uint32Array(256);

  for (let index = 0; index < 256; index += 1) {
    let crc = (index << 24) >>> 0;

    for (let bit = 0; bit < 8; bit += 1) {
      if (crc & 0x80000000) crc = ((crc << 1) ^ 0x04c11db7) >>> 0;
      else crc = (crc << 1) >>> 0;
    }

    table[index] = crc;
  }

  return table;
})();

function oggCrc(bytes: Uint8Array): number {
  let crc = 0;

  for (let index = 0; index < bytes.length; index += 1) {
    const lookup = ((crc >>> 24) ^ bytes[index]) & 0xff;

    crc = ((crc << 8) ^ OGG_CRC_TABLE[lookup]) >>> 0;
  }

  return crc >>> 0;
}
