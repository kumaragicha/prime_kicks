import { Injectable } from '@nestjs/common';
import { PINCODE_DATA } from './pincode-data';

export interface ParsedAddress {
  name: string;
  email: string;
  mobileNo: string;
  altMobileNo: string;
  line1: string;
  line2: string;
  landmark: string;
  pincode: string;
  city: string;
  state: string;
}

/** Label synonyms per field. Order within a list is longest/most-specific first. */
const LABELS = {
  name: ['full name', 'recipient name', 'receiver name', 'customer name', 'name'],
  line2: ['address line 2', 'address 2', 'addr 2', 'line 2', 'line2', 'locality'],
  line1: [
    'complete address',
    'full address',
    'address line 1',
    'address 1',
    'addr 1',
    'line 1',
    'line1',
    'address',
    'adress',
    'addres',
    'addr',
  ],
  landmark: ['landmark', 'land mark'],
  city: ['city/town', 'city / town', 'city', 'town', 'district'],
  state: ['state/ut', 'state / ut', 'state', 'province'],
  pincode: [
    'pincode',
    'pin code',
    'pin-code',
    'postal code',
    'post code',
    'postcode',
    'pincod',
    'pin',
    'zip code',
    'zipcode',
    'zip',
  ],
  alt: [
    'alternate contact number',
    'alternative contact number',
    'alternate mobile number',
    'alternative mobile number',
    'alternate mobile no',
    'alternative mobile no',
    'alternate mobile',
    'alternative mobile',
    'alternate number',
    'alternative number',
    'alternate contact',
    'alternative contact',
    'alternate no',
    'alternative no',
    'second number',
    '2nd number',
    'other number',
    'alt mobile no',
    'alt mobile number',
    'alt mobile',
    'alt number',
    'alt no',
    'alternate',
    'alternative',
    'alt',
  ],
  phone: [
    'contact number',
    'contact no',
    'mobile number',
    'mobile no',
    'phone number',
    'phone no',
    'whatsapp number',
    'whatsapp no',
    'cell number',
    'cell no',
    'contact',
    'mobile',
    'phone',
    'whatsapp',
    'number',
    'mob no',
    'mob',
    'ph no',
    'ph',
    'cell',
    'tel',
    'telephone',
  ],
  email: ['email id', 'email address', 'e-mail id', 'e mail', 'e-mail', 'email', 'mail'],
};

/** Lines that are instructions/marketing/headers, never part of the address. */
const NOISE_PATTERNS: RegExp[] = [
  /please make sure/i,
  /unboxing/i,
  /avoid delivery/i,
  /once you receive/i,
  /helps us verify/i,
  /kindly record/i,
  /order details?/i,
  /a?d+ress\s+details?/i, // "address details" / "adress details" header
  /delivery address/i,
  /^\s*fill\b/i, // "Fill this 👇"
];

/** Product-spec lines (this is a footwear store; buyers often paste size/colour). */
const PRODUCT_LINE = /^\s*(size|colou?r|colr|qty|quantity|shade|design|model|article)\b/i;
const PRODUCT_WORDS = new Set([
  'hightops',
  'sneakers',
  'sneaker',
  'shoes',
  'shoe',
  'sandals',
  'sandal',
  'slippers',
  'slipper',
  'loafers',
  'heels',
  'flats',
  'boots',
]);

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const MOBILE_REGEX = /(?:\+?91[\s-]?)?[6-9]\d{9}/g;
const PINCODE_REGEX = /\b(\d{6})\b/;

/** Hard caps so a huge pasted block can't tie up the event loop (this endpoint
 *  runs many regexes per line). Real addresses are far smaller than these. */
const MAX_ADDRESS_LENGTH = 10_000;
const MAX_LINES = 200;

/** Memoized compiled label matchers — each label's RegExp is built once, not
 *  per line per request. */
const labelRegexCache = new Map<string, RegExp>();
function labelRegex(label: string): RegExp {
  let re = labelRegexCache.get(label);
  if (!re) {
    const esc = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    re = new RegExp(`^\\s*${esc}\\b\\s*(?:\\([^)]*\\))?\\s*[:\\-–—]?\\s*(.*)$`, 'i');
    labelRegexCache.set(label, re);
  }
  return re;
}

@Injectable()
export class AddressService {
  /** Parse a raw, free-form address block into structured fields. */
  parseAddressBlock(addressBlock: string): ParsedAddress {
    const result: ParsedAddress = {
      name: '',
      email: '',
      mobileNo: '',
      altMobileNo: '',
      line1: '',
      line2: '',
      landmark: '',
      pincode: '',
      city: '',
      state: '',
    };

    if (!addressBlock || typeof addressBlock !== 'string') return result;

    // Bound the work: cap total size and line count before running any regexes.
    const bounded =
      addressBlock.length > MAX_ADDRESS_LENGTH
        ? addressBlock.slice(0, MAX_ADDRESS_LENGTH)
        : addressBlock;

    // Split on newlines / pipes only (commas are part of address lines).
    const rawLines = bounded
      .split(/\r?\n|\|/)
      .slice(0, MAX_LINES)
      .map((l) => l.trim());

    // Drop the sender block: everything from a standalone "From" marker onward
    // belongs to the shop, not the recipient.
    const fromIdx = rawLines.findIndex((l) => /^from\b\s*[:,\-–—]?\s*$/i.test(l));
    const scoped = fromIdx >= 0 ? rawLines.slice(0, fromIdx) : rawLines;

    // Remove blank lines, "To," markers, instructions, and product specs.
    const lines = scoped.filter((l) => l.length > 0 && !isNoise(l));

    // Global scans (whole block) — a first pass to grab contact/pin even when unlabeled.
    for (const line of lines) {
      const emailMatch = line.match(EMAIL_REGEX);
      if (emailMatch) {
        result.email = emailMatch[0];
        break;
      }
    }
    for (const line of lines) {
      const nums = extractMobiles(line);
      if (nums[0]) {
        result.mobileNo = nums[0];
        break;
      }
    }
    for (const line of lines) {
      const pincodeMatch = line.match(PINCODE_REGEX);
      if (pincodeMatch && pincodeMatch[1]) {
        result.pincode = pincodeMatch[1];
        break;
      }
    }

    let extractedCity = '';
    let extractedState = '';
    let extractedLine1 = '';
    let extractedLine2 = '';
    let extractedLandmark = '';
    let extractedName = '';
    const addressLines: string[] = [];

    for (const line of lines) {
      // Name
      const nameVal = matchLabel(line, LABELS.name);
      if (nameVal !== null) {
        if (!isPlaceholder(nameVal)) extractedName = nameVal;
        continue;
      }

      // Address line 2 (before line 1 so the more-specific label wins)
      const line2Val = matchLabel(line, LABELS.line2);
      if (line2Val !== null) {
        if (!isPlaceholder(line2Val)) extractedLine2 = line2Val;
        continue;
      }

      // Address line 1
      const addressVal = matchLabel(line, LABELS.line1);
      if (addressVal !== null) {
        if (!isPlaceholder(addressVal)) {
          if (!extractedLine1) extractedLine1 = addressVal;
          else if (!extractedLine2) extractedLine2 = addressVal;
        }
        continue;
      }

      // Landmark
      const landmarkVal = matchLabel(line, LABELS.landmark);
      if (landmarkVal !== null) {
        if (!isPlaceholder(landmarkVal)) extractedLandmark = landmarkVal;
        continue;
      }

      // City
      const cityVal = matchLabel(line, LABELS.city);
      if (cityVal !== null) {
        if (!isPlaceholder(cityVal)) extractedCity = cityVal;
        continue;
      }

      // State
      const stateVal = matchLabel(line, LABELS.state);
      if (stateVal !== null) {
        if (!isPlaceholder(stateVal)) extractedState = stateVal;
        continue;
      }

      // Pincode (labeled)
      const pincodeVal = matchLabel(line, LABELS.pincode);
      if (pincodeVal !== null) {
        const pinMatch = pincodeVal.match(/\b(\d{6})\b/);
        if (pinMatch && pinMatch[1]) result.pincode = pinMatch[1];
        else if (!isPlaceholder(pincodeVal)) addressLines.push(line);
        continue;
      }

      // Alternative number (before primary so "Alternate number" isn't caught by "number")
      const altVal = matchLabel(line, LABELS.alt);
      if (altVal !== null) {
        const nums = extractMobiles(altVal);
        if (nums[0]) result.altMobileNo = nums[0];
        continue;
      }

      // Primary phone (may carry two numbers → second becomes the alt)
      const phoneVal = matchLabel(line, LABELS.phone);
      if (phoneVal !== null) {
        const nums = extractMobiles(phoneVal);
        if (nums[0]) result.mobileNo = nums[0];
        if (nums[1] && !result.altMobileNo) result.altMobileNo = nums[1];
        if (nums.length === 0 && !isPlaceholder(phoneVal)) addressLines.push(line);
        continue;
      }

      // Email (labeled) — consume so it doesn't pollute address lines
      const emailVal = matchLabel(line, LABELS.email);
      if (emailVal !== null) {
        const em = emailVal.match(EMAIL_REGEX);
        if (em) result.email = em[0];
        continue;
      }

      // Unlabeled: skip standalone numbers (pincode/mobile already captured).
      if (/^[\d\s+()-]+$/.test(line)) continue;

      // A line beginning with "near" is almost always a landmark in Indian addresses.
      if (!extractedLandmark && /^near\b/i.test(line)) {
        extractedLandmark = cleanValue(line);
        continue;
      }

      addressLines.push(line);
    }

    // Drop residual lines that merely repeat the already-captured pincode/mobile.
    for (let i = addressLines.length - 1; i >= 0; i--) {
      const line = addressLines[i];
      if (
        line &&
        ((result.pincode && line.includes(result.pincode)) ||
          (result.mobileNo && line.includes(result.mobileNo)))
      ) {
        addressLines.splice(i, 1);
      }
    }

    // City/state from pincode, with swap-detection when the labels are reversed.
    if (result.pincode && PINCODE_DATA[result.pincode]) {
      const info = PINCODE_DATA[result.pincode]!;
      const validState = info.state && info.state.toLowerCase() !== 'nan' ? info.state : '';
      const validCity = info.city && info.city.toLowerCase() !== 'nan' ? info.city : '';

      let cityValue = extractedCity;
      let stateValue = extractedState;
      if (
        extractedCity &&
        extractedState &&
        validState &&
        extractedCity.toLowerCase() === validState.toLowerCase() &&
        extractedState.toLowerCase() !== validState.toLowerCase()
      ) {
        cityValue = extractedState;
        stateValue = extractedCity;
      }

      result.city = cityValue || validCity;
      result.state = stateValue || (validState ? toTitleCase(validState) : '');
    } else {
      result.city = extractedCity;
      result.state = extractedState;
    }

    // Name: labeled first, else the first plausible unlabeled line.
    result.name = extractedName;
    if (!result.name && addressLines.length > 0) {
      const firstLine = addressLines[0];
      if (
        firstLine !== undefined &&
        !EMAIL_REGEX.test(firstLine) &&
        !/[6-9]\d{9}/.test(firstLine) &&
        !PINCODE_REGEX.test(firstLine) &&
        firstLine.length < 50
      ) {
        result.name = cleanValue(firstLine);
        addressLines.shift();
      }
    }

    if (extractedLine1) result.line1 = extractedLine1;
    if (extractedLine2) result.line2 = extractedLine2;
    if (extractedLandmark) result.landmark = extractedLandmark;

    // Fill any unset address fields from the remaining unlabeled lines.
    if (!result.line1 && addressLines.length > 0 && addressLines[0]) {
      result.line1 = addressLines.shift()!;
    }
    if (!result.line2 && addressLines.length > 0 && addressLines[0]) {
      result.line2 = addressLines.shift()!;
    }
    if (!result.landmark && addressLines.length > 0) {
      result.landmark = addressLines.join(', ');
    }

    return result;
  }
}

/** Whether a line is instructions, a marker, or product spec — never address data. */
function isNoise(line: string): boolean {
  if (line.replace(/[^a-z0-9]/gi, '').length === 0) return true; // emoji / dashes / symbols only
  if (/^\s*to\s*[,:]?\s*$/i.test(line)) return true; // "To," recipient marker
  if (PRODUCT_LINE.test(line)) return true;
  if (PRODUCT_WORDS.has(line.toLowerCase().replace(/[^a-z]/g, ''))) return true;
  return NOISE_PATTERNS.some((re) => re.test(line));
}

/**
 * If `line` begins with any of `labels`, return the value after it (allowing an
 * optional parenthetical qualifier like "(if any)" and a `:`/`-` separator).
 * Returns null when no label matches.
 */
function matchLabel(line: string, labels: string[]): string | null {
  for (const label of labels) {
    const m = line.match(labelRegex(label));
    if (m) return cleanValue(m[1] ?? '');
  }
  return null;
}

/** Pull all valid 10-digit Indian mobile numbers out of a string (in order). */
function extractMobiles(text: string): string[] {
  const out: string[] = [];
  const matches = text.match(MOBILE_REGEX) ?? [];
  for (const raw of matches) {
    const digits = raw.replace(/\D/g, '');
    const ten = digits.length > 10 ? digits.slice(-10) : digits;
    if (/^[6-9]\d{9}$/.test(ten) && !out.includes(ten)) out.push(ten);
  }
  return out;
}

/** True for empty / placeholder values like "(if available)", "N/A", "-". */
function isPlaceholder(v: string): boolean {
  const s = v.toLowerCase().replace(/[^a-z]/g, '');
  return (
    v.trim().length === 0 ||
    s === '' ||
    s === 'ifavailable' ||
    s === 'ifany' ||
    s === 'optional' ||
    s === 'na' ||
    s === 'nil' ||
    s === 'none'
  );
}

/** Trim surrounding whitespace and stray leading/trailing separators/punctuation. */
function cleanValue(v: string): string {
  return v.replace(/^[\s,;:.\-–—]+/, '').replace(/[\s,;:.\-–—]+$/, '').trim();
}

function toTitleCase(str: string): string {
  return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase());
}
