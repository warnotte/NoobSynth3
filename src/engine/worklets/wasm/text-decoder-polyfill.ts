type DecoderGlobal = typeof globalThis & {
  TextDecoder?: typeof TextDecoder
  TextEncoder?: typeof TextEncoder
}

const scope = globalThis as DecoderGlobal

if (typeof scope.TextDecoder === 'undefined') {
  class SimpleTextDecoder {
    constructor(_label?: string, _options?: TextDecoderOptions) {}

    decode(input?: ArrayBufferView | ArrayLike<number>) {
      if (!input) {
        return ''
      }
      let bytes: ArrayLike<number>
      if (ArrayBuffer.isView(input)) {
        bytes = new Uint8Array(input.buffer, input.byteOffset, input.byteLength)
      } else {
        bytes = input
      }
      let output = ''
      let i = 0
      while (i < bytes.length) {
        const byte1 = bytes[i++] ?? 0
        if (byte1 < 0x80) {
          output += String.fromCharCode(byte1)
          continue
        }
        if ((byte1 & 0xe0) === 0xc0) {
          const byte2 = bytes[i++] ?? 0
          const codePoint = ((byte1 & 0x1f) << 6) | (byte2 & 0x3f)
          output += String.fromCharCode(codePoint)
          continue
        }
        if ((byte1 & 0xf0) === 0xe0) {
          const byte2 = bytes[i++] ?? 0
          const byte3 = bytes[i++] ?? 0
          const codePoint =
            ((byte1 & 0x0f) << 12) | ((byte2 & 0x3f) << 6) | (byte3 & 0x3f)
          output += String.fromCharCode(codePoint)
          continue
        }
        if ((byte1 & 0xf8) === 0xf0) {
          const byte2 = bytes[i++] ?? 0
          const byte3 = bytes[i++] ?? 0
          const byte4 = bytes[i++] ?? 0
          let codePoint =
            ((byte1 & 0x07) << 18) |
            ((byte2 & 0x3f) << 12) |
            ((byte3 & 0x3f) << 6) |
            (byte4 & 0x3f)
          codePoint -= 0x10000
          const high = 0xd800 + ((codePoint >> 10) & 0x3ff)
          const low = 0xdc00 + (codePoint & 0x3ff)
          output += String.fromCharCode(high, low)
          continue
        }
      }
      return output
    }
  }

  scope.TextDecoder = SimpleTextDecoder as unknown as typeof TextDecoder
}

if (typeof scope.TextEncoder === 'undefined') {
  class SimpleTextEncoder {
    encode(input = ''): Uint8Array {
      const bytes: number[] = []
      for (let i = 0; i < input.length; i += 1) {
        const codePoint = input.codePointAt(i) ?? 0
        if (codePoint > 0xffff) {
          i += 1
        }
        if (codePoint <= 0x7f) {
          bytes.push(codePoint)
        } else if (codePoint <= 0x7ff) {
          bytes.push(0xc0 | (codePoint >> 6))
          bytes.push(0x80 | (codePoint & 0x3f))
        } else if (codePoint <= 0xffff) {
          bytes.push(0xe0 | (codePoint >> 12))
          bytes.push(0x80 | ((codePoint >> 6) & 0x3f))
          bytes.push(0x80 | (codePoint & 0x3f))
        } else {
          bytes.push(0xf0 | (codePoint >> 18))
          bytes.push(0x80 | ((codePoint >> 12) & 0x3f))
          bytes.push(0x80 | ((codePoint >> 6) & 0x3f))
          bytes.push(0x80 | (codePoint & 0x3f))
        }
      }
      return new Uint8Array(bytes)
    }
  }

  scope.TextEncoder = SimpleTextEncoder as unknown as typeof TextEncoder
}
