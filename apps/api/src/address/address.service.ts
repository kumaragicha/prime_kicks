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

@Injectable()
export class AddressService {
  /**
   * Parse a raw address block into structured fields
   */
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

    // Split only on newlines and pipes, NOT commas (commas are part of address lines)
    const lines = addressBlock
      .split(/\n|\|/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    // Extract email
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
    for (const line of lines) {
      const emailMatch = line.match(emailRegex);
      if (emailMatch) {
        result.email = emailMatch[0];
        break;
      }
    }

    // Extract mobile number (10-digit Indian mobile number)
    const mobileRegex = /(?:\+91[\s-]?)?([6-9]\d{9})/;
    for (const line of lines) {
      const mobileMatch = line.match(mobileRegex);
      if (mobileMatch && mobileMatch[1]) {
        result.mobileNo = mobileMatch[1];
        break;
      }
    }

    // Extract pincode (6-digit Indian pincode)
    const pincodeRegex = /\b(\d{6})\b/;
    for (const line of lines) {
      const pincodeMatch = line.match(pincodeRegex);
      if (pincodeMatch && pincodeMatch[1]) {
        result.pincode = pincodeMatch[1];
        break;
      }
    }

    // Helper to extract value after a label
    // Matches patterns like "Label:", "Label-", "Label ", "Label : ", etc.
    const extractLabeledValue = (line: string, labels: string[]): string | null => {
      for (const label of labels) {
        const regex = new RegExp(`^${label}\\b\\s*[:\\-]?\\s*(.+)$`, 'i');
        const match = line.match(regex);
        if (match && match[1]) {
          return match[1].trim();
        }
      }
      return null;
    };

    // Extract labeled fields
    let extractedCity = '';
    let extractedState = '';
    let extractedLine1 = '';
    let extractedLine2 = '';
    let extractedLandmark = '';
    let extractedName = '';

    const addressLines: string[] = [];

    for (const line of lines) {
      // Check for name
      const nameVal = extractLabeledValue(line, ['name']);
      if (nameVal !== null) {
        extractedName = nameVal;
        continue;
      }

      // Check for address line 2 (check before address line 1)
      const line2Val = extractLabeledValue(line, [
        'address line 2',
        'address 2',
        'line 2',
        'line2',
      ]);
      if (line2Val !== null) {
        extractedLine2 = line2Val;
        continue;
      }

      // Check for address line 1
      const addressVal = extractLabeledValue(line, [
        'address line 1',
        'address 1',
        'line 1',
        'line1',
        'address',
        'addr',
      ]);
      if (addressVal !== null) {
        if (!extractedLine1) {
          extractedLine1 = addressVal;
        } else if (!extractedLine2) {
          extractedLine2 = addressVal;
        }
        continue;
      }

      // Check for landmark
      const landmarkVal = extractLabeledValue(line, ['landmark', 'land mark']);
      if (landmarkVal !== null) {
        extractedLandmark = landmarkVal;
        continue;
      }

      // Check for city
      const cityVal = extractLabeledValue(line, ['city', 'town', 'district']);
      if (cityVal !== null) {
        extractedCity = cityVal;
        continue;
      }

      // Check for state
      const stateVal = extractLabeledValue(line, ['state', 'province']);
      if (stateVal !== null) {
        extractedState = stateVal;
        continue;
      }

      // Check for pincode (labeled)
      const pincodeVal = extractLabeledValue(line, [
        'pincode',
        'pin code',
        'pincod',
        'pin',
        'zip code',
        'zipcode',
        'zip',
      ]);
      if (pincodeVal !== null) {
        const pinMatch = pincodeVal.match(/\b(\d{6})\b/);
        if (pinMatch && pinMatch[1]) {
          result.pincode = pinMatch[1];
        } else {
          // No pincode found in labeled value - add original line to address lines
          addressLines.push(line);
        }
        continue;
      }

      // Check for alternative number (extract it, don't overwrite the primary number)
      const altVal = extractLabeledValue(line, [
        'alternative no',
        'alternative number',
        'alternative mobile no',
        'alternative mobile number',
        'alternative mobile',
        'alternate no',
        'alternate number',
        'alternate mobile no',
        'alternate mobile number',
        'alternate mobile',
        'alt no',
        'alt number',
        'alt mobile no',
        'alt mobile number',
        'alt mobile',
        'alternative',
        'alternate',
        'alt',
      ]);
      if (altVal !== null) {
        const altMobileMatch = altVal.match(/(?:\+91[\s-]?)?([6-9]\d{9})/);
        if (altMobileMatch && altMobileMatch[1]) {
          result.altMobileNo = altMobileMatch[1];
        }
        continue;
      }

      // Check for phone/mobile/number (check longer labels first)
      const phoneVal = extractLabeledValue(line, [
        'phone no',
        'phone number',
        'phone',
        'mobile no',
        'mobile number',
        'mobile',
        'number',
        'contact no',
        'contact number',
        'contact',
        'tel',
        'telephone',
      ]);
      if (phoneVal !== null) {
        const mobileMatch = phoneVal.match(/(?:\+91[\s-]?)?([6-9]\d{9})/);
        if (mobileMatch && mobileMatch[1]) {
          result.mobileNo = mobileMatch[1];
        } else {
          // No mobile found in labeled value - add original line to address lines
          addressLines.push(line);
        }
        continue;
      }

      // Not a labeled field - skip if it's a standalone pincode or mobile number
      if (line === result.pincode || line === result.mobileNo || /^\d+$/.test(line)) {
        continue;
      }

      // Check if line starts with "near" (common landmark pattern in Indian addresses)
      if (!extractedLandmark && /^near\b/i.test(line)) {
        extractedLandmark = line;
        continue;
      }

      // Add to address lines
      addressLines.push(line);
    }

    // Filter out address lines that contain the already-extracted pincode or mobile number.
    // This prevents residual data like "pincod-781020" or "Alternative no -7002957295"
    // from polluting address line 2 or landmark fields.
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

    // Use pincode data to fill city and state if available
    // Explicitly labeled city/state take precedence over pincode data
    if (result.pincode && PINCODE_DATA[result.pincode]) {
      const pincodeInfo = PINCODE_DATA[result.pincode]!;
      const pincodeState = pincodeInfo.state;
      const pincodeCity = pincodeInfo.city;
      const validPincodeState =
        pincodeState && pincodeState.toLowerCase() !== 'nan' ? pincodeState : '';
      const validPincodeCity =
        pincodeCity && pincodeCity.toLowerCase() !== 'nan' ? pincodeCity : '';

      // Detect swapped city/state: if extracted city matches the pincode's state
      // and extracted state does NOT match the pincode's state, they are likely swapped
      let cityValue = extractedCity;
      let stateValue = extractedState;
      if (
        extractedCity &&
        extractedState &&
        validPincodeState &&
        extractedCity.toLowerCase() === validPincodeState.toLowerCase() &&
        extractedState.toLowerCase() !== validPincodeState.toLowerCase()
      ) {
        // Swap them
        cityValue = extractedState;
        stateValue = extractedCity;
      }

      if (!cityValue) {
        result.city = validPincodeCity;
      } else {
        result.city = cityValue;
      }
      if (!stateValue) {
        result.state = validPincodeState ? toTitleCase(validPincodeState) : '';
      } else {
        result.state = stateValue;
      }
    } else {
      result.city = extractedCity;
      result.state = extractedState;
    }

    // Set name
    result.name = extractedName;
    if (!result.name && addressLines.length > 0) {
      const firstLine = addressLines[0];
      if (
        firstLine !== undefined &&
        !firstMatch(emailRegex, firstLine) &&
        !firstMatch(mobileRegex, firstLine) &&
        !firstMatch(pincodeRegex, firstLine) &&
        firstLine.length < 50
      ) {
        result.name = firstLine;
        addressLines.shift();
      }
    }

    // Assign address fields from labeled extractions
    if (extractedLine1) {
      result.line1 = extractedLine1;
    }
    if (extractedLine2) {
      result.line2 = extractedLine2;
    }
    if (extractedLandmark) {
      result.landmark = extractedLandmark;
    }

    // If no labeled address, use remaining address lines
    if (!result.line1 && addressLines.length > 0 && addressLines[0]) {
      result.line1 = addressLines[0];
      addressLines.shift();
    }
    if (!result.line2 && addressLines.length > 0 && addressLines[0]) {
      result.line2 = addressLines[0];
      addressLines.shift();
    }
    if (!result.landmark && addressLines.length > 0) {
      result.landmark = addressLines.join(', ');
    }

    return result;
  }
}

function firstMatch(regex: RegExp, str: string): boolean {
  return regex.test(str);
}

function toTitleCase(str: string): string {
  return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase());
}
