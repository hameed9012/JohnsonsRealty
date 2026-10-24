// Name, story and detail pools for generated sellers. Plain data; the generator picks from them with a seeded PRNG.

export const FIRST_F = [
  'Elaine', 'Margaret', 'Priya', 'Renée', 'Lena', 'Dolores', 'Kendra', 'Alexis', 'Grace', 'Naomi', 'Theresa', 'Carmen', 'Mei', 'Aisha', 'Joanna', 'Linda',
  'Sofia', 'Hannah', 'Ruth', 'Monica', 'Yolanda', 'Deborah', 'Fatima', 'Ingrid', 'Rosa', 'Beth', 'Gloria', 'Anita', 'Claire', 'Tamara', 'Leah', 'Nadia',
];
export const FIRST_M = [
  'Raymond', 'Gregory', 'Daniel', 'Anthony', 'Victor', 'Gary', 'Frank', 'Jordan', 'Marcus', 'Samuel', 'Walter', 'Hector', 'Kenji', 'Omar', 'Peter', 'Douglas',
  'Rafael', 'Thomas', 'Andre', 'Stephen', 'Ibrahim', 'Leon', 'Curtis', 'Arthur', 'Mateo', 'Paul', 'Dennis', 'Wesley', 'Harold', 'Neil', 'Elliot', 'Rajesh',
];
/** Short forms for "Goes by". */
export const SHORT: Record<string, string> = {
  Raymond: 'Ray', Gregory: 'Greg', Daniel: 'Dan', Anthony: 'Tony', Samuel: 'Sam', Walter: 'Walt', Thomas: 'Tom', Stephen: 'Steve', Douglas: 'Doug',
  Margaret: 'Peggy', Dolores: 'Dee', Deborah: 'Deb', Theresa: 'Terri', Joanna: 'Jo', Rajesh: 'Raj', Arthur: 'Art', Dennis: 'Denny',
};
export const MIDDLE_F = ['Marie', 'Ann', 'Louise', 'Jean', 'Rose', 'Elizabeth', 'Grace', 'Lynn', 'Kay', 'Joy'];
export const MIDDLE_M = ['Joseph', 'Alan', 'James', 'Robert', 'Allen', 'Michael', 'Edward', 'Lee', 'Thomas', 'Paul'];
export const SURNAMES = [
  'Porter', 'Kowalski', 'Raman', 'Castellano', 'Hartmann', 'Hayes', 'Lindqvist', 'Brennan', 'Whitaker', 'Marchetti', 'Malhotra', 'Boyd', 'Delgado',
  'Okafor', 'Nguyen', 'Schreiber', 'Moretti', 'Yoder', 'Brubaker', 'Fitzgerald', 'Alvarez', 'Novak', 'Haddad', 'Kim', 'Sullivan', 'Washington', 'Ferreira',
  'Lindgren', 'Petrov', 'Gallagher', 'Mendoza', 'Zimmerman', 'Osei', 'Reyes', 'Kaufman', 'Tanaka', 'Murphy', 'Dubois', 'Stoltzfus', 'Bianchi',
];

/** Occupations by price band. Ages 65+ become "retired …". */
export const JOBS = {
  low: ['school bus driver', 'warehouse supervisor', 'nurse aide', 'diesel mechanic', 'line cook', 'postal carrier', 'retail store manager', 'steelworker', 'home health aide', 'machinist'],
  mid: ['high school teacher', 'registered nurse', 'electrician', 'accountant', 'police sergeant', 'dental hygienist', 'HVAC technician', 'insurance adjuster', 'physical therapist', 'pharmacist'],
  high: ['orthodontist', 'anesthesiologist', 'software architect', 'corporate attorney', 'restaurant group owner', 'cardiologist', 'investment adviser', 'architect', 'hospital administrator', 'construction company owner'],
} as const;

/** Handle suffixes in the files' style (GregHartmannDDS, PRaman_MD). */
export const HANDLE_SUFFIX: Record<string, string> = {
  orthodontist: 'DDS', anesthesiologist: '_MD', cardiologist: '_MD', 'corporate attorney': 'Law', architect: 'Designs', 'construction company owner': 'Builds',
  electrician: 'Electric', 'HVAC technician': '_HVAC', 'diesel mechanic': 'Garage', 'restaurant group owner': 'Eats', 'investment adviser': 'Capital',
};
export const PA_TOWNS = ['Steelton', 'Hershey', 'Camp_Hill', 'Mechanicsburg', 'Linglestown', 'Middletown', 'Hummelstown', 'Enola'];

/** Mailing addresses after the move: out of state, real-looking. [city, state, zip prefix]. */
export const CITIES: [string, string, string][] = [
  ['Columbus', 'OH', '432'], ['Raleigh', 'NC', '276'], ['Charleston', 'SC', '294'], ['Asheville', 'NC', '288'], ['Baltimore', 'MD', '212'], ['Richmond', 'VA', '232'],
  ['Sarasota', 'FL', '342'], ['Scottsdale', 'AZ', '852'], ['Denver', 'CO', '802'], ['Nashville', 'TN', '372'], ['Burlington', 'VT', '054'], ['Portland', 'ME', '041'],
  ['Cambridge', 'MA', '021'], ['Wilmington', 'DE', '198'], ['Savannah', 'GA', '314'], ['Austin', 'TX', '787'], ['Madison', 'WI', '537'], ['Boise', 'ID', '837'],
];
export const STREETS = ['Brookside Drive', 'Harbour Town Lane', 'Kendall Street', 'Sunridge Drive', 'Magnolia Avenue', 'Willow Bend Road', 'Ocean View Court', 'Cedar Ridge Way', 'Lakeshore Boulevard', 'Juniper Lane', 'Summit Avenue', 'Palmetto Street'];

export const LENDERS = ['Commonwealth Home Lending', 'Keystone Federal Bank', 'Penn Valley Bank', 'Susquehanna Savings', 'Capital Region Credit Union', 'Liberty Mutual Home Loans'];
export const TITLE_COMPANIES = ['Keystone Abstract & Title Co.', 'Capital Area Settlement Services', 'Susquehanna Title & Escrow'];
export const BEST_TIME = ['Phone call, weekday mornings', 'Text message, any time', 'Messages in the evening', 'Phone call, afternoons', 'Written messages during the day', 'Messages before 9 am'];

export type Motive = 'downsizing' | 'job' | 'estate' | 'upsizing' | 'divorce' | 'retiring';
/** Reasons, timelines and how motivated each makes a seller (lowest price as a share of asking). */
export const MOTIVES: Record<Motive, { reason: string; timeline: string; days: [number, number]; lowest: [number, number]; story: string }> = {
  downsizing: { reason: 'Downsizing now the children have moved out', timeline: 'Flexible, 45 to 90 days', days: [45, 90], lowest: [0.95, 0.97], story: 'With the children grown and gone, the house is more than they need.' },
  job: { reason: 'Job relocation out of state', timeline: 'Must settle within 45 days', days: [30, 45], lowest: [0.92, 0.94], story: 'A new job out of state starts soon, so the timing matters more than the last dollar.' },
  estate: { reason: 'Estate sale', timeline: 'Settle in 60 to 90 days', days: [60, 90], lowest: [0.92, 0.94], story: 'The heirs live out of state and would like the house sold cleanly and without fuss.' },
  upsizing: { reason: 'Moving to a bigger home for a growing family', timeline: 'Settle in 45 to 60 days, to line up with their purchase', days: [45, 60], lowest: [0.95, 0.97], story: 'A second child is on the way and they have already found the next house.' },
  divorce: { reason: 'Divorce. Both owners want a quick, clean sale', timeline: 'Settle in 30 to 60 days', days: [30, 60], lowest: [0.92, 0.95], story: 'They are separating amicably and want the sale handled quickly and politely.' },
  retiring: { reason: 'Retiring and moving closer to family', timeline: 'Settle in 45 to 75 days', days: [45, 75], lowest: [0.94, 0.96], story: 'Retirement is here and the grandchildren live a long drive away.' },
};

/** Follows "is" / "are", so it reads for one owner or two. */
export const PERSONALITY = [
  'warm and chatty, with a soft spot for selling to a family',
  'brisk and businesslike, with every offer expected in writing',
  'proud of the house, with a story behind every repair',
  'quiet and private, and happier out of the house during showings',
  'practical and quick to reply, with no patience for late surprises',
  'easygoing and plain-spoken, with tidy records for everything',
];

export const EXCLUDED = ['Dining room chandelier (a family piece). A standard fixture goes up in its place', 'Living room TV', 'Garden ornaments and planters', 'The workbench in the garage', 'Framed artwork'];

/** Small honest defects, each tied to the disclosure item it belongs on. `needs` keeps them from contradicting the listing. */
export const DEFECTS: { item: string; detail: string; needs?: 'garage' | 'basement' | 'pool' | 'yard' }[] = [
  { item: 'windows_doors', detail: 'The garage door sticks in cold weather.', needs: 'garage' },
  { item: 'windows_doors', detail: 'One upstairs window is hard to open.' },
  { item: 'appliances', detail: 'The dishwasher is noisy but works.' },
  { item: 'windows_doors', detail: 'The fence stain is fading on the south side.', needs: 'yard' },
  { item: 'plumbing', detail: 'The guest bathroom tap drips now and then.' },
  { item: 'basement_water', detail: 'A little damp in one basement corner after very heavy rain. No standing water.', needs: 'basement' },
  { item: 'pool_spa', detail: 'The pool cover has a small tear. The pool itself is sound.', needs: 'pool' },
  { item: 'electrical', detail: 'One kitchen outlet needs a new cover plate.' },
];

export const SHOWINGS = [
  "24 hours' notice. Lockbox on the front door. The sellers leave during showings.",
  "Two hours' notice. No lockbox; the seller lets buyers in and waits outside.",
  "Four hours' notice. The agent meets buyers at the house.",
  "24 hours' notice. Lockbox on the side door. Please leave the lights as you found them.",
];
