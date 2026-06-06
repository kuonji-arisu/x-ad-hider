import { pinyin } from "pinyin-pro";

type PinyinUnit = {
  isZh: boolean;
  pinyin: string;
  result: string;
};

const HAN_RE = /\p{Script=Han}/u;
// Drop page-provided PUA chars so they cannot collide with internal pinyin codes.
const PRIVATE_USE_RE = /[\uE000-\uF8FF]/g;
const PINYIN_CODE_BASE = 0xE000;
const PINYIN_CODE_LIMIT = 0xF8FF - PINYIN_CODE_BASE + 1;
const MAX_SIGNATURE_CACHE_ENTRIES = 500;

const signatureCache = new Map<string, string>();
const pinyinCodes = new Map<string, string>();

export function toMatchSignature(input: unknown): string {
  const normalized = normalizePlain(input);
  const cached = signatureCache.get(normalized);
  if (cached !== undefined) {
    return cached;
  }

  const signature = HAN_RE.test(normalized) ? buildPinyinSignature(normalized) : normalized;
  rememberSignature(normalized, signature);
  return signature;
}

function buildPinyinSignature(input: string): string {
  return pinyin(input, {
    type: "all",
    toneType: "none",
    nonZh: "consecutive",
    traditional: true,
    v: true
  }).map((unit) => signatureUnit(unit)).join("");
}

function signatureUnit(unit: PinyinUnit): string {
  if (!unit.isZh) {
    return normalizePlain(unit.result);
  }

  const syllable = unit.pinyin || unit.result;
  return syllable ? pinyinCode(syllable) : normalizePlain(unit.result);
}

function pinyinCode(syllable: string): string {
  const existing = pinyinCodes.get(syllable);
  if (existing) {
    return existing;
  }

  if (pinyinCodes.size >= PINYIN_CODE_LIMIT) {
    throw new Error("Pinyin signature code space exhausted");
  }

  const code = String.fromCharCode(PINYIN_CODE_BASE + pinyinCodes.size);
  pinyinCodes.set(syllable, code);
  return code;
}

function normalizePlain(input: unknown): string {
  return String(input ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(PRIVATE_USE_RE, "");
}

function rememberSignature(input: string, signature: string): void {
  if (signatureCache.size >= MAX_SIGNATURE_CACHE_ENTRIES) {
    signatureCache.clear();
  }

  signatureCache.set(input, signature);
}
