// Super Mario Bros & Zelda - NES and SNES song arrangements
// 5 channels: Lead, Harmony, Chords, Bass (triangle), Extra
// MIDI notes: 60 = C4 (middle C), null = rest

export const marioSongs = {
  smb: {
    name: 'Overworld Theme',
    tempo: 200,
    // Lead melody - Pulse 1 (50% duty)
    ch1: [
      // Intro
      76, 76, null, 76, null, 72, 76, null, 79, null, null, null, 67, null, null, null,
      // Main theme A
      72, null, null, 67, null, null, 64, null, null, 69, null, 71, null, 70, 69, null,
      67, 76, 79, 81, null, 77, 79, null, 76, null, 72, 74, 71, null, null, null,
      // Main theme A repeat
      72, null, null, 67, null, null, 64, null, null, 69, null, 71, null, 70, 69, null,
      67, 76, 79, 81, null, 77, 79, null, 76, null, 72, 74, 71, null, null, null,
      // Bridge B
      null, null, 79, 78, 77, 75, null, 76, null, 68, 69, 72, null, 69, 72, 74,
      null, null, 79, 78, 77, 75, null, 76, null, 84, null, 84, 84, null, null, null,
      null, null, 79, 78, 77, 75, null, 76, null, 68, 69, 72, null, 69, 72, 74,
      null, null, 75, null, null, 74, null, null, 72, null, null, null, null, null, null, null,
      // Main theme A again
      72, null, null, 67, null, null, 64, null, null, 69, null, 71, null, 70, 69, null,
      67, 76, 79, 81, null, 77, 79, null, 76, null, 72, 74, 71, null, null, null,
      // Ending flourish
      72, null, null, 67, null, null, 64, null, null, 69, null, 71, null, 70, 69, null,
      67, 76, 79, 81, null, 77, 79, null, 76, null, 72, 74, 71, null, null, null,
    ],
    // Harmony - Pulse 2 (25% duty)
    ch2: [
      // Intro
      64, 64, null, 64, null, 60, 64, null, 67, null, null, null, 55, null, null, null,
      // Main theme A
      60, null, null, 55, null, null, 52, null, null, 57, null, 59, null, 58, 57, null,
      55, 64, 67, 69, null, 65, 67, null, 64, null, 60, 62, 59, null, null, null,
      // Main theme A repeat
      60, null, null, 55, null, null, 52, null, null, 57, null, 59, null, 58, 57, null,
      55, 64, 67, 69, null, 65, 67, null, 64, null, 60, 62, 59, null, null, null,
      // Bridge B
      null, null, 67, 66, 65, 63, null, 64, null, 56, 57, 60, null, 57, 60, 62,
      null, null, 67, 66, 65, 63, null, 64, null, 72, null, 72, 72, null, null, null,
      null, null, 67, 66, 65, 63, null, 64, null, 56, 57, 60, null, 57, 60, 62,
      null, null, 63, null, null, 62, null, null, 60, null, null, null, null, null, null, null,
      // Main theme A again
      60, null, null, 55, null, null, 52, null, null, 57, null, 59, null, 58, 57, null,
      55, 64, 67, 69, null, 65, 67, null, 64, null, 60, 62, 59, null, null, null,
      // Ending flourish
      60, null, null, 55, null, null, 52, null, null, 57, null, 59, null, 58, 57, null,
      55, 64, 67, 69, null, 65, 67, null, 64, null, 60, 62, 59, null, null, null,
    ],
    // Chords/Arpeggios
    ch3: [
      // Intro - punchy chords
      60, null, 64, null, 60, null, 64, null, 55, null, 59, null, 55, null, null, null,
      // Main theme A
      48, null, 52, null, 48, null, 52, null, 45, null, 48, null, 45, null, 48, null,
      43, null, 47, null, 50, null, 53, null, 48, null, 52, null, 47, null, null, null,
      // Main theme A repeat
      48, null, 52, null, 48, null, 52, null, 45, null, 48, null, 45, null, 48, null,
      43, null, 47, null, 50, null, 53, null, 48, null, 52, null, 47, null, null, null,
      // Bridge B
      53, null, 57, null, 60, null, 53, null, 52, null, 56, null, 59, null, 52, null,
      53, null, 57, null, 60, null, 53, null, 60, null, 64, null, 67, null, null, null,
      53, null, 57, null, 60, null, 53, null, 52, null, 56, null, 59, null, 52, null,
      51, null, 55, null, 50, null, 54, null, 48, null, 52, null, null, null, null, null,
      // Main theme A again
      48, null, 52, null, 48, null, 52, null, 45, null, 48, null, 45, null, 48, null,
      43, null, 47, null, 50, null, 53, null, 48, null, 52, null, 47, null, null, null,
      // Ending flourish
      48, null, 52, null, 48, null, 52, null, 45, null, 48, null, 45, null, 48, null,
      43, null, 47, null, 50, null, 53, null, 48, null, 52, null, 47, null, null, null,
    ],
    // Bass - Triangle wave
    ch4: [
      // Intro
      36, null, null, null, 36, null, null, null, 43, null, null, null, 43, null, null, null,
      // Main theme A
      36, null, null, 43, null, null, 48, null, null, 45, null, null, 43, null, 45, null,
      43, null, null, null, 43, null, null, null, 48, null, null, null, 47, null, null, null,
      // Main theme A repeat
      36, null, null, 43, null, null, 48, null, null, 45, null, null, 43, null, 45, null,
      43, null, null, null, 43, null, null, null, 48, null, null, null, 47, null, null, null,
      // Bridge B
      41, null, null, null, 40, null, null, null, 41, null, null, null, 40, null, null, null,
      41, null, null, null, 40, null, null, null, 48, null, null, null, 48, null, null, null,
      41, null, null, null, 40, null, null, null, 41, null, null, null, 40, null, null, null,
      39, null, null, null, 38, null, null, null, 36, null, null, null, null, null, null, null,
      // Main theme A again
      36, null, null, 43, null, null, 48, null, null, 45, null, null, 43, null, 45, null,
      43, null, null, null, 43, null, null, null, 48, null, null, null, 47, null, null, null,
      // Ending flourish
      36, null, null, 43, null, null, 48, null, null, 45, null, null, 43, null, 45, null,
      43, null, null, null, 43, null, null, null, 48, null, null, null, 47, null, null, null,
    ],
    // Extra channel - rhythmic accents
    ch5: [
      // Intro
      null, null, 76, null, null, null, 76, null, null, null, 79, null, null, null, null, null,
      // Main theme A
      null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
      null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
      // Main theme A repeat
      null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
      null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
      // Bridge B
      null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
      null, null, null, null, null, null, null, null, 84, null, 84, null, 84, null, null, null,
      null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
      null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
      // Main theme A again
      null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
      null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
      // Ending flourish
      null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
      null, 84, null, 84, null, 84, null, null, 84, null, null, null, null, null, null, null,
    ],
  },

  underground: {
    name: 'Underground',
    tempo: 125,
    // Mysterious staccato melody
    ch1: [
      48, null, 60, null, 55, null, 51, null, 52, null, 55, null, null, null, null, null,
      48, null, 60, null, 55, null, 51, null, 52, null, 55, null, null, null, null, null,
      51, null, 63, null, 58, null, 54, null, 55, null, 58, null, null, null, null, null,
      51, null, 63, null, 58, null, 54, null, 55, null, 58, null, null, null, null, null,
      48, null, 60, null, 55, null, 51, null, 52, null, 55, null, null, null, null, null,
      48, null, 60, null, 55, null, 51, null, 52, null, 55, null, null, null, null, null,
      53, null, 65, null, 60, null, 56, null, 57, null, 60, null, null, null, null, null,
      53, null, 65, null, 60, null, 56, null, 57, null, 60, null, null, null, null, null,
    ],
    // Lower octave doubling
    ch2: [
      36, null, 48, null, 43, null, 39, null, 40, null, 43, null, null, null, null, null,
      36, null, 48, null, 43, null, 39, null, 40, null, 43, null, null, null, null, null,
      39, null, 51, null, 46, null, 42, null, 43, null, 46, null, null, null, null, null,
      39, null, 51, null, 46, null, 42, null, 43, null, 46, null, null, null, null, null,
      36, null, 48, null, 43, null, 39, null, 40, null, 43, null, null, null, null, null,
      36, null, 48, null, 43, null, 39, null, 40, null, 43, null, null, null, null, null,
      41, null, 53, null, 48, null, 44, null, 45, null, 48, null, null, null, null, null,
      41, null, 53, null, 48, null, 44, null, 45, null, 48, null, null, null, null, null,
    ],
    // Chromatic fills
    ch3: [
      null, null, null, null, null, null, null, null, null, null, null, null, 54, 55, 56, 57,
      null, null, null, null, null, null, null, null, null, null, null, null, 54, 55, 56, 57,
      null, null, null, null, null, null, null, null, null, null, null, null, 57, 58, 59, 60,
      null, null, null, null, null, null, null, null, null, null, null, null, 57, 58, 59, 60,
      null, null, null, null, null, null, null, null, null, null, null, null, 54, 55, 56, 57,
      null, null, null, null, null, null, null, null, null, null, null, null, 54, 55, 56, 57,
      null, null, null, null, null, null, null, null, null, null, null, null, 59, 60, 61, 62,
      null, null, null, null, null, null, null, null, null, null, null, null, 59, 60, 61, 62,
    ],
    // Deep bass
    ch4: [
      24, null, null, null, 24, null, null, null, 24, null, null, null, 24, null, null, null,
      24, null, null, null, 24, null, null, null, 24, null, null, null, 24, null, null, null,
      27, null, null, null, 27, null, null, null, 27, null, null, null, 27, null, null, null,
      27, null, null, null, 27, null, null, null, 27, null, null, null, 27, null, null, null,
      24, null, null, null, 24, null, null, null, 24, null, null, null, 24, null, null, null,
      24, null, null, null, 24, null, null, null, 24, null, null, null, 24, null, null, null,
      29, null, null, null, 29, null, null, null, 29, null, null, null, 29, null, null, null,
      29, null, null, null, 29, null, null, null, 29, null, null, null, 29, null, null, null,
    ],
    // Percussion hits
    ch5: [
      null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
      72, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
      null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
      72, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
      null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
      72, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
      null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
      72, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
    ],
  },

  underwater: {
    name: 'Underwater',
    tempo: 140,
    // Waltz melody (3/4 feel in 4/4)
    ch1: [
      72, null, null, 79, null, null, 77, null, null, 76, null, null, 74, null, null, null,
      72, null, null, 77, null, null, 76, null, null, 74, null, null, 72, null, null, null,
      71, null, null, 76, null, null, 74, null, null, 72, null, null, 71, null, null, null,
      72, null, null, 74, null, null, 76, null, null, 77, null, null, 79, null, null, null,
      81, null, null, 79, null, null, 77, null, null, 76, null, null, 74, null, null, null,
      76, null, null, 74, null, null, 72, null, null, 71, null, null, 69, null, null, null,
      72, null, null, 76, null, null, 79, null, null, 84, null, null, 79, null, null, null,
      77, null, null, null, null, null, 76, null, null, null, null, null, null, null, null, null,
    ],
    // Counter melody
    ch2: [
      60, null, null, 67, null, null, 65, null, null, 64, null, null, 62, null, null, null,
      60, null, null, 65, null, null, 64, null, null, 62, null, null, 60, null, null, null,
      59, null, null, 64, null, null, 62, null, null, 60, null, null, 59, null, null, null,
      60, null, null, 62, null, null, 64, null, null, 65, null, null, 67, null, null, null,
      69, null, null, 67, null, null, 65, null, null, 64, null, null, 62, null, null, null,
      64, null, null, 62, null, null, 60, null, null, 59, null, null, 57, null, null, null,
      60, null, null, 64, null, null, 67, null, null, 72, null, null, 67, null, null, null,
      65, null, null, null, null, null, 64, null, null, null, null, null, null, null, null, null,
    ],
    // Arpeggios
    ch3: [
      48, 52, 55, 52, 48, 52, 55, 52, 47, 50, 55, 50, 47, 50, 55, 50,
      48, 52, 55, 52, 48, 52, 55, 52, 47, 50, 55, 50, 47, 50, 55, 50,
      47, 50, 55, 50, 47, 50, 55, 50, 48, 52, 55, 52, 48, 52, 55, 52,
      48, 52, 55, 52, 50, 53, 57, 53, 48, 52, 55, 52, 50, 53, 57, 53,
      53, 57, 60, 57, 52, 55, 59, 55, 50, 53, 57, 53, 48, 52, 55, 52,
      50, 53, 57, 53, 48, 52, 55, 52, 47, 50, 55, 50, 45, 48, 53, 48,
      48, 52, 55, 52, 50, 53, 57, 53, 52, 55, 59, 55, 55, 59, 62, 59,
      53, 57, 60, null, null, null, 52, 55, 59, null, null, null, null, null, null, null,
    ],
    // Bass waltz pattern
    ch4: [
      36, null, null, 43, null, null, 36, null, null, 43, null, null, 35, null, null, null,
      36, null, null, 43, null, null, 36, null, null, 43, null, null, 35, null, null, null,
      35, null, null, 43, null, null, 36, null, null, 43, null, null, 35, null, null, null,
      36, null, null, 43, null, null, 38, null, null, 45, null, null, 36, null, null, null,
      41, null, null, 48, null, null, 40, null, null, 47, null, null, 38, null, null, null,
      38, null, null, 45, null, null, 36, null, null, 43, null, null, 33, null, null, null,
      36, null, null, 43, null, null, 38, null, null, 45, null, null, 40, null, null, null,
      41, null, null, null, null, null, 40, null, null, null, null, null, null, null, null, null,
    ],
    // Bubbles / high accents
    ch5: [
      null, null, null, null, null, null, null, null, null, null, 91, null, null, null, null, null,
      null, null, null, null, null, null, 91, null, null, null, null, null, null, null, null, null,
      null, null, null, null, null, null, null, null, null, null, null, null, 91, null, null, null,
      null, null, null, null, null, null, null, null, 91, null, null, null, null, null, null, null,
      null, null, 93, null, null, null, null, null, null, null, null, null, null, null, 91, null,
      null, null, null, null, 91, null, null, null, null, null, null, null, null, null, null, null,
      null, null, null, null, null, null, 91, null, null, null, null, null, 93, null, null, null,
      null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
    ],
  },

  castle: {
    name: 'Castle Theme',
    tempo: 112,
    // Tense chromatic melody
    ch1: [
      60, 63, 67, 72, 75, 79, 84, 79, 75, 72, 67, 63, 60, null, null, null,
      59, 62, 66, 71, 74, 78, 83, 78, 74, 71, 66, 62, 59, null, null, null,
      60, 63, 67, 72, 75, 79, 84, 79, 75, 72, 67, 63, 60, null, null, null,
      61, 64, 68, 73, 76, 80, 85, 80, 76, 73, 68, 64, 61, null, null, null,
      60, 63, 67, 72, 75, 79, 84, 79, 75, 72, 67, 63, 60, null, null, null,
      59, 62, 66, 71, 74, 78, 83, 78, 74, 71, 66, 62, 59, null, null, null,
      60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, null, null, null,
      72, 71, 70, 69, 68, 67, 66, 65, 64, 63, 62, 61, 60, null, null, null,
    ],
    // Parallel thirds below
    ch2: [
      56, 59, 63, 68, 71, 75, 80, 75, 71, 68, 63, 59, 56, null, null, null,
      55, 58, 62, 67, 70, 74, 79, 74, 70, 67, 62, 58, 55, null, null, null,
      56, 59, 63, 68, 71, 75, 80, 75, 71, 68, 63, 59, 56, null, null, null,
      57, 60, 64, 69, 72, 76, 81, 76, 72, 69, 64, 60, 57, null, null, null,
      56, 59, 63, 68, 71, 75, 80, 75, 71, 68, 63, 59, 56, null, null, null,
      55, 58, 62, 67, 70, 74, 79, 74, 70, 67, 62, 58, 55, null, null, null,
      56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, null, null, null,
      68, 67, 66, 65, 64, 63, 62, 61, 60, 59, 58, 57, 56, null, null, null,
    ],
    // Tremolo effect
    ch3: [
      48, 51, 48, 51, 48, 51, 48, 51, 48, 51, 48, 51, 48, 51, 48, 51,
      47, 50, 47, 50, 47, 50, 47, 50, 47, 50, 47, 50, 47, 50, 47, 50,
      48, 51, 48, 51, 48, 51, 48, 51, 48, 51, 48, 51, 48, 51, 48, 51,
      49, 52, 49, 52, 49, 52, 49, 52, 49, 52, 49, 52, 49, 52, 49, 52,
      48, 51, 48, 51, 48, 51, 48, 51, 48, 51, 48, 51, 48, 51, 48, 51,
      47, 50, 47, 50, 47, 50, 47, 50, 47, 50, 47, 50, 47, 50, 47, 50,
      48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 59, 58, 57,
      56, 55, 54, 53, 52, 51, 50, 49, 48, 47, 46, 45, 44, null, null, null,
    ],
    // Pulsing bass
    ch4: [
      36, 36, 36, 36, 36, 36, 36, 36, 36, 36, 36, 36, 36, null, null, null,
      35, 35, 35, 35, 35, 35, 35, 35, 35, 35, 35, 35, 35, null, null, null,
      36, 36, 36, 36, 36, 36, 36, 36, 36, 36, 36, 36, 36, null, null, null,
      37, 37, 37, 37, 37, 37, 37, 37, 37, 37, 37, 37, 37, null, null, null,
      36, 36, 36, 36, 36, 36, 36, 36, 36, 36, 36, 36, 36, null, null, null,
      35, 35, 35, 35, 35, 35, 35, 35, 35, 35, 35, 35, 35, null, null, null,
      36, 36, 37, 37, 38, 38, 39, 39, 40, 40, 41, 41, 42, 42, 43, 43,
      43, 43, 42, 42, 41, 41, 40, 40, 39, 39, 38, 38, 37, 37, 36, null,
    ],
    // Dramatic stabs
    ch5: [
      84, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
      83, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
      84, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
      85, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
      84, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
      83, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
      null, null, null, null, null, null, null, null, null, null, null, null, 84, null, null, null,
      null, null, null, null, null, null, null, null, null, null, null, null, 72, null, null, null,
    ],
  },

  starman: {
    name: 'Starman',
    tempo: 220,
    // Fast energetic melody
    ch1: [
      72, 72, 72, null, 72, null, 72, 72, 74, null, 72, null, null, 67, null, null,
      72, 72, 72, null, 72, null, 72, 72, 74, 72, null, null, null, null, null, null,
      79, 79, 79, null, 79, null, 79, 79, 81, null, 79, null, null, 74, null, null,
      79, 79, 79, null, 79, null, 79, 79, 81, 79, null, null, null, null, null, null,
      84, 84, 84, null, 84, null, 84, 84, 86, null, 84, null, null, 79, null, null,
      84, 84, 84, null, 84, null, 84, 84, 86, 84, null, null, null, null, null, null,
      79, 81, 84, null, 79, 81, 84, null, 79, 81, 84, 86, 88, null, null, null,
      88, 86, 84, 81, 79, 77, 76, 74, 72, null, null, null, null, null, null, null,
    ],
    // Harmony thirds
    ch2: [
      67, 67, 67, null, 67, null, 67, 67, 69, null, 67, null, null, 62, null, null,
      67, 67, 67, null, 67, null, 67, 67, 69, 67, null, null, null, null, null, null,
      74, 74, 74, null, 74, null, 74, 74, 76, null, 74, null, null, 69, null, null,
      74, 74, 74, null, 74, null, 74, 74, 76, 74, null, null, null, null, null, null,
      79, 79, 79, null, 79, null, 79, 79, 81, null, 79, null, null, 74, null, null,
      79, 79, 79, null, 79, null, 79, 79, 81, 79, null, null, null, null, null, null,
      74, 76, 79, null, 74, 76, 79, null, 74, 76, 79, 81, 83, null, null, null,
      83, 81, 79, 76, 74, 72, 71, 69, 67, null, null, null, null, null, null, null,
    ],
    // Driving rhythm
    ch3: [
      60, null, 60, null, 60, null, 60, null, 62, null, 60, null, 55, null, 55, null,
      60, null, 60, null, 60, null, 60, null, 62, 60, 55, null, null, null, null, null,
      67, null, 67, null, 67, null, 67, null, 69, null, 67, null, 62, null, 62, null,
      67, null, 67, null, 67, null, 67, null, 69, 67, 62, null, null, null, null, null,
      72, null, 72, null, 72, null, 72, null, 74, null, 72, null, 67, null, 67, null,
      72, null, 72, null, 72, null, 72, null, 74, 72, 67, null, null, null, null, null,
      67, 69, 72, null, 67, 69, 72, null, 67, 69, 72, 74, 76, null, null, null,
      76, 74, 72, 69, 67, 65, 64, 62, 60, null, null, null, null, null, null, null,
    ],
    // Running bass
    ch4: [
      48, 48, 48, null, 48, null, 48, 48, 50, null, 48, null, null, 43, null, null,
      48, 48, 48, null, 48, null, 48, 48, 50, 48, null, null, null, null, null, null,
      55, 55, 55, null, 55, null, 55, 55, 57, null, 55, null, null, 50, null, null,
      55, 55, 55, null, 55, null, 55, 55, 57, 55, null, null, null, null, null, null,
      60, 60, 60, null, 60, null, 60, 60, 62, null, 60, null, null, 55, null, null,
      60, 60, 60, null, 60, null, 60, 60, 62, 60, null, null, null, null, null, null,
      55, 57, 60, null, 55, 57, 60, null, 55, 57, 60, 62, 64, null, null, null,
      64, 62, 60, 57, 55, 53, 52, 50, 48, null, null, null, null, null, null, null,
    ],
    // Sparkle effects
    ch5: [
      96, null, null, null, 96, null, null, null, 96, null, null, null, 96, null, null, null,
      96, null, 96, null, 96, null, 96, null, 96, null, null, null, null, null, null, null,
      98, null, null, null, 98, null, null, null, 98, null, null, null, 98, null, null, null,
      98, null, 98, null, 98, null, 98, null, 98, null, null, null, null, null, null, null,
      100, null, null, null, 100, null, null, null, 100, null, null, null, 100, null, null, null,
      100, null, 100, null, 100, null, 100, null, 100, null, null, null, null, null, null, null,
      96, null, 98, null, 100, null, 96, null, 98, null, 100, null, 103, null, null, null,
      null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
    ],
  },

  gameover: {
    name: 'Game Over',
    tempo: 100,
    // Sad descending melody
    ch1: [
      72, null, 71, null, 69, null, null, null, 67, null, 65, null, 64, null, null, null,
      65, null, 64, null, 62, null, null, null, 60, null, null, null, null, null, null, null,
      null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
      null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
    ],
    // Harmony
    ch2: [
      67, null, 66, null, 64, null, null, null, 62, null, 60, null, 59, null, null, null,
      60, null, 59, null, 57, null, null, null, 55, null, null, null, null, null, null, null,
      null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
      null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
    ],
    // Low drone
    ch3: [
      48, null, null, null, 47, null, null, null, 45, null, null, null, 44, null, null, null,
      43, null, null, null, 41, null, null, null, 40, null, null, null, null, null, null, null,
      null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
      null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
    ],
    // Bass descent
    ch4: [
      36, null, null, null, 35, null, null, null, 33, null, null, null, 32, null, null, null,
      31, null, null, null, 29, null, null, null, 28, null, null, null, null, null, null, null,
      null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
      null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
    ],
    // Silent
    ch5: [
      null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
      null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
      null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
      null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
    ],
  },

  coin: {
    name: 'Coin',
    tempo: 300,
    // Coin sound effect (short)
    ch1: [
      83, null, 95, null, null, null, null, null, null, null, null, null, null, null, null, null,
    ],
    ch2: [
      79, null, 91, null, null, null, null, null, null, null, null, null, null, null, null, null,
    ],
    ch3: [
      null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
    ],
    ch4: [
      null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
    ],
    ch5: [
      null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
    ],
  },

  oneup: {
    name: '1-Up',
    tempo: 280,
    // 1-Up jingle
    ch1: [
      76, null, 80, null, 83, null, 88, null, 91, null, 95, null, null, null, null, null,
    ],
    ch2: [
      72, null, 76, null, 79, null, 84, null, 87, null, 91, null, null, null, null, null,
    ],
    ch3: [
      null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
    ],
    ch4: [
      null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
    ],
    ch5: [
      null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
    ],
  },

  // ===== SUPER NINTENDO (SNES) SONGS =====
  // Transcribed from actual MIDI files

  smw: {
    name: 'SMW Overworld',
    tempo: 132,
    // Super Mario World - Overworld Theme (from MIDI: smw_ovr1.mid)
    // Dense extraction with held notes
    ch1: [
      // Lead melody (dense)
      69, 69, 69, 69, 65, 65, 65, 60, 62, 65, null, 65, 65, 65, 65, 62,
      60, null, 65, null, 65, null, 72, 72, 69, 69, 69, 67, 67, 67, 67, 60,
      69, 69, 69, 69, 65, 65, 65, 60, 62, 65, null, 65, 65, 65, 65, 62,
      60, null, 65, null, 70, 69, 67, 65, 65, 65, 65, 65, 65, 65, 65, null,
      69, 69, 69, 69, 65, 65, 65, 60, 62, 65, null, 65, 65, 65, 65, 62,
      60, null, 65, null, 65, null, 72, 72, 69, 69, 69, 67, 67, 67, 67, 60,
      69, 69, 69, 69, 65, 65, 65, 60, 62, 65, null, 65, 65, 65, 65, 62,
      60, null, 65, null, 70, 69, 67, 65, 65, 65, 65, 65, 65, 65, 65, null,
      69, 69, 69, 65, 65, 65, 60, 60, 69, 69, 69, 65, 65, 65, 65, 65,
      68, 65, 60, null, 68, 68, 68, 67, 67, 67, 67, 67, 67, 67, 67, 67,
      69, 69, 69, 65, 65, 65, 60, 60, 69, 69, 69, 65, 65, 65, 65, 65,
      68, 65, 60, 60, 72, 72, 72, 72, 72, 72, 72, 72, 72, 72, 72, 72,
    ],
    // Harmony (derived from melody, 4th below)
    ch2: [
      65, 65, 65, 65, 62, 62, 62, 57, 59, 62, null, 62, 62, 62, 62, 59,
      57, null, 62, null, 62, null, 69, 69, 65, 65, 65, 64, 64, 64, 64, 57,
      65, 65, 65, 65, 62, 62, 62, 57, 59, 62, null, 62, 62, 62, 62, 59,
      57, null, 62, null, 67, 65, 64, 62, 62, 62, 62, 62, 62, 62, 62, null,
      65, 65, 65, 65, 62, 62, 62, 57, 59, 62, null, 62, 62, 62, 62, 59,
      57, null, 62, null, 62, null, 69, 69, 65, 65, 65, 64, 64, 64, 64, 57,
      65, 65, 65, 65, 62, 62, 62, 57, 59, 62, null, 62, 62, 62, 62, 59,
      57, null, 62, null, 67, 65, 64, 62, 62, 62, 62, 62, 62, 62, 62, null,
      65, 65, 65, 62, 62, 62, 57, 57, 65, 65, 65, 62, 62, 62, 62, 62,
      65, 62, 57, null, 65, 65, 65, 64, 64, 64, 64, 64, 64, 64, 64, 64,
      65, 65, 65, 62, 62, 62, 57, 57, 65, 65, 65, 62, 62, 62, 62, 62,
      65, 62, 57, 57, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69,
    ],
    // Steel drums rhythm (Ching chigga)
    ch3: [
      81, null, 81, 81, 81, null, 81, 81, 82, null, 82, 82, 83, null, 83, 83,
      81, null, 81, 81, 80, null, 80, 80, 81, null, 81, 81, 81, null, 81, 81,
      81, null, 81, 81, 81, null, 81, 81, 82, null, 82, 82, 83, null, 83, 83,
      82, null, 82, 82, 82, null, 82, 82, 81, null, 81, 81, 81, null, 81, 81,
      81, null, 81, 81, 81, null, 81, 81, 82, null, 82, 82, 83, null, 83, 83,
      81, null, 81, 81, 80, null, 80, 80, 81, null, 81, 81, 81, null, 81, 81,
      81, null, 81, 81, 81, null, 81, 81, 82, null, 82, 82, 83, null, 83, 83,
      82, null, 82, 82, 82, null, 82, 82, 81, null, 81, 81, 81, null, 81, 81,
      82, null, 82, 82, 82, null, 82, 82, 81, null, 81, 81, 81, 81, 81, 81,
      80, null, 80, 80, 80, null, 80, 80, 79, null, 79, 79, 79, null, 79, 79,
      82, null, 82, 82, 82, null, 82, 82, 81, null, 81, 81, 81, 81, 81, 81,
      80, null, 80, 80, 80, null, 80, 80, 79, null, 79, 79, 79, null, 79, 79,
    ],
    // Bass (dense)
    ch4: [
      41, 41, null, null, 45, 45, null, null, 46, 46, null, null, 47, 47, null, null,
      45, 45, null, null, 44, 44, null, null, 43, 43, 36, 36, 38, 38, 40, 40,
      41, 41, null, null, 45, 45, null, null, 46, 46, null, null, 47, 47, null, null,
      48, 48, 36, 36, 40, 40, 43, 43, 41, 41, 36, 36, 41, 41, null, null,
      41, 41, null, null, 45, 45, null, null, 46, 46, null, null, 47, 47, null, null,
      45, 45, null, null, 44, 44, null, null, 43, 43, 36, 36, 38, 38, 40, 40,
      41, 41, null, null, 45, 45, null, null, 46, 46, null, null, 47, 47, null, null,
      48, 48, 36, 36, 40, 40, 43, 43, 41, 41, 36, 36, 41, 41, null, null,
      45, 45, 46, 46, 48, 48, 50, 50, 48, 48, 45, 45, 41, 41, 43, 43,
      44, 44, 48, 48, 50, 50, 53, 53, 55, 55, 53, 53, 52, 52, 48, 48,
      46, 46, 45, 45, 46, 46, 48, 48, 53, 53, 52, 52, 48, 48, 45, 45,
      47, 47, 48, 48, 53, 53, 48, 48, 46, 46, 50, 50, 48, 48, 52, 52,
    ],
    // Lower bass doubling
    ch5: [
      41, 41, null, null, 45, 45, null, null, 46, 46, null, null, 47, 47, null, null,
      45, 45, null, null, 44, 44, null, null, 43, 43, 36, 36, 38, 38, 40, 40,
      41, 41, null, null, 45, 45, null, null, 46, 46, null, null, 47, 47, null, null,
      48, 48, 36, 36, 40, 40, 43, 43, 41, 41, 36, 36, 41, 41, null, null,
      41, 41, null, null, 45, 45, null, null, 46, 46, null, null, 47, 47, null, null,
      45, 45, null, null, 44, 44, null, null, 43, 43, 36, 36, 38, 38, 40, 40,
      41, 41, null, null, 45, 45, null, null, 46, 46, null, null, 47, 47, null, null,
      48, 48, 36, 36, 40, 40, 43, 43, 41, 41, 36, 36, 41, 41, null, null,
      null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
      null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
      null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
      null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
    ],
  },

  zelda: {
    name: 'Zelda LTTP Intro',
    tempo: 68,
    // Zelda: A Link to the Past - Title/Intro Theme (from MIDI: Intro-3.mid)
    // Dense extraction - tempo halved for correct speed
    ch1: [
      // Main melody - Strings 1 (chromatic buildup G-G#-A-A#, then B with resolution)
      null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
      null, null, null, null, 67, 67, 67, 67, 67, 67, 67, 67, 67, 67, 67, 67,
      null, null, null, null, 68, 68, 68, 68, 68, 68, 68, 68, 68, 68, 68, 68,
      null, null, null, null, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69,
      null, null, null, null, 70, 70, 70, 70, 70, 70, 70, 70, 70, 70, 70, 70,
      null, null, null, null, 67, 67, 67, 67, 67, 67, 67, 67, 67, 67, 67, 67,
      null, null, null, null, 68, 68, 68, 68, 68, 68, 68, 68, 68, 68, 68, 68,
      null, null, null, null, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69,
      null, null, null, null, 70, 70, 70, 70, 70, 70, 70, 70, 70, 70, null, null,
      71, 71, 71, 71, 71, 71, 71, 71, 71, 71, 71, 71, 69, 69, 67, 67,
      69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, null, null,
      74, 74, 74, 74, 74, 74, 74, 74, 74, 74, 74, 74, 72, 72, 70, 70,
    ],
    // Harmony strings - Strings 2 (parallel 5ths below)
    ch2: [
      null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
      null, null, null, null, 62, 62, 62, 62, 62, 62, 62, 62, 62, 62, 62, 62,
      null, null, null, null, 63, 63, 63, 63, 63, 63, 63, 63, 63, 63, 63, 63,
      63, null, null, null, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64,
      64, null, null, null, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65,
      65, null, null, null, 62, 62, 62, 62, 62, 62, 62, 62, 62, 62, 62, 62,
      62, null, null, null, 63, 63, 63, 63, 63, 63, 63, 63, 63, 63, 63, 63,
      63, null, null, null, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64,
      64, null, null, null, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, null,
      null, null, null, null, 67, 67, 67, 67, 67, 67, 67, 67, 67, 67, 67, null,
      null, null, null, null, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65,
      null, null, null, null, 70, 70, 70, 70, 70, 70, 70, 70, 70, 70, 70, 70,
    ],
    // Bass arpeggios - Strings 3 (C-G-C pattern)
    ch3: [
      null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
      36, 36, 43, 43, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, null,
      36, 36, 43, 43, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, null,
      36, 36, 43, 43, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, null,
      36, 36, 43, 43, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, null,
      36, 36, 43, 43, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48,
      36, 36, 43, 43, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, null, null,
      36, 36, 43, 43, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, null,
      36, 36, 43, 43, 48, 48, 48, 48, 48, 48, 48, 48, 48, 48, null, null,
      41, 41, 48, 48, 53, 53, 53, 53, 53, 53, 53, 53, 53, 53, null, null,
      46, 46, 53, 53, 58, 58, 58, 58, 58, 58, 58, 58, 58, 58, 58, null,
      39, 39, 46, 46, 51, 51, 51, 51, 51, 51, 51, 51, 51, 51, null, null,
    ],
    // Upper strings - Strings 5 (enters later, adds richness)
    ch4: [
      null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
      null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
      null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
      null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
      null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
      67, 67, 67, 67, 67, 67, 67, 67, 67, 67, 67, 67, 67, 67, 67, 67,
      68, 68, 68, 68, 68, 68, 68, 68, 68, 68, 68, 68, 68, 68, 68, 68,
      69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69,
      70, 70, 70, 70, 70, 70, 70, 70, 70, 70, 70, 70, 70, 70, 70, 70,
      67, 67, 67, 67, 67, 67, 67, 67, 67, 67, 67, 67, 67, 67, 67, 67,
      65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65,
      70, 70, 70, 70, 70, 70, 70, 70, 70, 70, 70, 70, 70, 70, 70, 70,
    ],
    // Lower harmony - Strings 6 (parallel motion)
    ch5: [
      null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
      null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
      null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
      null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
      null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
      62, 62, 62, 62, 62, 62, 62, 62, 62, 62, 62, 62, 62, 62, 62, 62,
      63, 63, 63, 63, 63, 63, 63, 63, 63, 63, 63, 63, 63, 63, 63, 63,
      64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64,
      65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65,
      64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64,
      60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60,
      67, 67, 67, 67, 67, 67, 67, 67, 67, 67, 67, 67, 67, 67, 67, 67,
    ],
  },

  zeldadark: {
    name: 'Zelda Dark World',
    tempo: 96,
    // The Legend of Zelda: A Link to the Past - Dark World Theme
    // Transcribed from MIDI: Dark-World-06.mid (dense extraction)
    // Tempo halved from 192 to 96 for correct playback speed
    ch1: [
      // Main melody - Trumpet (dense, with held notes)
      67, 67, 67, 67, 67, 67, 67, 67, 67, null, 60, null, 67, null, 72, null,
      72, 70, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, null, 65, null,
      67, 67, 67, 67, 60, 60, 60, 60, 60, 60, 60, 60, 60, null, 65, null,
      65, 63, 62, 62, 62, 62, 62, 62, 62, 62, 62, 62, 62, null, 58, 58,
      60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60,
      null, null, null, null, null, null, null, null, null, null, null, null, null, null, 60, null,
      67, 67, 67, 67, 67, 67, 67, 67, 67, null, 60, null, 67, null, 72, null,
      72, 70, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, null, 65, null,
      67, 67, 67, 67, 60, 60, 60, 60, 60, 60, 60, 60, 60, null, 65, null,
      65, 63, 62, 62, 62, 62, 62, 62, 62, 62, 62, 62, 62, null, 58, 58,
      60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60,
      null, null, null, null, null, null, null, null, null, null, null, null, null, null, 79, 81,
    ],
    // Harmony - Trumpet 2 (parallel harmonies)
    ch2: [
      63, 63, 63, 63, 63, 63, 63, 63, 63, null, 55, null, 63, null, 67, null,
      67, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, null, 62, null,
      63, 63, 63, 63, 56, 56, 56, 56, 56, 56, 56, 56, 56, null, 62, null,
      62, 60, 58, 58, 58, 58, 58, 58, 58, 58, 58, 58, 58, null, 55, 55,
      55, 55, 55, 55, 55, 55, 55, 55, 55, 55, 55, 55, 55, 55, 55, 55,
      null, null, null, null, null, null, null, null, null, null, null, null, null, null, 55, null,
      63, 63, 63, 63, 63, 63, 63, 63, 63, null, 55, null, 63, null, 67, null,
      67, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, null, 62, null,
      63, 63, 63, 63, 56, 56, 56, 56, 56, 56, 56, 56, 56, null, 62, null,
      62, 60, 58, 58, 58, 58, 58, 58, 58, 58, 58, 58, 58, null, 55, 55,
      55, 55, 55, 55, 55, 55, 55, 55, 55, 55, 55, 55, 55, 55, 55, 55,
      null, null, null, null, null, null, null, null, null, null, null, null, null, null, 67, 69,
    ],
    // Synth Brass (reinforces melody)
    ch3: [
      67, 67, 67, 67, 67, 67, 67, 67, 67, null, 60, null, 67, null, 72, null,
      72, 70, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, null, 65, null,
      67, 67, 67, 67, 60, 60, 60, 60, 60, 60, 60, 60, 60, null, 65, null,
      65, 63, 62, 62, 62, 62, 62, 62, 62, 62, 62, 62, 62, null, 58, null,
      60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60,
      null, null, null, null, null, null, null, null, null, null, null, null, null, null, 60, null,
      67, 67, 67, 67, 67, 67, 67, 67, 67, null, 60, null, 67, null, 72, null,
      72, 70, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, 69, null, 65, null,
      67, 67, 67, 67, 60, 60, 60, 60, 60, 60, 60, 60, 60, null, 65, null,
      65, 63, 62, 62, 62, 62, 62, 62, 62, 62, 62, 62, 62, null, 58, null,
      60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60,
      null, null, null, null, null, null, null, null, null, null, null, null, null, null, 67, 69,
    ],
    // Bass - C-F-Ab-Bb progression
    ch4: [
      36, 36, null, null, 36, 36, null, null, 36, 36, null, null, null, null, 36, null,
      41, 41, null, null, 41, 41, null, null, 41, 41, null, null, null, null, 41, null,
      44, 44, null, null, 44, 44, null, null, 44, 44, null, null, null, null, 44, null,
      46, 46, null, null, 46, 46, null, null, 46, 46, null, null, null, null, 46, null,
      36, 36, null, null, 36, 36, null, null, 36, 36, null, null, null, null, 36, null,
      36, 36, null, null, 36, 36, null, null, 36, 36, null, null, null, null, 36, null,
      36, 36, null, null, 36, 36, null, null, 36, 36, null, null, null, null, 36, null,
      41, 41, null, null, 41, 41, null, null, 41, 41, null, null, null, null, 41, null,
      44, 44, null, null, 44, 44, null, null, 44, 44, null, null, null, null, 44, null,
      46, 46, null, null, 46, 46, null, null, 46, 46, null, null, null, null, 46, null,
      36, 36, null, null, 36, 36, null, null, 36, 36, null, null, null, null, 36, null,
      36, 36, null, null, 36, 36, null, null, 36, 36, null, null, null, null, 36, null,
    ],
    // Strings pad (sustained harmonics)
    ch5: [
      null, null, 67, null, 67, null, 67, 67, 67, null, 67, null, null, null, 67, null,
      null, null, 69, null, 69, null, 69, 69, 69, null, 69, null, null, null, 69, null,
      null, null, 67, null, 67, null, 67, 67, 67, null, 67, null, null, null, 67, null,
      null, null, 65, null, 65, null, 65, 65, 65, null, 65, null, null, null, 65, null,
      null, null, 67, null, 67, null, 67, 67, 67, null, 69, null, null, null, null, null,
      null, null, 70, null, 70, null, 70, 70, 70, null, 72, null, null, null, null, null,
      null, null, 67, null, 67, null, 67, 67, 67, null, 67, null, null, null, 67, null,
      null, null, 69, null, 69, null, 69, 69, 69, null, 69, null, null, null, 69, null,
      null, null, 67, null, 67, null, 67, 67, 67, null, 67, null, null, null, 67, null,
      null, null, 65, null, 65, null, 65, 65, 65, null, 65, null, null, null, 65, null,
      null, null, 67, null, 67, null, 67, 67, 67, null, 69, null, null, null, null, null,
      null, null, 70, null, 70, null, 70, 70, 70, null, 72, null, null, null, null, null,
    ],
  },
} as const
