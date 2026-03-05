//! Speech Synth v2 — English G2P formant synthesis.
//!
//! Converts English text into ARPABET phoneme sequences using ~200 contextual
//! rules (NRL-style), then synthesises via 3-formant resonators with
//! coarticulation, diphthongs, and typed excitation (voiced/unvoiced/stop/
//! affricate). Numbers are expanded to words. Robotic Daft Punk / Kraftwerk
//! aesthetic preserved.

use crate::common::{input_at, sample_at, Sample};
use crate::effects::choir::FormantFilter;

// ===========================================================================
// Section 1: Phoneme enum + ExcitationType
// ===========================================================================

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
#[repr(u8)]
#[allow(dead_code)]
enum Phoneme {
    // Monophthong vowels (11)
    IY, IH, EH, AE, AA, AH, AO, UH, UW, ER, AX,
    // Diphthongs (5)
    EY, AY, OY, AW, OW,
    // Stops (6)
    P, B, T, D, K, G,
    // Fricatives (9)
    F, V, TH, DH, S, Z, SH, ZH, HH,
    // Affricates (2)
    CH, JH,
    // Nasals (3)
    M, N, NG,
    // Liquids/Glides (4)
    L, R, W, Y,
    // Silence/Pauses
    SIL,
    PauseShort,
    PauseLong,
}

#[derive(Clone, Copy, PartialEq, Debug)]
enum ExcitationType {
    Voiced,
    Unvoiced,
    Mixed,
    StopVoiced,
    StopUnvoiced,
    Affricate,
    Silent,
}

// ===========================================================================
// Section 2: Phoneme data table (ARPABET, 39 phonemes)
// ===========================================================================

#[derive(Clone, Copy)]
struct PhonemeData {
    f1: f32,
    f2: f32,
    f3: f32,
    f1_end: f32,
    f2_end: f32,
    f3_end: f32,
    is_diphthong: bool,
    voiced: f32,
    amp: f32,
    dur_mult: f32,
    excitation: ExcitationType,
}

const SIL_DATA: PhonemeData = PhonemeData {
    f1: 400.0, f2: 1200.0, f3: 2500.0,
    f1_end: 400.0, f2_end: 1200.0, f3_end: 2500.0,
    is_diphthong: false,
    voiced: 0.0, amp: 0.0, dur_mult: 0.4,
    excitation: ExcitationType::Silent,
};

fn phoneme_data(p: Phoneme) -> PhonemeData {
    use Phoneme::*;
    use ExcitationType::*;
    match p {
        // Monophthong vowels (Peterson & Barney 1952, Hillenbrand 1995)
        IY => PhonemeData { f1: 270.0, f2: 2290.0, f3: 3010.0, f1_end: 270.0, f2_end: 2290.0, f3_end: 3010.0, is_diphthong: false, voiced: 1.0, amp: 1.0, dur_mult: 1.0, excitation: Voiced },
        IH => PhonemeData { f1: 390.0, f2: 1990.0, f3: 2550.0, f1_end: 390.0, f2_end: 1990.0, f3_end: 2550.0, is_diphthong: false, voiced: 1.0, amp: 1.0, dur_mult: 0.8, excitation: Voiced },
        EH => PhonemeData { f1: 530.0, f2: 1840.0, f3: 2480.0, f1_end: 530.0, f2_end: 1840.0, f3_end: 2480.0, is_diphthong: false, voiced: 1.0, amp: 1.0, dur_mult: 0.9, excitation: Voiced },
        AE => PhonemeData { f1: 660.0, f2: 1720.0, f3: 2410.0, f1_end: 660.0, f2_end: 1720.0, f3_end: 2410.0, is_diphthong: false, voiced: 1.0, amp: 1.0, dur_mult: 1.0, excitation: Voiced },
        AA => PhonemeData { f1: 730.0, f2: 1090.0, f3: 2440.0, f1_end: 730.0, f2_end: 1090.0, f3_end: 2440.0, is_diphthong: false, voiced: 1.0, amp: 1.0, dur_mult: 1.0, excitation: Voiced },
        AH => PhonemeData { f1: 520.0, f2: 1190.0, f3: 2390.0, f1_end: 520.0, f2_end: 1190.0, f3_end: 2390.0, is_diphthong: false, voiced: 1.0, amp: 1.0, dur_mult: 0.8, excitation: Voiced },
        AO => PhonemeData { f1: 570.0, f2: 840.0,  f3: 2410.0, f1_end: 570.0, f2_end: 840.0,  f3_end: 2410.0, is_diphthong: false, voiced: 1.0, amp: 1.0, dur_mult: 1.0, excitation: Voiced },
        UH => PhonemeData { f1: 440.0, f2: 1020.0, f3: 2240.0, f1_end: 440.0, f2_end: 1020.0, f3_end: 2240.0, is_diphthong: false, voiced: 1.0, amp: 1.0, dur_mult: 0.8, excitation: Voiced },
        UW => PhonemeData { f1: 300.0, f2: 870.0,  f3: 2240.0, f1_end: 300.0, f2_end: 870.0,  f3_end: 2240.0, is_diphthong: false, voiced: 1.0, amp: 1.0, dur_mult: 1.0, excitation: Voiced },
        ER => PhonemeData { f1: 490.0, f2: 1350.0, f3: 1690.0, f1_end: 490.0, f2_end: 1350.0, f3_end: 1690.0, is_diphthong: false, voiced: 1.0, amp: 0.9, dur_mult: 0.9, excitation: Voiced },
        AX => PhonemeData { f1: 500.0, f2: 1500.0, f3: 2490.0, f1_end: 500.0, f2_end: 1500.0, f3_end: 2490.0, is_diphthong: false, voiced: 1.0, amp: 0.7, dur_mult: 0.5, excitation: Voiced },

        // Diphthongs (start → end formants)
        EY => PhonemeData { f1: 500.0, f2: 1700.0, f3: 2480.0, f1_end: 300.0, f2_end: 2200.0, f3_end: 3000.0, is_diphthong: true, voiced: 1.0, amp: 1.0, dur_mult: 1.2, excitation: Voiced },
        AY => PhonemeData { f1: 710.0, f2: 1100.0, f3: 2800.0, f1_end: 270.0, f2_end: 2290.0, f3_end: 3010.0, is_diphthong: true, voiced: 1.0, amp: 1.0, dur_mult: 1.2, excitation: Voiced },
        OY => PhonemeData { f1: 570.0, f2: 840.0,  f3: 2410.0, f1_end: 270.0, f2_end: 2290.0, f3_end: 3010.0, is_diphthong: true, voiced: 1.0, amp: 1.0, dur_mult: 1.3, excitation: Voiced },
        AW => PhonemeData { f1: 710.0, f2: 1100.0, f3: 2800.0, f1_end: 300.0, f2_end: 870.0,  f3_end: 2240.0, is_diphthong: true, voiced: 1.0, amp: 1.0, dur_mult: 1.2, excitation: Voiced },
        OW => PhonemeData { f1: 570.0, f2: 840.0,  f3: 2410.0, f1_end: 300.0, f2_end: 870.0,  f3_end: 2240.0, is_diphthong: true, voiced: 1.0, amp: 1.0, dur_mult: 1.2, excitation: Voiced },

        // Stops
        P  => PhonemeData { f1: 200.0, f2: 900.0,  f3: 2400.0, f1_end: 200.0, f2_end: 900.0,  f3_end: 2400.0, is_diphthong: false, voiced: 0.0, amp: 0.3,  dur_mult: 0.12, excitation: StopUnvoiced },
        B  => PhonemeData { f1: 200.0, f2: 1000.0, f3: 2500.0, f1_end: 200.0, f2_end: 1000.0, f3_end: 2500.0, is_diphthong: false, voiced: 0.85, amp: 0.5, dur_mult: 0.15, excitation: StopVoiced },
        T  => PhonemeData { f1: 350.0, f2: 1700.0, f3: 2800.0, f1_end: 350.0, f2_end: 1700.0, f3_end: 2800.0, is_diphthong: false, voiced: 0.0, amp: 0.3,  dur_mult: 0.12, excitation: StopUnvoiced },
        D  => PhonemeData { f1: 300.0, f2: 1600.0, f3: 2600.0, f1_end: 300.0, f2_end: 1600.0, f3_end: 2600.0, is_diphthong: false, voiced: 0.8, amp: 0.5,  dur_mult: 0.15, excitation: StopVoiced },
        K  => PhonemeData { f1: 300.0, f2: 1500.0, f3: 2700.0, f1_end: 300.0, f2_end: 1500.0, f3_end: 2700.0, is_diphthong: false, voiced: 0.0, amp: 0.3,  dur_mult: 0.12, excitation: StopUnvoiced },
        G  => PhonemeData { f1: 250.0, f2: 1200.0, f3: 2500.0, f1_end: 250.0, f2_end: 1200.0, f3_end: 2500.0, is_diphthong: false, voiced: 0.8, amp: 0.5,  dur_mult: 0.15, excitation: StopVoiced },

        // Fricatives
        F  => PhonemeData { f1: 350.0, f2: 1400.0, f3: 2700.0, f1_end: 350.0, f2_end: 1400.0, f3_end: 2700.0, is_diphthong: false, voiced: 0.0, amp: 0.2,  dur_mult: 0.25, excitation: Unvoiced },
        V  => PhonemeData { f1: 350.0, f2: 1400.0, f3: 2700.0, f1_end: 350.0, f2_end: 1400.0, f3_end: 2700.0, is_diphthong: false, voiced: 0.7, amp: 0.4,  dur_mult: 0.25, excitation: Mixed },
        TH => PhonemeData { f1: 350.0, f2: 1450.0, f3: 2700.0, f1_end: 350.0, f2_end: 1450.0, f3_end: 2700.0, is_diphthong: false, voiced: 0.0, amp: 0.15, dur_mult: 0.25, excitation: Unvoiced },
        DH => PhonemeData { f1: 350.0, f2: 1450.0, f3: 2700.0, f1_end: 350.0, f2_end: 1450.0, f3_end: 2700.0, is_diphthong: false, voiced: 0.7, amp: 0.35, dur_mult: 0.25, excitation: Mixed },
        S  => PhonemeData { f1: 400.0, f2: 1700.0, f3: 3200.0, f1_end: 400.0, f2_end: 1700.0, f3_end: 3200.0, is_diphthong: false, voiced: 0.0, amp: 0.15, dur_mult: 0.25, excitation: Unvoiced },
        Z  => PhonemeData { f1: 400.0, f2: 1700.0, f3: 3200.0, f1_end: 400.0, f2_end: 1700.0, f3_end: 3200.0, is_diphthong: false, voiced: 0.6, amp: 0.35, dur_mult: 0.25, excitation: Mixed },
        SH => PhonemeData { f1: 350.0, f2: 1800.0, f3: 3200.0, f1_end: 350.0, f2_end: 1800.0, f3_end: 3200.0, is_diphthong: false, voiced: 0.0, amp: 0.2,  dur_mult: 0.3, excitation: Unvoiced },
        ZH => PhonemeData { f1: 350.0, f2: 1800.0, f3: 3200.0, f1_end: 350.0, f2_end: 1800.0, f3_end: 3200.0, is_diphthong: false, voiced: 0.6, amp: 0.35, dur_mult: 0.3, excitation: Mixed },
        HH => PhonemeData { f1: 500.0, f2: 1500.0, f3: 2500.0, f1_end: 500.0, f2_end: 1500.0, f3_end: 2500.0, is_diphthong: false, voiced: 0.0, amp: 0.15, dur_mult: 0.15, excitation: Unvoiced },

        // Affricates
        CH => PhonemeData { f1: 350.0, f2: 1800.0, f3: 3000.0, f1_end: 350.0, f2_end: 1800.0, f3_end: 3000.0, is_diphthong: false, voiced: 0.0, amp: 0.3, dur_mult: 0.2, excitation: Affricate },
        JH => PhonemeData { f1: 300.0, f2: 1800.0, f3: 2800.0, f1_end: 300.0, f2_end: 1800.0, f3_end: 2800.0, is_diphthong: false, voiced: 0.6, amp: 0.35, dur_mult: 0.2, excitation: Affricate },

        // Nasals
        M  => PhonemeData { f1: 280.0, f2: 900.0,  f3: 2300.0, f1_end: 280.0, f2_end: 900.0,  f3_end: 2300.0, is_diphthong: false, voiced: 1.0, amp: 0.75, dur_mult: 0.6, excitation: Voiced },
        N  => PhonemeData { f1: 300.0, f2: 1500.0, f3: 2500.0, f1_end: 300.0, f2_end: 1500.0, f3_end: 2500.0, is_diphthong: false, voiced: 1.0, amp: 0.75, dur_mult: 0.6, excitation: Voiced },
        NG => PhonemeData { f1: 250.0, f2: 2000.0, f3: 2600.0, f1_end: 250.0, f2_end: 2000.0, f3_end: 2600.0, is_diphthong: false, voiced: 1.0, amp: 0.7,  dur_mult: 0.6, excitation: Voiced },

        // Liquids/Glides
        L  => PhonemeData { f1: 350.0, f2: 1100.0, f3: 2900.0, f1_end: 350.0, f2_end: 1100.0, f3_end: 2900.0, is_diphthong: false, voiced: 1.0, amp: 0.8, dur_mult: 0.5, excitation: Voiced },
        R  => PhonemeData { f1: 350.0, f2: 1100.0, f3: 1600.0, f1_end: 350.0, f2_end: 1100.0, f3_end: 1600.0, is_diphthong: false, voiced: 1.0, amp: 0.75, dur_mult: 0.5, excitation: Voiced },
        W  => PhonemeData { f1: 300.0, f2: 750.0,  f3: 2500.0, f1_end: 300.0, f2_end: 750.0,  f3_end: 2500.0, is_diphthong: false, voiced: 1.0, amp: 0.8,  dur_mult: 0.4, excitation: Voiced },
        Y  => PhonemeData { f1: 280.0, f2: 2200.0, f3: 3000.0, f1_end: 280.0, f2_end: 2200.0, f3_end: 3000.0, is_diphthong: false, voiced: 1.0, amp: 0.8,  dur_mult: 0.4, excitation: Voiced },

        // Silence / Pauses
        SIL        => SIL_DATA,
        PauseShort => PhonemeData { voiced: 0.0, amp: 0.0, dur_mult: 0.3, excitation: Silent, ..SIL_DATA },
        PauseLong  => PhonemeData { voiced: 0.0, amp: 0.0, dur_mult: 0.6, excitation: Silent, ..SIL_DATA },
    }
}

// ===========================================================================
// Section 3: Numbers → words
// ===========================================================================

const ONES: [&str; 20] = [
    "ZERO", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN",
    "EIGHT", "NINE", "TEN", "ELEVEN", "TWELVE", "THIRTEEN", "FOURTEEN",
    "FIFTEEN", "SIXTEEN", "SEVENTEEN", "EIGHTEEN", "NINETEEN",
];
const TENS: [&str; 8] = [
    "TWENTY", "THIRTY", "FORTY", "FIFTY", "SIXTY", "SEVENTY", "EIGHTY", "NINETY",
];

fn number_to_words(n: u32) -> String {
    if n < 20 {
        return ONES[n as usize].to_string();
    }
    if n < 100 {
        let t = TENS[(n / 10 - 2) as usize];
        let r = n % 10;
        if r == 0 { t.to_string() } else { format!("{} {}", t, ONES[r as usize]) }
    } else if n < 1000 {
        let h = n / 100;
        let r = n % 100;
        if r == 0 {
            format!("{} HUNDRED", ONES[h as usize])
        } else {
            format!("{} HUNDRED {}", ONES[h as usize], number_to_words(r))
        }
    } else if n < 10000 {
        // 1984 → NINETEEN EIGHTY FOUR
        let hi = n / 100;
        let lo = n % 100;
        if lo == 0 {
            format!("{} HUNDRED", number_to_words(hi))
        } else {
            format!("{} {}", number_to_words(hi), number_to_words(lo))
        }
    } else {
        // >9999: digit by digit
        n.to_string().chars().map(|c| {
            ONES[c.to_digit(10).unwrap_or(0) as usize]
        }).collect::<Vec<_>>().join(" ")
    }
}

fn numbers_to_words(text: &str) -> String {
    let mut result = String::with_capacity(text.len() * 2);
    let mut num_buf = String::new();
    for c in text.chars() {
        if c.is_ascii_digit() {
            num_buf.push(c);
        } else {
            if !num_buf.is_empty() {
                if let Ok(n) = num_buf.parse::<u32>() {
                    result.push_str(&number_to_words(n));
                }
                num_buf.clear();
            }
            result.push(c);
        }
    }
    if !num_buf.is_empty() {
        if let Ok(n) = num_buf.parse::<u32>() {
            result.push_str(&number_to_words(n));
        }
    }
    result
}

// ===========================================================================
// Section 4: Text preprocessing
// ===========================================================================

fn preprocess_text(text: &str) -> String {
    let expanded = numbers_to_words(text);
    let upper = expanded.to_uppercase();
    let mut result = String::with_capacity(upper.len());
    let mut last_space = false;
    for c in upper.chars() {
        if c.is_ascii_alphabetic() || c == '.' || c == ',' || c == '!' || c == '?' {
            result.push(c);
            last_space = false;
        } else if c == ' ' || c == '\n' || c == '\t' {
            if !last_space && !result.is_empty() {
                result.push(' ');
                last_space = true;
            }
        }
    }
    result.trim().to_string()
}

// ===========================================================================
// Section 5: G2P rule engine
// ===========================================================================

struct G2pRule {
    left: &'static str,
    grapheme: &'static str,
    right: &'static str,
    phonemes: &'static [Phoneme],
}

fn is_vowel_letter(c: u8) -> bool {
    matches!(c, b'A' | b'E' | b'I' | b'O' | b'U' | b'Y')
}

fn is_consonant_letter(c: u8) -> bool {
    c.is_ascii_alphabetic() && !is_vowel_letter(c)
}

fn is_voiced_consonant(c: u8) -> bool {
    matches!(c, b'B' | b'D' | b'G' | b'J' | b'L' | b'M' | b'N' | b'R' | b'V' | b'W' | b'Z')
}

fn is_front_vowel(c: u8) -> bool {
    matches!(c, b'E' | b'I' | b'Y')
}

/// Match a context pattern against text moving backward (left context).
fn match_left(pattern: &[u8], text: &[u8], pos: usize) -> bool {
    let mut ti = pos; // position in text (we go backward)
    let mut pi = pattern.len(); // pattern index (go backward)
    while pi > 0 {
        pi -= 1;
        let pc = pattern[pi];
        match pc {
            b' ' => {
                // word boundary: ti must be 0 or text[ti-1] not alpha
                if ti == 0 { continue; }
                return false;
            }
            b'#' => {
                if ti == 0 { return false; }
                ti -= 1;
                if !is_vowel_letter(text[ti]) { return false; }
            }
            b'^' => {
                if ti == 0 { return false; }
                ti -= 1;
                if !is_consonant_letter(text[ti]) { return false; }
            }
            b'.' => {
                if ti == 0 { return false; }
                ti -= 1;
                if !is_voiced_consonant(text[ti]) { return false; }
            }
            b'+' => {
                if ti == 0 { return false; }
                ti -= 1;
                if !is_front_vowel(text[ti]) { return false; }
            }
            b':' => {
                // zero or more consonants — consume consonants greedily backward
                while ti > 0 && is_consonant_letter(text[ti - 1]) {
                    ti -= 1;
                }
            }
            _ => {
                // literal letter
                if ti == 0 { return false; }
                ti -= 1;
                if text[ti] != pc { return false; }
            }
        }
    }
    true
}

/// Match a context pattern against text moving forward (right context).
fn match_right(pattern: &[u8], text: &[u8], pos: usize) -> bool {
    let mut ti = pos;
    for &pc in pattern {
        match pc {
            b' ' => {
                if ti >= text.len() { continue; }
                return false;
            }
            b'#' => {
                if ti >= text.len() { return false; }
                if !is_vowel_letter(text[ti]) { return false; }
                ti += 1;
            }
            b'^' => {
                if ti >= text.len() { return false; }
                if !is_consonant_letter(text[ti]) { return false; }
                ti += 1;
            }
            b'.' => {
                if ti >= text.len() { return false; }
                if !is_voiced_consonant(text[ti]) { return false; }
                ti += 1;
            }
            b'+' => {
                if ti >= text.len() { return false; }
                if !is_front_vowel(text[ti]) { return false; }
                ti += 1;
            }
            b'%' => {
                // suffix: ER, E, ES, ED, ING, ELY
                let remain = &text[ti..];
                if remain.starts_with(b"ING") || remain.starts_with(b"ELY") {
                    return true;
                }
                if remain.starts_with(b"ER") || remain.starts_with(b"ES") || remain.starts_with(b"ED") {
                    return true;
                }
                if remain.starts_with(b"E") {
                    return true;
                }
                return false;
            }
            b':' => {
                // zero or more consonants
                while ti < text.len() && is_consonant_letter(text[ti]) {
                    ti += 1;
                }
            }
            _ => {
                if ti >= text.len() { return false; }
                if text[ti] != pc { return false; }
                ti += 1;
            }
        }
    }
    true
}

// ===========================================================================
// Section 6: G2P rule data (~200 rules)
// ===========================================================================

use Phoneme::*;

// Macro to reduce boilerplate
macro_rules! g2p {
    ($l:expr, $g:expr, $r:expr => $($ph:expr),+) => {
        G2pRule { left: $l, grapheme: $g, right: $r, phonemes: &[$($ph),+] }
    };
    ($l:expr, $g:expr, $r:expr =>) => {
        G2pRule { left: $l, grapheme: $g, right: $r, phonemes: &[] }
    };
}

/// Returns rules for a given starting letter.
fn g2p_rules(letter: u8) -> &'static [G2pRule] {
    match letter {
        b'A' => &G2P_A,
        b'B' => &G2P_B,
        b'C' => &G2P_C,
        b'D' => &G2P_D,
        b'E' => &G2P_E,
        b'F' => &G2P_F,
        b'G' => &G2P_G,
        b'H' => &G2P_H,
        b'I' => &G2P_I,
        b'J' => &G2P_J,
        b'K' => &G2P_K,
        b'L' => &G2P_L,
        b'M' => &G2P_M,
        b'N' => &G2P_N,
        b'O' => &G2P_O,
        b'P' => &G2P_P,
        b'Q' => &G2P_Q,
        b'R' => &G2P_R,
        b'S' => &G2P_S,
        b'T' => &G2P_T,
        b'U' => &G2P_U,
        b'V' => &G2P_V,
        b'W' => &G2P_W,
        b'X' => &G2P_X,
        b'Y' => &G2P_Y,
        b'Z' => &G2P_Z,
        _ => &[],
    }
}

static G2P_A: [G2pRule; 10] = [
    g2p!("", "ATION", "" => EY, SH, AX, N),
    g2p!("", "AUGH", "" => AO, F),
    g2p!("", "IGHT", "" => AY, T),
    g2p!("", "ANGE", " " => EY, N, JH),
    g2p!("", "AGE", " " => IH, JH),
    g2p!("", "ATE", " " => EY, T),
    g2p!("", "ACE", " " => EY, S),
    g2p!("", "AKE", " " => EY, K),
    g2p!("", "ANE", " " => EY, N),
    g2p!("", "A", "" => AE),           // default A
];

static G2P_B: [G2pRule; 3] = [
    g2p!("", "BB", "" => B),
    g2p!("", "B", " " => B),           // final B (note: -MB handled in M rules)
    g2p!("", "B", "" => B),
];

static G2P_C: [G2pRule; 8] = [
    g2p!("", "CH", "" => CH),
    g2p!("", "CK", "" => K),
    g2p!("", "CE", " " => S),
    g2p!("", "CI", "" => S, IH),
    g2p!("", "CY", "" => S, IY),
    g2p!("", "CE", "" => S, EH),
    g2p!("", "C", "+" => S),           // C before front vowel
    g2p!("", "C", "" => K),            // default C
];

static G2P_D: [G2pRule; 3] = [
    g2p!("", "DG", "+" => JH),
    g2p!("", "DD", "" => D),
    g2p!("", "D", "" => D),
];

static G2P_E: [G2pRule; 12] = [
    g2p!("", "EIGH", "" => EY),
    g2p!("", "ENCE", " " => AX, N, S),
    g2p!("", "ENSE", " " => EH, N, S),
    g2p!("", "EOUS", "" => IY, AX, S),
    g2p!("", "EW", "" => UW),
    g2p!("", "ERE", " " => IH, R),
    g2p!("", "ER", " " => ER),
    g2p!("", "ER", "^" => ER),
    g2p!("", "EE", "" => IY),
    g2p!("", "EA", "" => IY),
    g2p!("", "ED", " " => D),          // past tense
    g2p!("", "E", "" => EH),           // default E
];

static G2P_F: [G2pRule; 2] = [
    g2p!("", "FF", "" => F),
    g2p!("", "F", "" => F),
];

static G2P_G: [G2pRule; 7] = [
    g2p!("", "GHT", "" => T),          // -GHT: GH silent, just T (used after vowel rules emit AY/etc)
    g2p!("", "GH", "#" => G),          // GH before vowel = G (ghost)
    g2p!("", "GH", "" => ),            // GH otherwise silent (night handled by IGHT)
    g2p!("", "GN", " " => N),          // final GN
    g2p!(" ", "GN", "" => N),          // initial GN (gnat)
    g2p!("", "G", "+" => JH),          // G before front vowel
    g2p!("", "G", "" => G),            // default G
];

static G2P_H: [G2pRule; 2] = [
    g2p!("#", "H", "" => ),            // H after vowel = silent (oh)
    g2p!("", "H", "" => HH),
];

static G2P_I: [G2pRule; 9] = [
    g2p!("", "IGHT", "" => AY, T),
    g2p!("", "IOUS", "" => IY, AX, S),
    g2p!("", "TION", "" => SH, AX, N),
    g2p!("", "SION", "" => ZH, AX, N),
    g2p!("", "ING", " " => IH, NG),
    g2p!("", "INE", " " => AY, N),
    g2p!("", "IRE", " " => AY, R),
    g2p!("", "ICE", " " => AY, S),
    g2p!("", "I", "" => IH),           // default I
];

static G2P_J: [G2pRule; 1] = [
    g2p!("", "J", "" => JH),
];

static G2P_K: [G2pRule; 2] = [
    g2p!(" ", "KN", "" => N),          // initial KN (knife)
    g2p!("", "K", "" => K),
];

static G2P_L: [G2pRule; 2] = [
    g2p!("", "LL", "" => L),
    g2p!("", "L", "" => L),
];

static G2P_M: [G2pRule; 3] = [
    g2p!("", "MB", " " => M),          // final MB (bomb, lamb)
    g2p!("", "MM", "" => M),
    g2p!("", "M", "" => M),
];

static G2P_N: [G2pRule; 4] = [
    g2p!("", "NG", "" => NG),
    g2p!("", "NK", "" => NG, K),
    g2p!("", "NN", "" => N),
    g2p!("", "N", "" => N),
];

static G2P_O: [G2pRule; 14] = [
    g2p!("", "OUGH", "T" => AO),
    g2p!("", "OUGH", "" => AH, F),     // enough, tough
    g2p!("", "OULD", "" => UH, D),
    g2p!("", "OUND", "" => AW, N, D),
    g2p!("", "OUSE", "" => AW, S),
    g2p!("", "OUR", " " => AO, R),
    g2p!("", "TION", "" => SH, AX, N),
    g2p!("", "OO", "" => UW),
    g2p!("", "OW", " " => OW),
    g2p!("", "OW", "^" => AW),
    g2p!("", "OI", "" => OY),
    g2p!("", "OY", "" => OY),
    g2p!("", "ONE", " " => W, AH, N),
    g2p!("", "O", "" => AA),           // default O
];

static G2P_P: [G2pRule; 4] = [
    g2p!("", "PH", "" => F),
    g2p!(" ", "PS", "" => S),          // initial PS (psalm)
    g2p!("", "PP", "" => P),
    g2p!("", "P", "" => P),
];

static G2P_Q: [G2pRule; 1] = [
    g2p!("", "QU", "" => K, W),
];

static G2P_R: [G2pRule; 2] = [
    g2p!("", "RR", "" => R),
    g2p!("", "R", "" => R),
];

static G2P_S: [G2pRule; 9] = [
    g2p!("", "SION", "" => ZH, AX, N),
    g2p!("", "SURE", "" => SH, ER),
    g2p!("", "SH", "" => SH),
    g2p!("", "SS", "" => S),
    g2p!("", "SCH", "" => S, K),
    g2p!("#", "S", " " => Z),          // final S after vowel = Z
    g2p!(".", "S", " " => Z),          // final S after voiced consonant = Z
    g2p!("", "S", "+" => S),
    g2p!("", "S", "" => S),
];

static G2P_T: [G2pRule; 7] = [
    g2p!("", "TION", "" => SH, AX, N),
    g2p!("", "TURE", "" => CH, ER),
    g2p!("", "TH", "" => TH),          // default TH (unvoiced)
    g2p!("", "TCH", "" => CH),
    g2p!("", "TT", "" => T),
    g2p!("", "T", "S " => T),
    g2p!("", "T", "" => T),
];

static G2P_U: [G2pRule; 6] = [
    g2p!("", "UGH", "" => AH, F),
    g2p!("", "UNE", " " => UW, N),
    g2p!("", "UTE", " " => UW, T),
    g2p!("", "UBE", " " => UW, B),
    g2p!("", "USE", " " => UW, Z),
    g2p!("", "U", "" => AH),           // default U
];

static G2P_V: [G2pRule; 1] = [
    g2p!("", "V", "" => V),
];

static G2P_W: [G2pRule; 4] = [
    g2p!("", "WH", "" => W),           // WH → W
    g2p!(" ", "WR", "" => R),          // initial WR (write)
    g2p!("", "WW", "" => W),
    g2p!("", "W", "" => W),
];

static G2P_X: [G2pRule; 1] = [
    g2p!("", "X", "" => K, S),
];

static G2P_Y: [G2pRule; 3] = [
    g2p!(" ", "Y", "#" => Y),          // Y before vowel at word start = consonant
    g2p!("", "Y", " " => IY),          // final Y = IY
    g2p!("", "Y", "" => IH),           // default Y (mid-word)
];

static G2P_Z: [G2pRule; 2] = [
    g2p!("", "ZZ", "" => Z),
    g2p!("", "Z", "" => Z),
];

// Voiced TH words — these common function words use /DH/ instead of /TH/
const VOICED_TH_WORDS: [&str; 15] = [
    "THE", "THIS", "THAT", "THEM", "THEY", "THEIR", "THERE", "THEN",
    "THAN", "THOSE", "THOUGH", "THUS", "THESE", "WITH", "THEE",
];

/// Apply magic-E rule: vowel + single consonant + E at end → long vowel
fn check_magic_e(word: &[u8], vowel_pos: usize) -> Option<&'static [Phoneme]> {
    let len = word.len();
    if vowel_pos + 2 >= len { return None; }
    // Check pattern: vowel at vowel_pos, consonant at vowel_pos+1, E at end
    let cons_pos = vowel_pos + 1;
    if cons_pos + 1 != len - 1 { return None; } // consonant must be second-to-last
    if word[len - 1] != b'E' { return None; }
    if !is_consonant_letter(word[cons_pos]) { return None; }
    // Don't apply magic-E if consonant is X (e.g. AXE)
    if word[cons_pos] == b'X' { return None; }

    match word[vowel_pos] {
        b'A' => Some(&[EY]),
        b'I' => Some(&[AY]),
        b'O' => Some(&[OW]),
        b'U' => Some(&[UW]),
        b'E' => Some(&[IY]),
        _ => None,
    }
}

fn apply_g2p_rules(word: &str) -> Vec<Phoneme> {
    let bytes = word.as_bytes();
    let len = bytes.len();
    if len == 0 { return vec![]; }

    // Check for voiced TH words
    let is_voiced_th = VOICED_TH_WORDS.iter().any(|w| *w == word);

    let mut result = Vec::with_capacity(len * 2);
    let mut pos = 0;

    while pos < len {
        let ch = bytes[pos];
        if !ch.is_ascii_alphabetic() {
            pos += 1;
            continue;
        }

        // Try magic-E first for vowels
        if is_vowel_letter(ch) && ch != b'Y' {
            if let Some(long_vowel) = check_magic_e(bytes, pos) {
                result.extend_from_slice(long_vowel);
                pos += 1;
                continue;
            }
        }

        // Special case: voiced TH
        if is_voiced_th && pos + 1 < len && bytes[pos] == b'T' && bytes[pos + 1] == b'H' {
            result.push(DH);
            pos += 2;
            continue;
        }

        // Try rules for this letter (longest grapheme first - rules are ordered that way)
        let rules = g2p_rules(ch);
        let mut matched = false;
        for rule in rules {
            let glen = rule.grapheme.len();
            if pos + glen > len { continue; }
            // Check grapheme match
            if &bytes[pos..pos + glen] != rule.grapheme.as_bytes() { continue; }
            // Check left context
            if !rule.left.is_empty() && !match_left(rule.left.as_bytes(), bytes, pos) {
                continue;
            }
            // Check right context
            if !rule.right.is_empty() && !match_right(rule.right.as_bytes(), bytes, pos + glen) {
                continue;
            }
            // Match! Emit phonemes
            result.extend_from_slice(rule.phonemes);
            pos += glen;
            matched = true;
            break;
        }
        if !matched {
            // Fallback: skip unknown letters
            pos += 1;
        }
    }

    result
}

/// Convert preprocessed text to phoneme sequence.
fn text_to_phonemes(text: &str) -> Vec<Phoneme> {
    let mut phonemes = Vec::new();
    for segment in text.split_inclusive(|c: char| c == ' ' || c == '.' || c == ',' || c == '!' || c == '?') {
        let trimmed = segment.trim();
        if trimmed.is_empty() { continue; }

        // Check for trailing punctuation
        let (word_part, punct) = if trimmed.ends_with('.') || trimmed.ends_with('!') || trimmed.ends_with('?') {
            (&trimmed[..trimmed.len()-1], Some(PauseLong))
        } else if trimmed.ends_with(',') {
            (&trimmed[..trimmed.len()-1], Some(PauseShort))
        } else {
            (trimmed, None)
        };

        // Split into words on remaining spaces
        for (wi, word) in word_part.split_whitespace().enumerate() {
            if wi > 0 {
                // short pause between words
                phonemes.push(PauseShort);
            }
            let word_phonemes = apply_g2p_rules(word);
            phonemes.extend(word_phonemes);
        }

        if let Some(pause) = punct {
            phonemes.push(pause);
        }
    }

    if phonemes.is_empty() {
        phonemes.push(SIL);
    }

    phonemes
}

// ===========================================================================
// Section 7: Coarticulation
// ===========================================================================

#[derive(Clone, Copy)]
struct CoarticulatedPhoneme {
    data: PhonemeData,
    entry_f: [f32; 3],
    steady_f: [f32; 3],
    exit_f: [f32; 3],
}

fn coarticulate(phonemes: &[Phoneme]) -> Vec<CoarticulatedPhoneme> {
    let len = phonemes.len();
    let datas: Vec<PhonemeData> = phonemes.iter().map(|&p| phoneme_data(p)).collect();

    let mut result = Vec::with_capacity(len);
    for i in 0..len {
        let d = datas[i];
        let steady = [d.f1, d.f2, d.f3];

        let prev = if i > 0 { &datas[i - 1] } else { &SIL_DATA };
        let next = if i + 1 < len { &datas[i + 1] } else { &SIL_DATA };

        let prev_f = [prev.f1, prev.f2, prev.f3];
        let next_f = [next.f1, next.f2, next.f3];

        let mut entry_f = [0.0_f32; 3];
        let mut exit_f = [0.0_f32; 3];
        for b in 0..3 {
            entry_f[b] = steady[b] * 0.7 + prev_f[b] * 0.3;
            exit_f[b] = steady[b] * 0.7 + next_f[b] * 0.3;
        }

        result.push(CoarticulatedPhoneme {
            data: d,
            entry_f,
            steady_f: steady,
            exit_f,
        });
    }
    result
}

// ===========================================================================
// Section 8: Excitation model
// ===========================================================================

fn generate_excitation(
    exc_type: ExcitationType,
    progress: f32,
    buzz: f32,
    noise: f32,
) -> f32 {
    match exc_type {
        ExcitationType::Voiced => buzz,
        ExcitationType::Unvoiced => noise * 0.5,
        ExcitationType::Mixed => buzz * 0.6 + noise * 0.3,
        ExcitationType::StopUnvoiced => {
            if progress < 0.6 { 0.0 } else { noise * 0.8 }
        }
        ExcitationType::StopVoiced => {
            if progress < 0.6 { buzz * 0.1 } else { buzz * 0.8 + noise * 0.2 }
        }
        ExcitationType::Affricate => {
            if progress < 0.3 {
                0.0
            } else if progress < 0.5 {
                noise * 0.6
            } else {
                noise * 0.5 + buzz * 0.1
            }
        }
        ExcitationType::Silent => 0.0,
    }
}

// ===========================================================================
// Section 9: SpeechSynth struct + process_block
// ===========================================================================

// Formant filter tuning
const FORMANT_Q: [f32; 3] = [4.5, 3.5, 3.0];
const FORMANT_WEIGHTS: [f32; 3] = [0.60, 0.30, 0.15];

pub struct SpeechSynth {
    sample_rate: f32,
    filters: [FormantFilter; 3],

    phonemes: Vec<CoarticulatedPhoneme>,
    phoneme_index: usize,

    // Interpolated formant state
    cur_f: [f32; 3],
    cur_voiced: f32,
    cur_amp: f32,

    // Internal timer
    samples_elapsed: f32,

    // Clock tracking
    clock_detected: bool,

    // Buzz oscillator
    buzz_phase: f32,

    // Noise state
    noise_state: u32,
    noise_lp: f32,

    // Gate envelope
    gate_env: f32,

    // Edge detection
    prev_gate: f32,
    prev_clock: f32,
}

pub struct SpeechSynthParams<'a> {
    pub speed: &'a [Sample],
    pub formant_shift: &'a [Sample],
    pub smoothing: &'a [Sample],
    pub buzz: &'a [Sample],
    pub noise_mix: &'a [Sample],
}

pub struct SpeechSynthInputs<'a> {
    pub pitch: Option<&'a [Sample]>,
    pub gate: Option<&'a [Sample]>,
    pub clock: Option<&'a [Sample]>,
}

impl SpeechSynth {
    pub fn new(sample_rate: f32) -> Self {
        let text = "HELLO WORLD";
        let preprocessed = preprocess_text(text);
        let phoneme_seq = text_to_phonemes(&preprocessed);
        let coart = coarticulate(&phoneme_seq);
        let first_data = coart.first().map(|c| c.data).unwrap_or(SIL_DATA);

        Self {
            sample_rate: sample_rate.max(1.0),
            filters: [FormantFilter::default(); 3],
            phonemes: coart,
            phoneme_index: 0,
            cur_f: [first_data.f1, first_data.f2, first_data.f3],
            cur_voiced: first_data.voiced,
            cur_amp: first_data.amp,
            samples_elapsed: 0.0,
            clock_detected: false,
            buzz_phase: 0.0,
            noise_state: 0x7FFF_FFFF,
            noise_lp: 0.0,
            gate_env: 0.0,
            prev_gate: 0.0,
            prev_clock: 0.0,
        }
    }

    pub fn set_sample_rate(&mut self, sr: f32) {
        self.sample_rate = sr.max(1.0);
    }

    pub fn set_text(&mut self, text: &str) {
        let preprocessed = preprocess_text(text);
        let phoneme_seq = text_to_phonemes(&preprocessed);
        self.phonemes = coarticulate(&phoneme_seq);
        if self.phonemes.is_empty() {
            self.phonemes.push(CoarticulatedPhoneme {
                data: SIL_DATA,
                entry_f: [SIL_DATA.f1, SIL_DATA.f2, SIL_DATA.f3],
                steady_f: [SIL_DATA.f1, SIL_DATA.f2, SIL_DATA.f3],
                exit_f: [SIL_DATA.f1, SIL_DATA.f2, SIL_DATA.f3],
            });
        }
        self.phoneme_index = 0;
        self.samples_elapsed = 0.0;
        self.clock_detected = false;

        let first = &self.phonemes[0].data;
        self.cur_f = [first.f1, first.f2, first.f3];
        self.cur_voiced = first.voiced;
        self.cur_amp = first.amp;
    }

    fn advance_phoneme(&mut self) {
        if self.phonemes.is_empty() { return; }
        self.phoneme_index = (self.phoneme_index + 1) % self.phonemes.len();
    }

    fn reset_to_start(&mut self) {
        self.phoneme_index = 0;
        self.samples_elapsed = 0.0;
        if let Some(first) = self.phonemes.first() {
            self.cur_f = first.steady_f;
            self.cur_voiced = first.data.voiced;
            self.cur_amp = first.data.amp;
        }
    }

    fn next_noise(&mut self) -> f32 {
        let bit = self.noise_state & 1;
        self.noise_state >>= 1;
        if bit == 1 {
            self.noise_state ^= 0xB400_0000;
        }
        let raw = (self.noise_state as f32 / 0x7FFF_FFFF as f32) * 2.0 - 1.0;
        let cutoff = 4000.0;
        let rc = 1.0 / (std::f32::consts::TAU * cutoff);
        let dt = 1.0 / self.sample_rate;
        let alpha = dt / (rc + dt);
        self.noise_lp += alpha * (raw - self.noise_lp);
        self.noise_lp
    }

    pub fn process_block(
        &mut self,
        output: &mut [Sample],
        inputs: SpeechSynthInputs<'_>,
        params: SpeechSynthParams<'_>,
    ) {
        if output.is_empty() || self.phonemes.is_empty() {
            return;
        }

        let clock_connected = inputs.clock.is_some();

        for i in 0..output.len() {
            let speed = sample_at(params.speed, i, 8.0).clamp(1.0, 20.0);
            let formant_shift = sample_at(params.formant_shift, i, 0.0).clamp(-12.0, 12.0);
            let smoothing = sample_at(params.smoothing, i, 0.3).clamp(0.0, 1.0);
            let buzz_bright = sample_at(params.buzz, i, 0.7).clamp(0.0, 1.0);
            let noise_mix = sample_at(params.noise_mix, i, 0.15).clamp(0.0, 1.0);

            let pitch_cv = input_at(inputs.pitch, i);
            let gate = input_at(inputs.gate, i);
            let clock = input_at(inputs.clock, i);

            // Gate rising edge = reset to start
            if gate > 0.5 && self.prev_gate <= 0.5 {
                self.reset_to_start();
            }
            self.prev_gate = gate;

            // Clock rising edge = advance phoneme
            let clock_edge = clock > 0.5 && self.prev_clock <= 0.5;
            self.prev_clock = clock;

            if clock_edge {
                self.clock_detected = true;
                self.advance_phoneme();
                self.samples_elapsed = 0.0;
            }

            // Get current phoneme dur_mult for timing
            let cur_dur_mult = self.phonemes[self.phoneme_index % self.phonemes.len()].data.dur_mult;
            let samples_per_phoneme = self.sample_rate * cur_dur_mult / speed;

            // Timer-based advance (when no clock)
            if !clock_connected || !self.clock_detected {
                self.samples_elapsed += 1.0;
                if self.samples_elapsed >= samples_per_phoneme {
                    self.advance_phoneme();
                    self.samples_elapsed = 0.0;
                }
            }

            // Progress through current phoneme (0.0 → 1.0)
            let progress = if samples_per_phoneme > 0.0 {
                (self.samples_elapsed / samples_per_phoneme).clamp(0.0, 1.0)
            } else {
                0.5
            };

            // Copy current phoneme data to avoid borrow conflicts
            let cp = self.phonemes[self.phoneme_index % self.phonemes.len()];
            let target_f = if cp.data.is_diphthong {
                let diph_t = progress;
                [
                    cp.data.f1 + (cp.data.f1_end - cp.data.f1) * diph_t,
                    cp.data.f2 + (cp.data.f2_end - cp.data.f2) * diph_t,
                    cp.data.f3 + (cp.data.f3_end - cp.data.f3) * diph_t,
                ]
            } else if progress < 0.3 {
                let t = progress / 0.3;
                [
                    cp.entry_f[0] + (cp.steady_f[0] - cp.entry_f[0]) * t,
                    cp.entry_f[1] + (cp.steady_f[1] - cp.entry_f[1]) * t,
                    cp.entry_f[2] + (cp.steady_f[2] - cp.entry_f[2]) * t,
                ]
            } else if progress < 0.7 {
                cp.steady_f
            } else {
                let t = (progress - 0.7) / 0.3;
                [
                    cp.steady_f[0] + (cp.exit_f[0] - cp.steady_f[0]) * t,
                    cp.steady_f[1] + (cp.exit_f[1] - cp.steady_f[1]) * t,
                    cp.steady_f[2] + (cp.exit_f[2] - cp.steady_f[2]) * t,
                ]
            };

            // Smooth interpolation toward target formants
            let coeff = if smoothing > 0.0 {
                let tau = smoothing * 0.2;
                (-1.0 / (tau * self.sample_rate)).exp()
            } else {
                0.0
            };

            for b in 0..3 {
                self.cur_f[b] = self.cur_f[b] * coeff + target_f[b] * (1.0 - coeff);
            }
            self.cur_voiced = self.cur_voiced * coeff + cp.data.voiced * (1.0 - coeff);
            self.cur_amp = self.cur_amp * coeff + cp.data.amp * (1.0 - coeff);

            // Formant shift
            let shift_ratio = (formant_shift / 12.0).exp2();

            // Buzz oscillator
            let freq = 261.63_f32 * pitch_cv.exp2();
            let phase_inc = freq / self.sample_rate;
            self.buzz_phase += phase_inc;
            if self.buzz_phase >= 1.0 {
                self.buzz_phase -= 1.0;
            }

            let raw_saw = 2.0 * self.buzz_phase - 1.0;
            let fundamental = (self.buzz_phase * std::f32::consts::TAU).sin();
            let buzz = fundamental * (1.0 - buzz_bright) + raw_saw * buzz_bright;

            let noise = self.next_noise();

            // Typed excitation
            let excitation = generate_excitation(cp.data.excitation, progress, buzz, noise);
            let excitation = excitation + noise * noise_mix * 0.15;

            // 3-band formant filtering
            let mut sample = 0.0_f32;
            for b in 0..3 {
                let freq_shifted = (self.cur_f[b] * shift_ratio).min(self.sample_rate * 0.45);
                if freq_shifted > 20.0 {
                    sample += self.filters[b].process(
                        excitation,
                        freq_shifted,
                        FORMANT_Q[b],
                        self.sample_rate,
                    ) * FORMANT_WEIGHTS[b];
                }
            }

            sample *= self.cur_amp;

            // Smooth gate envelope (5ms)
            let gate_target = if gate > 0.5 { 1.0 } else { 0.0 };
            let gate_coeff = (-1.0 / (0.005 * self.sample_rate)).exp();
            self.gate_env = self.gate_env * gate_coeff + gate_target * (1.0 - gate_coeff);

            output[i] = sample * self.gate_env;
        }
    }
}
