/**
 * Database seeder — populates the database with realistic sample data.
 * Safe to re-run: clears existing data before inserting fresh records.
 *
 * Run with: npm run db:seed
 */

import { v4 as uuidv4 } from 'uuid';
import { db } from './index.js';
import { vehicleActions, vehicles } from './schema.js';

const AGING_THRESHOLD_DAYS = 90;

function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

// ---------------------------------------------------------------------------
// Vehicle data — 25 vehicles total; first 7 are aging (>90 days old)
// ---------------------------------------------------------------------------

const SEED_VEHICLES = [
  // --- Aging vehicles (>90 days) ---
  {
    id: uuidv4(),
    vin: 'JT2BF22K1W0123401',
    make: 'Toyota',
    model: 'Camry',
    year: 2020,
    colour: 'Silver',
    price: 18500,
    addedAt: daysAgo(120),
  },
  {
    id: uuidv4(),
    vin: '1HGCM82633A123402',
    make: 'Honda',
    model: 'Accord',
    year: 2019,
    colour: 'Black',
    price: 16200,
    addedAt: daysAgo(105),
  },
  {
    id: uuidv4(),
    vin: '2T1BURHE0JC123403',
    make: 'Toyota',
    model: 'Corolla',
    year: 2021,
    colour: 'White',
    price: 15800,
    addedAt: daysAgo(98),
  },
  {
    id: uuidv4(),
    vin: '3VWFE21C04M123404',
    make: 'Volkswagen',
    model: 'Golf',
    year: 2020,
    colour: 'Blue',
    price: 17300,
    addedAt: daysAgo(150),
  },
  {
    id: uuidv4(),
    vin: 'WBANE53521CM23405',
    make: 'BMW',
    model: '3 Series',
    year: 2019,
    colour: 'Grey',
    price: 28900,
    addedAt: daysAgo(200),
  },
  {
    id: uuidv4(),
    vin: '1G1ZT53806F123406',
    make: 'Chevrolet',
    model: 'Malibu',
    year: 2018,
    colour: 'Red',
    price: 13400,
    addedAt: daysAgo(180),
  },
  {
    id: uuidv4(),
    vin: '2FMDK3JC8BB123407',
    make: 'Ford',
    model: 'Edge',
    year: 2020,
    colour: 'White',
    price: 22100,
    addedAt: daysAgo(95),
  },
  // --- Recent vehicles (<90 days) ---
  {
    id: uuidv4(),
    vin: '5YJSA1DN5DFP23408',
    make: 'Tesla',
    model: 'Model S',
    year: 2023,
    colour: 'Pearl White',
    price: 74900,
    addedAt: daysAgo(5),
  },
  {
    id: uuidv4(),
    vin: '1N4AL3AP8JC123409',
    make: 'Nissan',
    model: 'Altima',
    year: 2022,
    colour: 'Champagne',
    price: 19800,
    addedAt: daysAgo(14),
  },
  {
    id: uuidv4(),
    vin: 'KNDJP3A50H7123410',
    make: 'Kia',
    model: 'Soul',
    year: 2022,
    colour: 'Orange',
    price: 17600,
    addedAt: daysAgo(30),
  },
  {
    id: uuidv4(),
    vin: '5NPE24AF8FH123411',
    make: 'Hyundai',
    model: 'Sonata',
    year: 2021,
    colour: 'Blue',
    price: 20300,
    addedAt: daysAgo(45),
  },
  {
    id: uuidv4(),
    vin: '1FADP3F20EL123412',
    make: 'Ford',
    model: 'Focus',
    year: 2020,
    colour: 'Black',
    price: 14200,
    addedAt: daysAgo(60),
  },
  {
    id: uuidv4(),
    vin: '2C3CCAEG8FH123413',
    make: 'Chrysler',
    model: '300',
    year: 2021,
    colour: 'Burgundy',
    price: 26700,
    addedAt: daysAgo(22),
  },
  {
    id: uuidv4(),
    vin: 'WAUFFAFL5DN123414',
    make: 'Audi',
    model: 'A4',
    year: 2022,
    colour: 'Glacier White',
    price: 38500,
    addedAt: daysAgo(10),
  },
  {
    id: uuidv4(),
    vin: 'WDD2050421F123415',
    make: 'Mercedes-Benz',
    model: 'C-Class',
    year: 2022,
    colour: 'Obsidian Black',
    price: 42000,
    addedAt: daysAgo(7),
  },
  {
    id: uuidv4(),
    vin: '1G1BE5SM0H7123416',
    make: 'Chevrolet',
    model: 'Cruze',
    year: 2021,
    colour: 'Summit White',
    price: 15900,
    addedAt: daysAgo(55),
  },
  {
    id: uuidv4(),
    vin: '3MW5R1J07M8B23417',
    make: 'BMW',
    model: '2 Series',
    year: 2023,
    colour: 'Mineral Grey',
    price: 35200,
    addedAt: daysAgo(3),
  },
  {
    id: uuidv4(),
    vin: 'JTDKBRFU0H3123418',
    make: 'Toyota',
    model: 'Prius',
    year: 2022,
    colour: 'Magnetic Grey',
    price: 24600,
    addedAt: daysAgo(40),
  },
  {
    id: uuidv4(),
    vin: '19XFC2F59GE123419',
    make: 'Honda',
    model: 'Civic',
    year: 2023,
    colour: 'Sonic Grey',
    price: 22400,
    addedAt: daysAgo(18),
  },
  {
    id: uuidv4(),
    vin: '5XXGT4L30HG123420',
    make: 'Kia',
    model: 'Optima',
    year: 2021,
    colour: 'Snow White Pearl',
    price: 19100,
    addedAt: daysAgo(70),
  },
  {
    id: uuidv4(),
    vin: 'KMHD84LF8HU123421',
    make: 'Hyundai',
    model: 'Elantra',
    year: 2022,
    colour: 'Phantom Black',
    price: 18700,
    addedAt: daysAgo(25),
  },
  {
    id: uuidv4(),
    vin: '1VWBH7A31DC123422',
    make: 'Volkswagen',
    model: 'Passat',
    year: 2020,
    colour: 'Reflex Silver',
    price: 21500,
    addedAt: daysAgo(50),
  },
  {
    id: uuidv4(),
    vin: 'JN1AZ4EH0FM123423',
    make: 'Nissan',
    model: 'GT-R',
    year: 2021,
    colour: 'Midnight Purple',
    price: 89000,
    addedAt: daysAgo(35),
  },
  {
    id: uuidv4(),
    vin: '1FTFW1ET5DFC23424',
    make: 'Ford',
    model: 'F-150',
    year: 2022,
    colour: 'Iconic Silver',
    price: 45300,
    addedAt: daysAgo(12),
  },
  {
    id: uuidv4(),
    vin: '2GNFLNEK8H6123425',
    make: 'Chevrolet',
    model: 'Equinox',
    year: 2023,
    colour: 'Mosaic Black',
    price: 31200,
    addedAt: daysAgo(8),
  },
] as const;

// ---------------------------------------------------------------------------
// Action records — one or more per aging vehicle (first 7)
// ---------------------------------------------------------------------------

function buildActions(): Array<{
  id: string;
  vehicleId: string;
  actionType: string;
  notes: string | null;
}> {
  const agingVehicles = SEED_VEHICLES.slice(0, 7);

  return [
    {
      id: uuidv4(),
      vehicleId: agingVehicles[0].id,
      actionType: 'PRICE_REDUCTION',
      notes: 'Reduced asking price by $1,500 to stimulate interest.',
    },
    {
      id: uuidv4(),
      vehicleId: agingVehicles[0].id,
      actionType: 'PROMOTION',
      notes: 'Featured in weekend newspaper ad campaign.',
    },
    {
      id: uuidv4(),
      vehicleId: agingVehicles[1].id,
      actionType: 'PRICE_REDUCTION',
      notes: 'Price dropped to match competitor listing.',
    },
    {
      id: uuidv4(),
      vehicleId: agingVehicles[2].id,
      actionType: 'PROMOTION',
      notes: 'Added to social media spotlight post.',
    },
    {
      id: uuidv4(),
      vehicleId: agingVehicles[3].id,
      actionType: 'TRANSFER',
      notes: 'Scheduled for transfer to high-traffic branch next week.',
    },
    {
      id: uuidv4(),
      vehicleId: agingVehicles[4].id,
      actionType: 'AUCTION',
      notes: 'Registered for upcoming Thursday dealer auction.',
    },
    {
      id: uuidv4(),
      vehicleId: agingVehicles[5].id,
      actionType: 'OTHER',
      notes: 'Detailed and photographed for refreshed online listing.',
    },
    {
      id: uuidv4(),
      vehicleId: agingVehicles[6].id,
      actionType: 'PRICE_REDUCTION',
      notes: 'Minor price adjustment to stay competitive.',
    },
  ];
}

// ---------------------------------------------------------------------------
// Main seed function
// ---------------------------------------------------------------------------

async function seed(): Promise<void> {
  console.log('🌱 Starting database seed...');

  // Clear existing data (actions first due to FK constraint)
  console.log('  Clearing existing data...');
  db.delete(vehicleActions).run();
  db.delete(vehicles).run();

  // Insert vehicles
  console.log(`  Inserting ${SEED_VEHICLES.length} vehicles...`);
  for (const vehicle of SEED_VEHICLES) {
    db.insert(vehicles).values(vehicle).run();
  }

  // Insert actions for aging vehicles
  const actions = buildActions();
  console.log(`  Inserting ${actions.length} action records for aging vehicles...`);
  for (const action of actions) {
    db.insert(vehicleActions).values(action).run();
  }

  const agingCount = SEED_VEHICLES.filter(
    (v) => {
      const addedAt = new Date(v.addedAt);
      const diffMs = Date.now() - addedAt.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      return diffDays >= AGING_THRESHOLD_DAYS;
    },
  ).length;

  console.log('');
  console.log('✅ Seed complete!');
  console.log(`   Total vehicles : ${SEED_VEHICLES.length}`);
  console.log(`   Aging vehicles : ${agingCount} (>${AGING_THRESHOLD_DAYS} days)`);
  console.log(`   Action records : ${actions.length}`);
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
