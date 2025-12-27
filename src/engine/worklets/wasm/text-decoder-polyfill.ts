type DecoderGlobal = typeof globalThis & { TextDecoder?: typeof TextDecoder }

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
