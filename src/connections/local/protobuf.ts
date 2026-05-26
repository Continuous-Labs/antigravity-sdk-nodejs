// Copyright 2026 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * A tiny, zero-dependency, safe binary Protobuf encoder/decoder
 * specifically designed for the localharness subprocess InputConfig and OutputConfig handshake.
 */

export interface DecodedOutputConfig {
  port: number;
  api_key: string;
}

/**
 * Encodes a simple InputConfig message.
 * Schema:
 *   message InputConfig {
 *     string storage_directory = 1;
 *     uint32 port = 2;
 *     string bind_address = 3; // default is "localhost"
 *   }
 */
export function encodeInputConfig(storageDirectory: string): Buffer {
  const strBuf = Buffer.from(storageDirectory, "utf-8");
  
  // Write field 1: tag = 1 << 3 | 2 = 10 (0x0a), length (varint), bytes
  const tag = 0x0a;
  const lenVarint = encodeVarint(strBuf.length);
  return Buffer.concat([Buffer.from([tag]), lenVarint, strBuf]);
}

/**
 * Decodes a simple OutputConfig message.
 * Schema:
 *   message OutputConfig {
 *     int32 port = 1;
 *     string api_key = 2;
 *   }
 */
export function decodeOutputConfig(buffer: Buffer): DecodedOutputConfig {
  let offset = 0;
  let port = 0;
  let api_key = "";

  while (offset < buffer.length) {
    const key = decodeVarint(buffer, offset);
    offset = key.offset;
    const tag = key.val;
    const fieldNum = tag >>> 3;
    const wireType = tag & 0x07;

    if (fieldNum === 1 && wireType === 0) { // port (varint)
      const val = decodeVarint(buffer, offset);
      offset = val.offset;
      port = val.val;
    } else if (fieldNum === 2 && wireType === 2) { // api_key (string)
      const lenVal = decodeVarint(buffer, offset);
      offset = lenVal.offset;
      const len = lenVal.val;
      api_key = buffer.toString("utf-8", offset, offset + len);
      offset += len;
    } else {
      // Skip unknown fields
      if (wireType === 0) {
        offset = decodeVarint(buffer, offset).offset;
      } else if (wireType === 2) {
        const lenVal = decodeVarint(buffer, offset);
        offset = lenVal.offset + lenVal.val;
      } else if (wireType === 1) { // 64-bit
        offset += 8;
      } else if (wireType === 5) { // 32-bit
        offset += 4;
      } else {
        throw new Error(`Unsupported protobuf wire type ${wireType} at offset ${offset}`);
      }
    }
  }

  return { port, api_key };
}

function encodeVarint(val: number): Buffer {
  const res: number[] = [];
  let v = val;
  while (v >= 0x80) {
    res.push((v & 0x7f) | 0x80);
    v >>>= 7;
  }
  res.push(v & 0x7f);
  return Buffer.from(res);
}

function decodeVarint(buffer: Buffer, offset: number): { val: number; offset: number } {
  let val = 0;
  let shift = 0;
  let currentOffset = offset;
  while (true) {
    if (currentOffset >= buffer.length) {
      throw new Error("Varint parsing overflow");
    }
    const byte = buffer[currentOffset++];
    val |= (byte & 0x7f) << shift;
    if (!(byte & 0x80)) {
      break;
    }
    shift += 7;
  }
  return { val, offset: currentOffset };
}
