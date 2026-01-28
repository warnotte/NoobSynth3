/**
 * LHA/LZH decompression for YM files.
 * Based on lha.js by Stuart Caie (kyz/lha.js on GitHub)
 * Adapted for ES modules and TypeScript.
 */

interface LhaEntry {
  packMethod: string
  packedLength: number
  length: number
  name: string
  data: Uint8Array
}

interface LhaTree {
  max_codes: number
  lookup_bits: number
  code_lengths: Uint8Array
  lookup: Uint16Array
}

/** Detect if data is LHA compressed */
export function isLhaCompressed(data: Uint8Array): boolean {
  if (data.length < 7) return false
  const methodId = String.fromCharCode(data[2], data[3], data[4], data[5], data[6])
  return methodId.startsWith('-lh') && methodId.endsWith('-')
}

/** Read LHA archive entries */
function readLhaArchive(data: Uint8Array): LhaEntry[] {
  function chk(i: number, len: number) {
    if (i + len > data.length) throw new Error('read out of bounds')
  }
  function u8(i: number) { chk(i, 1); return data[i] }
  function u16(i: number) { chk(i, 2); return data[i] | (data[i+1] << 8) }
  function u32(i: number) { chk(i, 4); return data[i] | (data[i+1] << 8) | (data[i+2] << 16) | ((data[i+3] << 24) >>> 0) }
  function str(i: number, len: number) { chk(i, len); return String.fromCharCode(...data.subarray(i, i+len)) }

  let offset = 0
  const out: LhaEntry[] = []

  while ((data.length - offset) >= 24) {
    const level = u8(offset + 20)
    if (level > 3) throw new Error(`unknown header level ${level}`)
    if (level === 3 && u16(offset) !== 4) throw new Error('header level 3 with unknown word size')

    const nameLength = u8(offset + 21)
    const entry: LhaEntry = {
      packMethod: str(offset + 2, 5),
      packedLength: u32(offset + 7),
      length: u32(offset + 11),
      name: '',
      data: new Uint8Array(0)
    }

    // Read level 0,1 filename
    if (level < 2 && nameLength > 0) {
      const name = str(offset + 22, nameLength)
      const parts = name.split('\0')
      entry.name = parts[0]
    }

    // Read extended headers
    if (level > 0) {
      let headerOffset = (level === 3) ? 28 : (level === 2) ? 24 : u8(offset)
      const headerSize = (level === 3) ? 4 : 2
      const readLength = (level === 3) ? u32 : u16
      let headerLength: number
      let directory = ''

      while ((headerLength = readLength(offset + headerOffset)) > 0) {
        const dataOffset = offset + headerOffset + headerSize + 1
        const dataLength = headerLength - headerSize - 1
        switch (u8(dataOffset - 1)) {
          case 1: entry.name = str(dataOffset, dataLength); break
          case 2: directory = str(dataOffset, dataLength); break
        }
        headerOffset += headerLength
      }
      headerOffset += headerSize

      if (directory) {
        entry.name = directory.replace(/\xFF/g, '\\') + entry.name
      }
    }

    // Total length of headers
    let headersLength = (level < 2) ? u8(offset) + 2 :
                        (level === 2) ? u16(offset) : u32(offset + 24)

    // Fix level 1 packedLength
    if (level === 1) {
      const hdrOffset = u8(offset)
      entry.packedLength -= (hdrOffset - headersLength)
      headersLength = hdrOffset
    }

    entry.data = data.subarray(offset + headersLength, offset + headersLength + entry.packedLength)
    out.push(entry)
    offset += headersLength + entry.packedLength
  }

  return out
}

/** Unpack a single LHA entry */
function unpackEntry(entry: LhaEntry): Uint8Array {
  switch (entry.packMethod) {
    case '-lh0-':
    case '-lz4-':
    case '-pm0-':
    case '-lhd-':
      return entry.data

    case '-lh4-':
      return unpackLha2(13, entry.data, entry.length)
    case '-lh5-':
      return unpackLha2(14, entry.data, entry.length)
    case '-lh6-':
      return unpackLha2(16, entry.data, entry.length)
    case '-lh7-':
      return unpackLha2(17, entry.data, entry.length)

    default:
      throw new Error(`Unsupported pack method: ${entry.packMethod}`)
  }
}

/** LHA v2 decompression (-lh4-, -lh5-, -lh6-, -lh7-) */
function unpackLha2(windowBits: number, input: Uint8Array, length: number): Uint8Array {
  const output = new Uint8Array(length)
  const w = new Uint8Array(1 << windowBits)
  const pretree = allocTree(20, 7)
  const main = allocTree(510, 9)
  const distances = allocTree(windowBits, 7)
  const wmask = (1 << windowBits) - 1

  let ip = 0, op = 0, wp = 0
  let bb = 0, bl = 0

  w.fill(32) // History window initially full of spaces

  function peekBits(n: number): number {
    while (bl < n) {
      bb = (bb << 8) | (input[ip++] || 0)
      bl += 8
    }
    return (bb >> (bl - n)) & ((1 << n) - 1)
  }

  function dropBits(n: number) { bl -= n }
  function readBits(n: number): number { const bits = peekBits(n); dropBits(n); return bits }
  function writeByte(byte: number) { output[op++] = w[wp++] = byte; wp &= wmask }

  function readTree(tree: LhaTree, readLength: (codeLengths: Uint8Array, i: number) => number | undefined) {
    for (let i = tree.max_codes; i--;) tree.code_lengths[i] = 0

    const bitsNeeded = Math.ceil(Math.log2(tree.max_codes + 1))
    const n = Math.min(readBits(bitsNeeded), tree.max_codes)

    if (n === 0) {
      buildSingleCodeTree(tree, readBits(bitsNeeded))
    } else {
      for (let i = 0; i < n; i++) {
        const skip = readLength(tree.code_lengths, i)
        if (skip) i += skip
      }
      buildTree(tree)
    }
  }

  function readCode(tree: LhaTree): number {
    let bits = tree.lookup_bits
    let code = tree.lookup[peekBits(bits)]
    while (code >= tree.max_codes) {
      code = tree.lookup[(code << 1) | (peekBits(++bits) & 1)]
    }
    dropBits(tree.code_lengths[code])
    return code
  }

  while (op < length) {
    const steps = readBits(16)

    readTree(pretree, (codeLengths, i) => {
      codeLengths[i] = readBits(3)
      if (codeLengths[i] === 7) while (readBits(1)) codeLengths[i]++
      if (i === 2) return readBits(2)
      return undefined
    })

    readTree(main, (codeLengths, i) => {
      const code = readCode(pretree)
      if (code === 1) return readBits(4) + 2
      if (code === 2) return readBits(9) + 19
      if (code > 2) codeLengths[i] = code - 2
      return undefined
    })

    readTree(distances, (codeLengths, i) => {
      codeLengths[i] = readBits(3)
      if (codeLengths[i] === 7) while (readBits(1)) codeLengths[i]++
      return undefined
    })

    for (let s = steps; s-- && op < length;) {
      const code = readCode(main)
      if (code < 256) {
        writeByte(code)
      } else {
        const len = code - 256 + 3
        const distCode = readCode(distances)
        const distance = (distCode === 0) ? 0 :
                         (distCode === 1) ? 1 :
                         (1 << (distCode - 1)) + readBits(distCode - 1)
        let cp = wp - distance - 1
        for (let l = len; l-- && op < length;) writeByte(w[cp++ & wmask])
      }
    }
  }

  return output
}

function allocTree(maxCodes: number, lookupBits: number): LhaTree {
  return {
    max_codes: maxCodes,
    lookup_bits: lookupBits,
    code_lengths: new Uint8Array(maxCodes),
    lookup: new Uint16Array(Math.max(1 << lookupBits, maxCodes << 1) + (maxCodes << 1))
  }
}

function buildSingleCodeTree(tree: LhaTree, code: number) {
  tree.code_lengths[code] = 1
  tree.lookup.fill(code)
}

function buildTree(tree: LhaTree) {
  const { max_codes, code_lengths, lookup, lookup_bits } = tree
  const lookupSize = 1 << lookup_bits
  let posn = 0

  // Fill entries for codes short enough for direct mapping
  for (let b = 1, f = lookupSize >> 1; b <= lookup_bits; b++, f >>= 1) {
    for (let code = 0; code < max_codes; code++) {
      if (code_lengths[code] === b) {
        for (let i = f; i--;) lookup[posn++] = code
      }
    }
  }

  if (posn === lookupSize) return

  // Mark remaining lookup entries as "unused"
  for (let i = posn; i < lookupSize; i++) lookup[i] = 0xFFFF

  let allocPosn = Math.max(lookupSize >> 1, max_codes)
  posn <<= 16

  // Find longest code length
  let maxBits = 0
  for (let i = 0; i < max_codes; i++) {
    maxBits = Math.max(maxBits, code_lengths[i])
  }

  // Build tree for longer codes
  for (let b = lookup_bits + 1, f = 1 << 15; b <= maxBits; b++, f >>= 1) {
    for (let code = 0; code < max_codes; code++) {
      if (code_lengths[code] === b) {
        let leaf = posn >> 16
        for (let fill = 0; fill < (b - lookup_bits); fill++) {
          if (lookup[leaf] === 0xFFFF) {
            lookup[(allocPosn << 1)] = 0xFFFF
            lookup[(allocPosn << 1) | 1] = 0xFFFF
            lookup[leaf] = allocPosn++
          }
          leaf = (lookup[leaf] << 1) | ((posn >> (15 - fill)) & 1)
        }
        lookup[leaf] = code
        posn += f
      }
    }
  }
}

/**
 * Decompress LHA data.
 * If not LHA compressed, returns data as-is.
 * Extracts the first file from the archive.
 */
export function decompressLha(data: Uint8Array): Uint8Array {
  if (!isLhaCompressed(data)) {
    return data
  }

  try {
    const entries = readLhaArchive(data)
    if (entries.length === 0) {
      throw new Error('No files in LHA archive')
    }

    // Return the first (and usually only) file
    return unpackEntry(entries[0])
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    throw new Error(`LHA decompression failed: ${msg}`)
  }
}

/** Get LHA compression method (for display) */
export function getLhaMethod(data: Uint8Array): string | null {
  if (data.length < 7) return null
  const methodId = String.fromCharCode(data[2], data[3], data[4], data[5], data[6])
  if (methodId.startsWith('-lh') && methodId.endsWith('-')) {
    return methodId
  }
  return null
}

/**
 * Decompress raw LHA-5 data (not an LHA archive).
 * Used for VTX files which embed LHA-5 compressed data.
 */
export function decompressLha5Raw(input: Uint8Array, unpackedSize: number): Uint8Array {
  // LHA-5 uses 14-bit window (16384 bytes)
  return unpackLha2(14, input, unpackedSize)
}

/**
 * Detect if data is a VTX file.
 */
export function isVtxFile(data: Uint8Array): boolean {
  if (data.length < 16) return false
  // VTX starts with "ay" (0x6179) or "ym" (0x6D79) in little-endian
  const magic = data[0] | (data[1] << 8)
  return magic === 0x7961 || magic === 0x796D  // "ay" or "ym"
}

/**
 * Decompress VTX file data.
 * VTX files have a header + strings, then LHA-5 compressed register data.
 * Returns the file with decompressed data portion.
 */
export function decompressVtx(data: Uint8Array): Uint8Array {
  if (!isVtxFile(data) || data.length < 16) {
    return data
  }

  // Parse header
  // 0-1: magic ("ay" or "ym")
  // 2: stereo mode
  // 3-4: loop frame (word LE)
  // 5-8: chip clock (dword LE)
  // 9: player frequency
  // 10-11: year (word LE)
  // 12-15: unpacked size (dword LE)
  const unpackedSize = data[12] | (data[13] << 8) | (data[14] << 16) | (data[15] << 24)

  // Skip null-terminated strings (name, author, program, editor, comment)
  let offset = 16
  for (let i = 0; i < 5 && offset < data.length; i++) {
    while (offset < data.length && data[offset] !== 0) {
      offset++
    }
    offset++ // Skip null terminator
  }

  if (offset >= data.length) {
    return data // No data to decompress
  }

  // Decompress the data portion
  const compressedData = data.subarray(offset)
  let decompressedData: Uint8Array

  try {
    decompressedData = decompressLha5Raw(compressedData, unpackedSize)
  } catch {
    // If decompression fails, return original data
    return data
  }

  // Reconstruct: header + strings + decompressed data
  const result = new Uint8Array(offset + decompressedData.length)
  result.set(data.subarray(0, offset), 0)
  result.set(decompressedData, offset)

  return result
}
