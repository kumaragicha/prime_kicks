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
    expect(result.line2).toContain('Sikkim professional university');
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
    expect(result.line2).toContain('Sombaria');
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
    expect(result.line2).toContain('ridge Park');
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
    expect(result.line2).toContain('Near post office');
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
    expect(result.line2).toContain('bhabanipur near lp school');
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
    expect(result.line2).toContain('Plot No 17 ,behind RAGHULEELA MALL, Sector 30');
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
    expect(result.line2).toContain('Near Dashrath puri metro station gate no.3');
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
    // City ("Aizawl") is stripped from line1 since it has its own field.
    expect(result.line1).toBe('PUC GIRLS HOSTEL, College veng');
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
    expect(result.line2).toContain('NBE tata motors');
    expect(result.mobileNo).toBe('8132993081');
    expect(result.pincode).toBe('796001');
    expect(result.city).toContain('Aizawl');
  });

  it('should drop the inline "From:" sender line and strip city/state from line1', () => {
    const addressBlock = `From:-HYPEBEAST_DARJEELING
NAME- Nakul Pariyar
ADDRESS-  P 72 block INS KUNJALI, near us club, south colaba, Mumbai, Maharashtra
LANDMARK- near us club
CITY- Mumbai
STATE- Maharashtra
PINCODE- 400005
NUMBER-9832531300
ALTERNATIVE NUMBER- 7679471252`;

    const result = service.parseAddressBlock(addressBlock);

    expect(result.name).toBe('Nakul Pariyar');
    // Sender header dropped, city/state removed from line1.
    expect(result.line1).not.toMatch(/hypebeast/i);
    expect(result.line1).not.toMatch(/mumbai|maharashtra/i);
    // Landmark is folded into line 2, no separate landmark field.
    expect(result.line2).toContain('near us club');
    expect(result.landmark).toBe('');
    expect(result.city).toBe('Mumbai');
    expect(result.state).toBe('Maharashtra');
    expect(result.pincode).toBe('400005');
    expect(result.mobileNo).toBe('9832531300');
    expect(result.altMobileNo).toBe('7679471252');
  });

  it('should keep line1 within 100 chars, spilling overflow into line2', () => {
    const addressBlock = `Name- Test User
Address- Flat 101 Sunshine Apartments, Plot 45 Sector 12 Extension, Behind the Grand Central Mall complex, MG Road area
State- Delhi
Pincode- 110001
Phone- 9832531300`;

    const result = service.parseAddressBlock(addressBlock);

    expect(result.line1.length).toBeLessThanOrEqual(100);
    expect(result.line2.length).toBeGreaterThan(0);
    // Together they still contain the full street address.
    expect(`${result.line1}, ${result.line2}`).toContain('MG Road area');
  });

  it('should parse address with two unlabeled contact numbers - first as primary, second as alternative', () => {
    const addressBlock = `Pratiksha Tamang
Hakim para Siliguri
path bhawan school
West Bengal
734001
6296956142
7679471252`;

    const result = service.parseAddressBlock(addressBlock);

    console.log(
      'Test - Pratiksha Tamang (two unlabeled numbers):',
      JSON.stringify(result, null, 2),
    );

    expect(result.name).toBe('Pratiksha Tamang');
    expect(result.mobileNo).toBe('6296956142'); // First number as primary
    expect(result.altMobileNo).toBe('7679471252'); // Second number as alternative
    expect(result.pincode).toBe('734001');
    expect(result.state).toBe('West Bengal');
    expect(result.line1).toContain('Hakim para Siliguri');
    expect(result.line2).toContain('path bhawan school');
  });

  it('should parse address with two unlabeled numbers on same line', () => {
    const addressBlock = `Name: Test User
Address: 123 Main Street
City: Mumbai
State: Maharashtra
Pincode: 400001
9876543210 9123456789`;

    const result = service.parseAddressBlock(addressBlock);

    console.log('Test - Two numbers on same line:', JSON.stringify(result, null, 2));

    expect(result.name).toBe('Test User');
    expect(result.mobileNo).toBe('9876543210'); // First number as primary
    expect(result.altMobileNo).toBe('9123456789'); // Second number as alternative
    expect(result.pincode).toBe('400001');
  });

  it('parses flexible labels and preserves the first two phone numbers in order', () => {
    const addressBlock = `Name= kartik chorvadi
Full addresh=raj mahal road koli samaj complax veraval
City= veraval
State= gujrat
Pin code= 362265
Alternative contact: +91 63521-84172
Phone no.: 98765 43210`;

    const result = service.parseAddressBlock(addressBlock);

    expect(result.name).toBe('kartik chorvadi');
    expect(result.line1).toBe('raj mahal road koli samaj complax veraval');
    expect(result.city).toBe('veraval');
    expect(result.state).toBe('gujrat');
    expect(result.pincode).toBe('362265');
    // The first valid number wins even when its label says "Alternative".
    expect(result.mobileNo).toBe('6352184172');
    expect(result.altMobileNo).toBe('9876543210');
  });

  it('parses the Kartik Chorvadi address format', () => {
    const result = service.parseAddressBlock(`Name= kartik chorvadi
Full addresh=raj mahal road koli samaj complax veraval
City= veraval
State= gujrat
Pin code= 362265
Phone no.= 6352184172`);

    expect(result).toMatchObject({
      name: 'kartik chorvadi',
      line1: 'raj mahal road koli samaj complax veraval',
      city: 'veraval',
      state: 'gujrat',
      pincode: '362265',
      mobileNo: '6352184172',
      altMobileNo: '',
    });
  });

  it('should parse block 16 - Vetsuno Lohe (labeled, alt number + trailing size line)', () => {
    const result = service.parseAddressBlock(`Name - Vetsuno Lohe
Address - capital view girls pg Jotsoma
Landmark -Near Kohima Science College
City -kohima
State-nagaland
pincod-797002
Number - 9366399248
Alternative no -8415021868
Size (39) with box`);

    expect(result.name).toBe('Vetsuno Lohe');
    expect(result.line1).toBe('capital view girls pg Jotsoma');
    // Landmark is folded into line 2 (Shipmozo has no landmark field).
    expect(result.line2).toContain('Near Kohima Science College');
    expect(result.city).toBe('kohima');
    expect(result.state).toBe('nagaland');
    expect(result.pincode).toBe('797002');
    expect(result.mobileNo).toBe('9366399248');
    expect(result.altMobileNo).toBe('8415021868');
    // The trailing product-spec line must never leak into any field.
    expect(JSON.stringify(result)).not.toMatch(/size|\bbox\b|\b39\b/i);
  });

  it('should parse block 17 - Francis Lalruattluanga (labeled, no alt number)', () => {
    const result = service.parseAddressBlock(`Name - Francis Lalruattluanga
Address - Chaltlang Ruam Veng
Landmark - Near Badminton Inn
City - Aizawl
State- Mizoram
pincode - 796012
Number - 8974730240`);

    expect(result.name).toBe('Francis Lalruattluanga');
    expect(result.line1).toBe('Chaltlang Ruam Veng');
    expect(result.line2).toContain('Near Badminton Inn');
    expect(result.city).toBe('Aizawl');
    expect(result.state).toBe('Mizoram');
    expect(result.pincode).toBe('796012');
    expect(result.mobileNo).toBe('8974730240');
    expect(result.altMobileNo).toBe('');
  });
});
