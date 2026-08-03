import { AddressService } from './address.service';

describe('AddressService', () => {
  let service: AddressService;

  beforeEach(() => {
    service = new AddressService();
  });

  it('should parse address block 1 - Akchayata Rai', () => {
    const addressBlock = `Name Akchayata Rai 
Address :jorethang (Budang west Sikkim )
Landmark :Sikkim professional university budang west Sikkim 
Pincode 737121
Phone no 9339901747`;

    const result = service.parseAddressBlock(addressBlock);

    console.log('Test 1 - Akchayata Rai:', JSON.stringify(result, null, 2));

    expect(result.name).toBe('Akchayata Rai');
    expect(result.mobileNo).toBe('9339901747');
    expect(result.pincode).toBe('737121');
    expect(result.state).toBe('Sikkim');
    expect(result.line1).toContain('jorethang');
    expect(result.landmark).toContain('Sikkim professional university');
  });

  it('should parse address block 2 - Prasanta Chettri', () => {
    const addressBlock = `NAME- Prasanta Chettri
ADDRESS- Sombaria Bazar west Sikkim 
LANDMARK- Sombaria 
CITY- Sombaria 
STATE- Sikkim
PINCODE-737121
NUMBER-9932047288`;

    const result = service.parseAddressBlock(addressBlock);

    console.log('Test 2 - Prasanta Chettri:', JSON.stringify(result, null, 2));

    expect(result.name).toBe('Prasanta Chettri');
    expect(result.mobileNo).toBe('9932047288');
    expect(result.pincode).toBe('737121');
    expect(result.city).toBe('Sombaria');
    expect(result.state).toBe('Sikkim');
    expect(result.line1).toContain('Sombaria Bazar');
    expect(result.landmark).toContain('Sombaria');
  });

  it('should parse address block 3 - Laden Bhutia', () => {
    const addressBlock = `NAME-Laden Bhutia
ADDRESS-Sports and youth affair near ridge Park white hall
LANDMARK-near ridge Park white hall
CITY-Gangtok
STATE-Sikkim
PINCODE-737101
NUMBER-7797489235`;

    const result = service.parseAddressBlock(addressBlock);

    console.log('Test 3 - Laden Bhutia:', JSON.stringify(result, null, 2));

    expect(result.name).toBe('Laden Bhutia');
    expect(result.mobileNo).toBe('7797489235');
    expect(result.pincode).toBe('737101');
    expect(result.city).toBe('Gangtok');
    expect(result.state).toBe('Sikkim');
    expect(result.line1).toContain('Sports and youth affair');
    expect(result.landmark).toContain('ridge Park');
  });

  it('should parse address block 4 - Mamta Rai', () => {
    const addressBlock = `Mamta Rai 
Rateypani namchi district 
Near post office 
South Sikkim 
737128
7001194801`;

    const result = service.parseAddressBlock(addressBlock);

    console.log('Test 4 - Mamta Rai:', JSON.stringify(result, null, 2));

    expect(result.name).toBe('Mamta Rai');
    expect(result.mobileNo).toBe('7001194801');
    expect(result.pincode).toBe('737128');
    expect(result.state).toBe('Sikkim');
    expect(result.line1).toContain('Rateypani');
    expect(result.landmark).toContain('Near post office');
  });

  it('should parse address block 6 - Baishali Basisth (misspelled "pincod" + alternative number)', () => {
    const addressBlock = `Name -Baishali Basisth
Address -Noonmati,Bhabanipur
Landmark - bhabanipur near lp school
City -guwahati
State- Assam
pincod-781020
Number - 9387440108
Alternative no -7002957295`;

    const result = service.parseAddressBlock(addressBlock);

    console.log('Test 6 - Baishali Basisth:', JSON.stringify(result, null, 2));

    expect(result.name).toBe('Baishali Basisth');
    expect(result.mobileNo).toBe('9387440108');
    expect(result.altMobileNo).toBe('7002957295');
    expect(result.pincode).toBe('781020');
    expect(result.state).toBe('Assam');
    expect(result.city).toBe('guwahati');
    expect(result.line1).toContain('Noonmati');
    expect(result.landmark).toContain('bhabanipur near lp school');
  });

  it('should parse address block 7 - Nitesh rai (minimal fields, city/state from pincode)', () => {
    const addressBlock = `Name : Nitesh rai
Address : yangang         bazar, South sikkim
Pin : 737134
Mobile no : 7548904592`;

    const result = service.parseAddressBlock(addressBlock);

    console.log('Test 7 - Nitesh rai:', JSON.stringify(result, null, 2));

    expect(result.name).toBe('Nitesh rai');
    expect(result.mobileNo).toBe('7548904592');
    expect(result.pincode).toBe('737134');
    expect(result.state).toBe('Sikkim');
    expect(result.line1).toContain('yangang');
  });

  it('should parse address block 8 - Alt mobile with "Alternative mobile" label', () => {
    const addressBlock = `Name: John Doe
Address: 123 Main Street
City: Mumbai
State: Maharashtra
Pincode: 400001
Mobile no: 9876543210
Alternative mobile: 9123456789`;

    const result = service.parseAddressBlock(addressBlock);

    console.log('Test 8 - Alt mobile (Alternative mobile):', JSON.stringify(result, null, 2));

    expect(result.name).toBe('John Doe');
    expect(result.mobileNo).toBe('9876543210');
    expect(result.altMobileNo).toBe('9123456789');
    expect(result.pincode).toBe('400001');
  });

  it('should parse address block 9 - Alt mobile with "Alt no" label', () => {
    const addressBlock = `Name: Jane Smith
Address: 456 Park Avenue
City: Delhi
State: Delhi
Pincode: 110001
Number: 9988776655
Alt no: 8877665544`;

    const result = service.parseAddressBlock(addressBlock);

    console.log('Test 9 - Alt mobile (Alt no):', JSON.stringify(result, null, 2));

    expect(result.name).toBe('Jane Smith');
    expect(result.mobileNo).toBe('9988776655');
    expect(result.altMobileNo).toBe('8877665544');
    expect(result.pincode).toBe('110001');
  });

  it('should parse address block 10 - Alt mobile with "Alternate number" label', () => {
    const addressBlock = `Name: Test User
Address: 789 Test Road
City: Bangalore
State: Karnataka
Pincode: 560001
Phone: 9000011111
Alternate number: 9111122222`;

    const result = service.parseAddressBlock(addressBlock);

    console.log('Test 10 - Alt mobile (Alternate number):', JSON.stringify(result, null, 2));

    expect(result.name).toBe('Test User');
    expect(result.mobileNo).toBe('9000011111');
    expect(result.altMobileNo).toBe('9111122222');
    expect(result.pincode).toBe('560001');
  });

  it('should parse address block 5 - Ati (comma-separated address with labels)', () => {
    const addressBlock = `Name:Ati
Address: Mainland China,18,A, Platinum Techno Park,1st Floor
Landmark:Plot No 17 ,behind RAGHULEELA MALL, Sector 30
City: MAHARASHTRA 
STATE:Navi Mumbai
Pincode:400703
Number:9362097675`;

    const result = service.parseAddressBlock(addressBlock);

    console.log('Test 5 - Ati:', JSON.stringify(result, null, 2));

    expect(result.name).toBe('Ati');
    expect(result.mobileNo).toBe('9362097675');
    expect(result.pincode).toBe('400703');
    expect(result.state).toBe('MAHARASHTRA');
    expect(result.city).toBe('Navi Mumbai');
    // Address line 1 should be fully retained including commas
    expect(result.line1).toBe('Mainland China,18,A, Platinum Techno Park,1st Floor');
    // Landmark should be fully retained including commas
    expect(result.landmark).toBe('Plot No 17 ,behind RAGHULEELA MALL, Sector 30');
  });

  it('should parse block 11 - labeled template with emojis, parenthetical labels & instructions', () => {
    const addressBlock = `*📦 Order Details (Please Fill Below):

Full Name: Ginson Haokip
Complete Address: Hno D-3/6 Vinod puri, Vijay enclave
Landmark (if any): Near Dashrath puri metro station gate no.3
City: New Delhi
State: Delhi
Pincode: 110045
Contact Number:+91 9612911545
Alternate Number (optional): 9612911545
Email ID: (if available)

🔸 Please make sure all details are correct to avoid delivery delays.
🔸 Once you receive your parcel, kindly record a short unboxing video — it helps us verify.`;

    const result = service.parseAddressBlock(addressBlock);

    expect(result.name).toBe('Ginson Haokip');
    expect(result.line1).toBe('Hno D-3/6 Vinod puri, Vijay enclave');
    expect(result.landmark).toBe('Near Dashrath puri metro station gate no.3');
    expect(result.city).toBe('New Delhi');
    expect(result.state).toBe('Delhi');
    expect(result.pincode).toBe('110045');
    expect(result.mobileNo).toBe('9612911545');
    expect(result.altMobileNo).toBe('9612911545');
    expect(result.email).toBe('');
    // Instruction lines must not leak into any field
    expect(JSON.stringify(result)).not.toMatch(/unboxing|order details/i);
  });

  it('should parse block 12 - To/From with sender block excluded & two contact numbers', () => {
    const addressBlock = `To,
R.Lalzarzovi(Tetei)

House no. CH/S-III/11-F
Locality - Near Primary Field,Ṭhuampui
City - Aizawl
Pincode - 796017
State - Mizoram

Contact - 7630045535, 9862783534

From
SwankStore
6290443622`;

    const result = service.parseAddressBlock(addressBlock);

    expect(result.name).toBe('R.Lalzarzovi(Tetei)');
    expect(result.line1).toBe('House no. CH/S-III/11-F');
    expect(result.line2).toBe('Near Primary Field,Ṭhuampui');
    expect(result.city).toBe('Aizawl');
    expect(result.state).toBe('Mizoram');
    expect(result.pincode).toBe('796017');
    expect(result.mobileNo).toBe('7630045535');
    expect(result.altMobileNo).toBe('9862783534');
    // Sender details must never appear
    expect(JSON.stringify(result)).not.toMatch(/swankstore|6290443622/i);
  });

  it('should parse block 13 - trailing periods & trailing product spec lines', () => {
    const addressBlock = `Name : Vanlalhriati Pachuau
Address : PUC GIRLS HOSTEL, College veng, Aizawl.
City : Aizawl.
State : Mizoram.
Pincode : 796001
9863228338

Size 35
Colour black
Hightops `;

    const result = service.parseAddressBlock(addressBlock);

    expect(result.name).toBe('Vanlalhriati Pachuau');
    expect(result.line1).toBe('PUC GIRLS HOSTEL, College veng, Aizawl');
    expect(result.city).toBe('Aizawl');
    expect(result.state).toBe('Mizoram');
    expect(result.pincode).toBe('796001');
    expect(result.mobileNo).toBe('9863228338');
    // Product specs must not leak in
    expect(JSON.stringify(result)).not.toMatch(/size|colour|hightops/i);
  });

  it('should parse block 14 - header prompt lines with dash separators', () => {
    const addressBlock = `Fill this 👇
Adress details

Name-aaliya
Address-sattva opus,tumkur road,Tower B 16th floor 1604
City-bengaluru
State-karnataka
Pincode-560057
Phone number-7022685086`;

    const result = service.parseAddressBlock(addressBlock);

    expect(result.name).toBe('aaliya');
    expect(result.line1).toBe('sattva opus,tumkur road,Tower B 16th floor 1604');
    expect(result.city).toBe('bengaluru');
    expect(result.state).toBe('karnataka');
    expect(result.pincode).toBe('560057');
    expect(result.mobileNo).toBe('7022685086');
  });

  it('should parse block 15 - no city label, city derived from pincode', () => {
    const addressBlock = `Name- Aju Ahmed Laskar
Address-khatla peter street
State-Mizoram
Landmark-NBE tata motors
Phone-8132993081
Pin-796001`;

    const result = service.parseAddressBlock(addressBlock);

    expect(result.name).toBe('Aju Ahmed Laskar');
    expect(result.line1).toBe('khatla peter street');
    expect(result.state).toBe('Mizoram');
    expect(result.landmark).toBe('NBE tata motors');
    expect(result.mobileNo).toBe('8132993081');
    expect(result.pincode).toBe('796001');
    expect(result.city).toContain('Aizawl');
  });
});
