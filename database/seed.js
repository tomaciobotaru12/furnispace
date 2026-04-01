require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const db = require('./db');
const bcrypt = require('bcryptjs');

// Only seed if products table is empty
const count = db.prepare('SELECT COUNT(*) as n FROM products').get();
if (count.n > 0) {
  console.log('Database already seeded, skipping.');
  process.exit(0);
}

console.log('Seeding database...');

// Categories
const insertCategory = db.prepare(`
  INSERT OR IGNORE INTO categories (name, slug, description, icon) VALUES (?, ?, ?, ?)
`);

const categories = [
  ['Living Room', 'living-room', 'Sofas, coffee tables, armchairs and more for your living space.', '🛋️'],
  ['Bedroom',     'bedroom',     'Beds, wardrobes, nightstands and dressers for restful nights.', '🛏️'],
  ['Dining',      'dining',      'Dining tables, chairs and sideboards for shared moments.', '🍽️'],
  ['Office',      'office',      'Desks, chairs and storage for a productive workspace.', '💼'],
  ['Lighting',    'lighting',    'Pendant lamps, floor lamps and table lamps for every mood.', '💡'],
  ['Storage',     'storage',     'Bookshelves, cabinets and baskets to keep things tidy.', '🗄️'],
];

const insertedCategories = {};
for (const [name, slug, description, icon] of categories) {
  insertCategory.run(name, slug, description, icon);
  insertedCategories[slug] = db.prepare('SELECT id FROM categories WHERE slug = ?').get(slug).id;
}

// Products
const insertProduct = db.prepare(`
  INSERT INTO products
    (name, slug, description, short_description, price, sale_price, stock, material, dimensions, eco_score, image, category_id, featured)
  VALUES
    (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const products = [
  // Living Room
  {
    name: 'Oslo 3-Seater Sofa',
    slug: 'oslo-3-seater-sofa',
    description: 'The Oslo sofa combines Scandinavian minimalism with supreme comfort. Upholstered in natural linen fabric over a solid oak frame, it brings warmth and elegance to any living room. The cushions are filled with recycled polyester and organic cotton for a sustainable, cloud-like feel.',
    short: 'Scandinavian linen sofa with solid oak legs and recycled cushion filling.',
    price: 3499, sale_price: null, stock: 5,
    material: 'Linen / Solid Oak', dimensions: '220 x 85 x 78 cm',
    eco: 4, category: 'living-room', featured: 1,
    image: '/images/nordic-comfort-sofa.jpg',
  },
  {
    name: 'Drift Coffee Table',
    slug: 'drift-coffee-table',
    description: 'Crafted from sustainably sourced reclaimed oak, the Drift coffee table is a statement piece that tells a story. Each table is unique, with natural grain variations and character marks. Finished with a natural oil for protection and a matte look.',
    short: 'Reclaimed oak coffee table with natural oil finish, unique grain pattern.',
    price: 899, sale_price: 749, stock: 8,
    material: 'Reclaimed Oak', dimensions: '110 x 60 x 42 cm',
    eco: 5, category: 'living-room', featured: 1,
    image: '/images/fjord-coffee-table.jpg',
  },
  {
    name: 'Halo TV Stand',
    slug: 'halo-tv-stand',
    description: 'The Halo TV stand offers clean lines and thoughtful storage. With two cable-management doors and open shelving, it keeps your living room tidy while looking effortlessly modern. Made from solid pine with a light ash finish.',
    short: 'Minimalist pine TV stand with cable management and open shelving.',
    price: 1299, sale_price: null, stock: 6,
    material: 'Solid Pine / Ash Veneer', dimensions: '160 x 40 x 55 cm',
    eco: 3, category: 'living-room', featured: 0,
    image: '/images/loft-armchair.jpg',
  },
  // Bedroom
  {
    name: 'Nordic Oak Bed Frame',
    slug: 'nordic-oak-bed-frame',
    description: 'The Nordic bed frame is built to last generations. Solid oak construction with a slatted headboard and smooth rounded legs. FSC-certified wood and non-toxic finish make it a responsible choice for your bedroom. Available for standard 160x200 cm mattresses.',
    short: 'FSC-certified solid oak bed frame with slatted headboard for 160x200 cm mattress.',
    price: 2799, sale_price: null, stock: 4,
    material: 'Solid Oak (FSC-certified)', dimensions: '170 x 210 x 95 cm',
    eco: 5, category: 'bedroom', featured: 1,
    image: '/images/haven-platform-bed-160.jpg',
  },
  {
    name: 'Cloud Nightstand',
    slug: 'cloud-nightstand',
    description: 'The Cloud nightstand keeps your essentials close with a soft, rounded design that complements any bedroom style. Features one drawer with a solid oak handle and an open lower shelf. Made from oak veneer on a solid pine carcass.',
    short: 'Rounded oak veneer nightstand with one drawer and open shelf.',
    price: 649, sale_price: null, stock: 10,
    material: 'Oak Veneer / Solid Pine', dimensions: '45 x 40 x 58 cm',
    eco: 4, category: 'bedroom', featured: 0,
    image: '/images/luna-nightstand.jpg',
  },
  {
    name: 'Lumi Wardrobe',
    slug: 'lumi-wardrobe',
    description: 'The Lumi wardrobe offers generous storage in a clean, elegant silhouette. Two hinged doors open to reveal a hanging rail, three shelves and two drawers. Solid pine construction with subtle grain detailing and matte black hardware.',
    short: 'Solid pine wardrobe with hanging rail, shelves, and two drawers.',
    price: 3999, sale_price: 3499, stock: 3,
    material: 'Solid Pine', dimensions: '120 x 58 x 200 cm',
    eco: 5, category: 'bedroom', featured: 1,
    image: '/images/mist-wardrobe-3-door.jpg',
  },
  // Dining
  {
    name: 'Round Walnut Dining Table',
    slug: 'round-walnut-dining-table',
    description: 'A round dining table that brings everyone together. The solid walnut top is finished with a food-safe hardwax oil, while the tapered legs are made from sustainably harvested ash. Seats 4-6 comfortably. The round shape encourages conversation and makes the most of smaller dining rooms.',
    short: 'Solid walnut round dining table on ash legs, seats 4-6, food-safe finish.',
    price: 2199, sale_price: null, stock: 5,
    material: 'Solid Walnut / Ash', dimensions: 'Ø 120 x 75 cm',
    eco: 4, category: 'dining', featured: 1,
    image: '/images/gather-dining-table-180.jpg',
  },
  {
    name: 'Cord Dining Chair',
    slug: 'cord-dining-chair',
    description: 'The Cord dining chair is a Scandinavian classic reimagined. The woven cotton cord seat and back provide flexible support and a distinctive texture. The solid beech frame is steam-bent for smooth curves and durability. Sold as a set of two.',
    short: 'Set of 2 solid beech chairs with woven cotton cord seat and back.',
    price: 599, sale_price: null, stock: 12,
    material: 'Solid Beech / Cotton Cord', dimensions: '47 x 52 x 80 cm',
    eco: 3, category: 'dining', featured: 0,
    image: '/images/arc-dining-chair.jpg',
  },
  {
    name: 'Oak Sideboard Cabinet',
    slug: 'oak-sideboard-cabinet',
    description: 'Store and display in style with the Oak Sideboard. Three spacious compartments behind shaker-style doors, topped with a solid oak surface. The perfect addition to a dining room or hallway. Made from FSC-certified oak with traditional mortise-and-tenon joinery.',
    short: 'FSC-certified oak sideboard with 3 compartments and solid oak top.',
    price: 1799, sale_price: null, stock: 4,
    material: 'Solid Oak (FSC-certified)', dimensions: '150 x 42 x 80 cm',
    eco: 5, category: 'dining', featured: 1,
    image: '/images/sideboard-cabinet-160.jpg',
  },
  // Office
  {
    name: 'Float Desk',
    slug: 'float-desk',
    description: 'The Float desk is designed for focus. A wide solid birch top gives you plenty of room to work, while the integrated cable channel keeps your setup tidy. The tapered legs are adjustable in height (±3 cm). Finished with a water-based lacquer, free from harmful solvents.',
    short: 'Wide solid birch desk with cable channel and height-adjustable legs.',
    price: 1399, sale_price: 1199, stock: 7,
    material: 'Solid Birch', dimensions: '140 x 70 x 75 cm',
    eco: 4, category: 'office', featured: 1,
    image: '/images/focus-desk-140cm.jpg',
  },
  {
    name: 'Mesh Office Chair',
    slug: 'mesh-office-chair',
    description: 'Spend long hours in comfort with the Mesh Office Chair. The breathable recycled mesh back provides lumbar support without trapping heat, while the seat cushion uses post-consumer recycled foam. Adjustable armrests, seat height and tilt tension ensure a perfect fit.',
    short: 'Ergonomic chair with recycled mesh back, adjustable armrests and lumbar support.',
    price: 1099, sale_price: null, stock: 8,
    material: 'Recycled Mesh / Aluminum / Recycled Foam', dimensions: '65 x 65 x 95-105 cm',
    eco: 3, category: 'office', featured: 0,
    image: '/images/ergon-office-chair.jpg',
  },
  {
    name: 'Nook Cabinet',
    slug: 'nook-cabinet',
    description: 'The Nook cabinet is the perfect companion for a home office or study. Four open shelves above a drawer unit give you space to organise books, files and stationery. Made from solid oak with traditional dovetail joints on the drawers for lasting quality.',
    short: 'Solid oak office cabinet with 4 open shelves and dovetail-jointed drawers.',
    price: 1599, sale_price: null, stock: 6,
    material: 'Solid Oak', dimensions: '60 x 35 x 160 cm',
    eco: 5, category: 'office', featured: 0,
    image: '/images/nook-storage-cabinet.jpg',
  },
  // Lighting
  {
    name: 'Arch Pendant Lamp',
    slug: 'arch-pendant-lamp',
    description: 'The Arch pendant lamp makes a bold statement above a dining table or kitchen island. The shade is spun from recycled steel and finished in a warm matte sand colour. Adjustable cord length (30-120 cm) and compatible with E27 bulbs up to 60W. Sold without bulb.',
    short: 'Recycled steel pendant lamp, adjustable cord, matte sand finish. E27 bulb socket.',
    price: 899, sale_price: null, stock: 15,
    material: 'Recycled Steel', dimensions: 'Ø 40 x H 25 cm',
    eco: 3, category: 'lighting', featured: 1,
    image: '/images/petal-pendant-light.jpg',
  },
  {
    name: 'Glow Table Lamp',
    slug: 'glow-table-lamp',
    description: 'The Glow table lamp brings a warm, intimate light to any surface. The handmade ceramic base in a natural speckled glaze is paired with a linen shade for a timeless look. Uses a standard E14 bulb (included, 4W LED). The fabric cord and brass fittings add a vintage touch.',
    short: 'Handmade ceramic base table lamp with linen shade. 4W LED bulb included.',
    price: 449, sale_price: 379, stock: 20,
    material: 'Ceramic / Linen', dimensions: 'Ø 22 x H 38 cm',
    eco: 4, category: 'lighting', featured: 0,
    image: '/images/beam-wall-sconce.jpg',
  },
  {
    name: 'Halo Floor Lamp',
    slug: 'halo-floor-lamp',
    description: 'Light up your reading corner with the Halo floor lamp. A sustainable bamboo pole supports a wide linen shade at the perfect reading height. The weighted base keeps it stable, and the inline dimmer lets you set the mood. Compatible with E27 bulbs up to 40W.',
    short: 'Bamboo floor lamp with linen shade and inline dimmer switch.',
    price: 749, sale_price: null, stock: 9,
    material: 'Bamboo / Linen', dimensions: 'Ø 40 x H 155 cm',
    eco: 4, category: 'lighting', featured: 0,
    image: '/images/arch-floor-lamp.jpg',
  },
  // Storage
  {
    name: 'Tall Bookshelf',
    slug: 'tall-bookshelf',
    description: 'The Tall Bookshelf offers five generous shelves to display your books, plants and treasured objects. Made from solid pine with adjustable shelf heights so you can configure it to your needs. The anti-tip wall fixing kit is included for added safety.',
    short: 'Solid pine bookshelf with 5 adjustable shelves. Wall fixing kit included.',
    price: 1199, sale_price: null, stock: 7,
    material: 'Solid Pine', dimensions: '80 x 35 x 190 cm',
    eco: 5, category: 'storage', featured: 1,
    image: '/images/grid-bookcase-5-shelf.jpg',
  },
  {
    name: 'Woven Storage Basket',
    slug: 'woven-storage-basket',
    description: 'Handwoven by artisans from sustainably harvested natural seagrass, the Woven Storage Basket is as beautiful as it is practical. Use it for blankets, toys, laundry or firewood. Each basket is unique with slight variations in weave and colour. Available in two sizes.',
    short: 'Handwoven natural seagrass basket. Each piece is unique. Two sizes available.',
    price: 299, sale_price: null, stock: 25,
    material: 'Natural Seagrass', dimensions: 'Ø 40 x H 35 cm',
    eco: 5, category: 'storage', featured: 0,
    image: '/images/woven-storage-basket-set.jpg',
  },
  {
    name: 'Oak Storage Box',
    slug: 'oak-storage-box',
    description: 'A versatile storage box made from solid oak offcuts. Use it as a side table, a blanket box or extra seating. The hinged lid reveals a spacious interior lined with natural cotton. Finished with a food-safe hardwax oil so it can also be used to store children\'s toys.',
    short: 'Solid oak storage box with hinged lid, cotton lining. Also works as a side table.',
    price: 499, sale_price: 399, stock: 10,
    material: 'Solid Oak (offcuts) / Cotton', dimensions: '60 x 40 x 40 cm',
    eco: 4, category: 'storage', featured: 0,
    image: '/images/cube-shelving-unit-4x2.jpg',
  },
];

const insertProductStmt = db.prepare(`
  INSERT INTO products
    (name, slug, description, short_description, price, sale_price, stock, material, dimensions, eco_score, image, category_id, featured)
  VALUES
    (@name, @slug, @description, @short, @price, @sale_price, @stock, @material, @dimensions, @eco, @image, @category_id, @featured)
`);

const seedAll = db.transaction(() => {
  for (const p of products) {
    insertProductStmt.run({
      name: p.name,
      slug: p.slug,
      description: p.description,
      short: p.short,
      price: p.price,
      sale_price: p.sale_price || null,
      stock: p.stock,
      material: p.material,
      dimensions: p.dimensions,
      eco: p.eco,
      image: p.image,
      category_id: insertedCategories[p.category],
      featured: p.featured,
    });
  }
});

seedAll();
console.log(`Seeded ${products.length} products across ${categories.length} categories.`);

// Demo user
const hash = bcrypt.hashSync('demo1234', 10);
db.prepare(`
  INSERT OR IGNORE INTO users (first_name, last_name, email, password_hash)
  VALUES (?, ?, ?, ?)
`).run('Demo', 'User', 'demo@furnispace.ro', hash);
console.log('Demo user created: demo@furnispace.ro / demo1234');
