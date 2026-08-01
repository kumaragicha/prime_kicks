// Simple test script for address parsing
import { AddressService } from './src/address/address.service.js';

const service = new AddressService();

const testCases = [
  {
    name: 'Akchayata Rai',
    input: `Name Akchayata Rai 
Address :jorethang (Budang west Sikkim )
Landmark :Sikkim professional university budang west Sikkim 
Pincode 737121
Phone no 9339901747`,
    expected: {
      name: 'Akchayata Rai',
      mobileNo: '9339901747',
      pincode: '737121',
      state: 'Sikkim',
    },
  },
  {
    name: 'Prasanta Chettri',
    input: `NAME- Prasanta Chettri
ADDRESS- Sombaria Bazar west Sikkim 
LANDMARK- Sombaria 
CITY- Sombaria 
STATE- Sikkim
PINCODE-737121
NUMBER-9932047288`,
    expected: {
      name: 'Prasanta Chettri',
      mobileNo: '9932047288',
      pincode: '737121',
      city: 'Sombaria',
      state: 'Sikkim',
    },
  },
  {
    name: 'Laden Bhutia',
    input: `NAME-Laden Bhutia
ADDRESS-Sports and youth affair near ridge Park white hall
LANDMARK-near ridge Park white hall
CITY-Gangtok
STATE-Sikkim
PINCODE-737101
NUMBER-7797489235`,
    expected: {
      name: 'Laden Bhutia',
      mobileNo: '7797489235',
      pincode: '737101',
      city: 'Gangtok',
      state: 'Sikkim',
    },
  },
  {
    name: 'Mamta Rai',
    input: `Mamta Rai 
Rateypani namchi district 
Near post office 
South Sikkim 
737128
7001194801`,
    expected: {
      name: 'Mamta Rai',
      mobileNo: '7001194801',
      pincode: '737128',
      state: 'Sikkim',
    },
  },
];

console.log('Testing Address Parsing...\n');

let passed = 0;
let failed = 0;

testCases.forEach((testCase, index) => {
  console.log(`\n=== Test ${index + 1}: ${testCase.name} ===`);
  const result = service.parseAddressBlock(testCase.input);

  console.log('Input:', testCase.input.replace(/\n/g, ' | '));
  console.log('\nParsed Result:');
  console.log(JSON.stringify(result, null, 2));

  let testPassed = true;
  Object.entries(testCase.expected).forEach(([key, value]) => {
    const actual = result[key];
    const match = actual === value || (typeof value === 'string' && actual?.includes(value));

    if (!match) {
      console.log(`❌ FAILED: ${key} - Expected "${value}", got "${actual}"`);
      testPassed = false;
    } else {
      console.log(`✓ PASSED: ${key} = "${actual}"`);
    }
  });

  if (testPassed) {
    passed++;
    console.log(`✅ Test ${index + 1} PASSED`);
  } else {
    failed++;
    console.log(`❌ Test ${index + 1} FAILED`);
  }
});

console.log(`\n\n=== SUMMARY ===`);
console.log(`Total Tests: ${testCases.length}`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed > 0) {
  process.exit(1);
}
