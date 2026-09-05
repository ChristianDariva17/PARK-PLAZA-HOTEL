import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { databaseUrlFromEnv, validateEnv } from '../config/environment.js';
import { inventoryItems, inventoryLedger, menuItemIngredients, menuItems, properties } from './schema/index.js';

export const INVENTORY_CATALOG = [
  // ─── Licores & Destilados (Unidad: Botella 750ml / Botella 1L) ───────────
  { name: 'Pisco Quebranta 42°', unit: 'Botella (750ml)', stock: '18', minimum: '4', cost: '38.00' },
  { name: 'Ron Blanco Carta Blanca', unit: 'Botella (750ml)', stock: '14', minimum: '3', cost: '32.00' },
  { name: 'Ron Rubio Añejo', unit: 'Botella (750ml)', stock: '12', minimum: '3', cost: '36.00' },
  { name: 'Ron Oscuro Especial', unit: 'Botella (750ml)', stock: '10', minimum: '2', cost: '42.00' },
  { name: 'Vodka Smirnoff Red', unit: 'Botella (750ml)', stock: '15', minimum: '3', cost: '35.00' },
  { name: 'Tequila Blanco Jimador', unit: 'Botella (750ml)', stock: '10', minimum: '2', cost: '48.00' },
  { name: 'Gin Gordon’s London Dry', unit: 'Botella (750ml)', stock: '8', minimum: '2', cost: '45.00' },
  { name: 'Baileys Irish Cream', unit: 'Botella (750ml)', stock: '10', minimum: '2', cost: '62.00' },
  { name: 'Licor Blue Curaçao', unit: 'Botella (750ml)', stock: '8', minimum: '2', cost: '30.00' },
  { name: 'Licor Triple Sec', unit: 'Botella (750ml)', stock: '8', minimum: '2', cost: '28.00' },
  { name: 'Licor de Menta Verde', unit: 'Botella (750ml)', stock: '6', minimum: '2', cost: '26.00' },
  { name: 'Licor de Fresa', unit: 'Botella (750ml)', stock: '6', minimum: '2', cost: '26.00' },
  { name: 'Cachaça Brasileña 51', unit: 'Botella (750ml)', stock: '8', minimum: '2', cost: '34.00' },

  // ─── Mixers, Jarabes, Frutas & Insumos de Bar ──────────────────────────────
  { name: 'Jarabe de Goma Artesanal', unit: 'Litro', stock: '25', minimum: '5', cost: '8.00' },
  { name: 'Jarabe de Granadina', unit: 'Botella (750ml)', stock: '12', minimum: '3', cost: '16.00' },
  { name: 'Crema de Coco López', unit: 'Lata (400ml)', stock: '30', minimum: '8', cost: '9.50' },
  { name: 'Algarrobina Piurana Pura', unit: 'Frasco (500g)', stock: '15', minimum: '4', cost: '14.00' },
  { name: 'Amargo de Angostura', unit: 'Botella (100ml)', stock: '10', minimum: '2', cost: '45.00' },
  { name: 'Ginger Ale Evervess', unit: 'Lata (355ml)', stock: '80', minimum: '24', cost: '2.20' },
  { name: 'Agua Tónica Backus', unit: 'Lata (355ml)', stock: '48', minimum: '12', cost: '2.30' },
  { name: 'Jugo de Naranja Natural', unit: 'Litro', stock: '30', minimum: '6', cost: '6.50' },
  { name: 'Jugo de Piña Golden', unit: 'Litro', stock: '35', minimum: '8', cost: '5.50' },
  { name: 'Pulpa de Maracuyá pura', unit: 'kg', stock: '20', minimum: '5', cost: '9.00' },
  { name: 'Pulpa de Fresa congelada', unit: 'kg', stock: '20', minimum: '5', cost: '11.00' },
  { name: 'Pulpa de Camu Camu amazónico', unit: 'kg', stock: '15', minimum: '4', cost: '14.00' },
  { name: 'Limón Sutil seleccionado', unit: 'kg', stock: '40', minimum: '10', cost: '4.50' },
  { name: 'Hierbabuena fresca', unit: 'Manojo', stock: '25', minimum: '5', cost: '2.00' },
  { name: 'Huevos de Granja frescos', unit: 'und', stock: '180', minimum: '40', cost: '0.60' },
  { name: 'Canela molida selecta', unit: 'Frasco (200g)', stock: '8', minimum: '2', cost: '7.00' },
  { name: 'Leche Evaporada Gloria Azul', unit: 'Lata (400g)', stock: '48', minimum: '12', cost: '4.20' },
  { name: 'Leche Condensada Nestlé', unit: 'Lata (390g)', stock: '36', minimum: '8', cost: '5.80' },

  // ─── Cervezas & Gaseosas Envasadas ─────────────────────────────────────────
  { name: 'Cerveza Pilsen Callao 355ml', unit: 'und', stock: '120', minimum: '24', cost: '4.50' },
  { name: 'Cerveza San Juan 355ml', unit: 'und', stock: '96', minimum: '24', cost: '4.00' },
  { name: 'Cerveza Cusqueña Trigo 355ml', unit: 'und', stock: '72', minimum: '18', cost: '5.00' },
  { name: 'Cerveza Corona Extra 330ml', unit: 'und', stock: '60', minimum: '18', cost: '5.80' },
  { name: 'Cerveza Heineken 330ml', unit: 'und', stock: '48', minimum: '12', cost: '6.00' },
  { name: 'Cerveza Stella Artois 330ml', unit: 'und', stock: '48', minimum: '12', cost: '6.50' },
  { name: 'Mike’s Hard Lemonade Manzana', unit: 'und', stock: '48', minimum: '12', cost: '5.00' },
  { name: 'Mike’s Hard Lemonade Maracuyá', unit: 'und', stock: '48', minimum: '12', cost: '5.00' },
  { name: 'Smirnoff Ice Black', unit: 'und', stock: '48', minimum: '12', cost: '5.50' },
  { name: 'Inca Kola 500ml', unit: 'und', stock: '100', minimum: '24', cost: '2.50' },
  { name: 'Coca Cola 500ml', unit: 'und', stock: '100', minimum: '24', cost: '2.50' },
  { name: 'Guaranita San Miguel 500ml', unit: 'und', stock: '60', minimum: '12', cost: '1.20' },
  { name: 'Agua Mineral San Luis con Gas 500ml', unit: 'und', stock: '80', minimum: '20', cost: '1.30' },
  { name: 'Agua Mineral San Luis sin Gas 500ml', unit: 'und', stock: '120', minimum: '24', cost: '1.30' },
  { name: 'Sporade Hidratante 500ml', unit: 'und', stock: '50', minimum: '12', cost: '1.80' },
  { name: 'Volt Energizante 300ml', unit: 'und', stock: '60', minimum: '12', cost: '1.50' },
  { name: 'Bio Aloe Vera 500ml', unit: 'und', stock: '40', minimum: '10', cost: '1.80' },

  // ─── Carnes, Aves, Pescados & Embutidos de Cocina ──────────────────────────
  { name: 'Lomo Fino de Res Premium', unit: 'kg', stock: '35', minimum: '8', cost: '42.00' },
  { name: 'Pechuga de Pollo fresca deshuesada', unit: 'kg', stock: '45', minimum: '10', cost: '16.50' },
  { name: 'Pollo trozado para Broaster', unit: 'kg', stock: '40', minimum: '10', cost: '13.00' },
  { name: 'Filete de Doncella Amazónica fresca', unit: 'kg', stock: '30', minimum: '6', cost: '28.00' },
  { name: 'Cecina Ahumada de Tarapoto', unit: 'kg', stock: '40', minimum: '8', cost: '38.00' },
  { name: 'Chorizo Amazónico Artesanal', unit: 'kg', stock: '30', minimum: '6', cost: '32.00' },
  { name: 'Panceta de Cerdo fresca', unit: 'kg', stock: '30', minimum: '6', cost: '22.00' },

  // ─── Verduras, Tubérculos & Plátanos ───────────────────────────────────────
  { name: 'Plátano Bellaco Verde', unit: 'und', stock: '250', minimum: '50', cost: '0.80' },
  { name: 'Plátano Bellaco Maduro', unit: 'und', stock: '150', minimum: '30', cost: '0.80' },
  { name: 'Papa Amarilla Tumbay', unit: 'kg', stock: '60', minimum: '15', cost: '3.80' },
  { name: 'Yuca Blanca fresca', unit: 'kg', stock: '50', minimum: '12', cost: '2.50' },
  { name: 'Cebolla Roja seleccionada', unit: 'kg', stock: '40', minimum: '10', cost: '2.80' },
  { name: 'Tomate Chonto maduro', unit: 'kg', stock: '35', minimum: '8', cost: '3.20' },
  { name: 'Cebolla China fresca', unit: 'kg', stock: '15', minimum: '3', cost: '4.00' },
  { name: 'Frijolito Chino fresco', unit: 'kg', stock: '12', minimum: '3', cost: '5.00' },
  { name: 'Lechuga Seda fresca', unit: 'kg', stock: '15', minimum: '4', cost: '3.50' },
  { name: 'Pepinillo fresco', unit: 'kg', stock: '15', minimum: '4', cost: '2.50' },
  { name: 'Ají Charapita amazónico', unit: 'kg', stock: '8', minimum: '2', cost: '15.00' },
  { name: 'Cocona fresca', unit: 'kg', stock: '25', minimum: '5', cost: '4.00' },
  { name: 'Choclo desgranado', unit: 'kg', stock: '20', minimum: '5', cost: '5.50' },
  { name: 'Camote Amarillo', unit: 'kg', stock: '30', minimum: '8', cost: '2.80' },

  // ─── Abarrotes, Granos, Salsas & Harinas ───────────────────────────────────
  { name: 'Arroz Superior Extra', unit: 'kg', stock: '120', minimum: '30', cost: '4.20' },
  { name: 'Fideo Tallarín Grueso Don Vittorio', unit: 'kg', stock: '50', minimum: '10', cost: '5.00' },
  { name: 'Masa Wantán para Tequeños', unit: 'und', stock: '300', minimum: '60', cost: '0.15' },
  { name: 'Queso Andino Regional', unit: 'kg', stock: '20', minimum: '5', cost: '26.00' },
  { name: 'Sillao Kikko especial', unit: 'Litro', stock: '25', minimum: '5', cost: '8.50' },
  { name: 'Aceite de Ajonjolí tostado', unit: 'Litro', stock: '10', minimum: '2', cost: '24.00' },
  { name: 'Aceite Vegetal Primor', unit: 'Litro', stock: '60', minimum: '15', cost: '7.80' },
  { name: 'Vinagre Tinto / Blanco', unit: 'Litro', stock: '20', minimum: '4', cost: '3.50' },
  { name: 'Manteca de Chancho tradicional', unit: 'kg', stock: '30', minimum: '6', cost: '12.00' },
  { name: 'Harina Broaster especial', unit: 'kg', stock: '30', minimum: '6', cost: '8.00' },

  // ─── Cafetería, Frappes & Infusiones ──────────────────────────────────────
  { name: 'Café en Grano Tostado Chanchamayo', unit: 'kg', stock: '20', minimum: '4', cost: '35.00' },
  { name: 'Leche Fresca Entera', unit: 'Litro', stock: '40', minimum: '10', cost: '4.50' },
  { name: 'Galletas Oreo Original', unit: 'und', stock: '80', minimum: '20', cost: '1.20' },
  { name: 'Chocolate Sublime Tradicional', unit: 'und', stock: '60', minimum: '15', cost: '2.00' },
  { name: 'Jarabe de Vainilla Francesa', unit: 'Litro', stock: '10', minimum: '2', cost: '28.00' },
  { name: 'Jarabe de Chicle Azul', unit: 'Litro', stock: '8', minimum: '2', cost: '25.00' },
  { name: 'Cacao en Polvo Puro', unit: 'kg', stock: '10', minimum: '2', cost: '22.00' },
  { name: 'Crema Chantilly Spray', unit: 'Lata (500ml)', stock: '15', minimum: '4', cost: '16.00' },
  { name: 'Té Filtrante Manzanilla Herbi', unit: 'Caja (100und)', stock: '8', minimum: '2', cost: '9.00' },
  { name: 'Té Filtrante Anís Herbi', unit: 'Caja (100und)', stock: '8', minimum: '2', cost: '9.00' },
  { name: 'Té Canela y Clavo Herbi', unit: 'Caja (100und)', stock: '8', minimum: '2', cost: '9.00' },
];

export async function seedInventoryAndRecipes(): Promise<void> {
  await import('dotenv/config');
  const env = validateEnv(process.env);

  const pool = new Pool({
    connectionString: databaseUrlFromEnv(env),
    ssl: env.DATABASE_SSL ? { rejectUnauthorized: false } : false,
  });

  const db = drizzle(pool);

  try {
    const [property] = await db.select().from(properties).limit(1);
    if (!property) throw new Error('No property found to seed inventory.');
    const propertyId = property.id;
    console.log(`[Seed] Seeding inventory and recipes for property: ${property.name} (${propertyId})`);

    // 1. Seed / Upsert Inventory Items
    const inventoryMap = new Map<string, string>(); // name -> id

    for (const inv of INVENTORY_CATALOG) {
      const [existing] = await db.select().from(inventoryItems)
        .where(and(eq(inventoryItems.propertyId, propertyId), eq(inventoryItems.name, inv.name)))
        .limit(1);

      if (existing) {
        inventoryMap.set(inv.name, existing.id);
      } else {
        const [inserted] = await db.insert(inventoryItems).values({
          propertyId,
          name: inv.name,
          unit: inv.unit,
          stock: inv.stock,
          minimum: inv.minimum,
          cost: inv.cost,
          status: 'active',
        }).returning({ id: inventoryItems.id });

        if (inserted) {
          inventoryMap.set(inv.name, inserted.id);
          // Initial ledger entry
          await db.insert(inventoryLedger).values({
            propertyId,
            inventoryItemId: inserted.id,
            type: 'Entrada',
            quantity: inv.stock,
            note: 'Inventario inicial de apertura',
            responsible: 'admin@parkplaza.example',
          });
        }
      }
    }
    console.log(`[Seed] Inventory catalog ensured: ${inventoryMap.size} items available.`);

    // Helper for recipe builder
    const getInv = (nameFragment: string) => {
      for (const [name, id] of inventoryMap.entries()) {
        if (name.toLowerCase().includes(nameFragment.toLowerCase())) return id;
      }
      return null;
    };

    // 2. Load all 83 Menu Items
    const allMenuItems = await db.select().from(menuItems).where(eq(menuItems.propertyId, propertyId));
    console.log(`[Seed] Linking recipes to ${allMenuItems.length} menu items...`);

    // Recipe mapping dictionary
    const RECIPE_RULES: Array<{
      match: (name: string, category: string) => boolean;
      ingredients: Array<{ fragment: string; quantity: number; unit: string; detail?: string }>;
    }> = [
      // ─── Pisco Sour ───
      {
        match: (n) => n.includes('Pisco Sour'),
        ingredients: [
          { fragment: 'Pisco Quebranta', quantity: 2.0, unit: 'oz', detail: 'Pisco Quebranta 42°' },
          { fragment: 'Limón Sutil', quantity: 1.0, unit: 'oz', detail: 'Zumo fresco colado' },
          { fragment: 'Jarabe de Goma', quantity: 1.0, unit: 'oz', detail: 'Jarabe artesanal' },
          { fragment: 'Huevos', quantity: 1.0, unit: 'und', detail: 'Clara de huevo fresca' },
          { fragment: 'Amargo de Angostura', quantity: 2.0, unit: 'dash', detail: 'Gotas aromáticas' },
        ],
      },
      // ─── Chilcano Clásico ───
      {
        match: (n) => n.includes('Chilcano'),
        ingredients: [
          { fragment: 'Pisco Quebranta', quantity: 2.0, unit: 'oz', detail: 'Pisco Quebranta' },
          { fragment: 'Limón Sutil', quantity: 0.5, unit: 'oz', detail: 'Gotas de zumo de limón' },
          { fragment: 'Ginger Ale', quantity: 4.0, unit: 'oz', detail: 'Mixer frío' },
          { fragment: 'Amargo de Angostura', quantity: 1.0, unit: 'dash', detail: 'Opcional al gusto' },
        ],
      },
      // ─── Algarrobina ───
      {
        match: (n) => n.includes('Algarrobina'),
        ingredients: [
          { fragment: 'Pisco Quebranta', quantity: 1.5, unit: 'oz', detail: 'Pisco Quebranta' },
          { fragment: 'Algarrobina', quantity: 1.0, unit: 'oz', detail: 'Algarrobina pura' },
          { fragment: 'Leche Evaporada', quantity: 1.0, unit: 'oz', detail: 'Leche evaporada' },
          { fragment: 'Jarabe de Goma', quantity: 0.5, unit: 'oz', detail: 'Jarabe dulce' },
          { fragment: 'Huevos', quantity: 1.0, unit: 'und', detail: 'Yema de huevo' },
          { fragment: 'Canela molida', quantity: 1.0, unit: 'dash', detail: 'Canela espolvoreada' },
        ],
      },
      // ─── Piña Colada ───
      {
        match: (n) => n.includes('Piña Colada'),
        ingredients: [
          { fragment: 'Ron Blanco', quantity: 2.0, unit: 'oz', detail: 'Ron blanco' },
          { fragment: 'Crema de Coco', quantity: 2.0, unit: 'oz', detail: 'Crema de coco espesa' },
          { fragment: 'Jugo de Piña', quantity: 3.0, unit: 'oz', detail: 'Jugo de piña fresca' },
        ],
      },
      // ─── Mojito Clásico ───
      {
        match: (n) => n.includes('Mojito'),
        ingredients: [
          { fragment: 'Ron Blanco', quantity: 2.0, unit: 'oz', detail: 'Ron blanco' },
          { fragment: 'Limón Sutil', quantity: 1.0, unit: 'oz', detail: 'Zumo de limón' },
          { fragment: 'Jarabe de Goma', quantity: 0.75, unit: 'oz', detail: 'Jarabe dulce' },
          { fragment: 'Hierbabuena', quantity: 1.0, unit: 'und', detail: '6 a 8 hojas maceradas' },
        ],
      },
      // ─── Cuba Libre ───
      {
        match: (n) => n.includes('Cuba Libre'),
        ingredients: [
          { fragment: 'Ron Rubio', quantity: 2.0, unit: 'oz', detail: 'Ron añejo' },
          { fragment: 'Coca Cola', quantity: 4.0, unit: 'oz', detail: 'Gaseosa negra' },
          { fragment: 'Limón Sutil', quantity: 0.5, unit: 'oz', detail: 'Rodaja y zumo' },
        ],
      },
      // ─── Margarita ───
      {
        match: (n) => n.includes('Margarita'),
        ingredients: [
          { fragment: 'Tequila Blanco', quantity: 1.5, unit: 'oz', detail: 'Tequila' },
          { fragment: 'Triple Sec', quantity: 0.75, unit: 'oz', detail: 'Licor de naranja' },
          { fragment: 'Limón Sutil', quantity: 1.0, unit: 'oz', detail: 'Zumo fresco' },
        ],
      },
      // ─── Blue Hawai & Laguna Azul ───
      {
        match: (n) => n.includes('Blue Hawai') || n.includes('Laguna Azul'),
        ingredients: [
          { fragment: 'Vodka', quantity: 1.5, unit: 'oz', detail: 'Vodka destilado' },
          { fragment: 'Blue Curaçao', quantity: 1.0, unit: 'oz', detail: 'Licor azul' },
          { fragment: 'Jugo de Piña', quantity: 3.0, unit: 'oz', detail: 'Jugo de piña' },
          { fragment: 'Crema de Coco', quantity: 1.0, unit: 'oz', detail: 'Crema' },
        ],
      },
      // ─── Machu Picchu ───
      {
        match: (n) => n.includes('Machu Picchu'),
        ingredients: [
          { fragment: 'Pisco Quebranta', quantity: 1.5, unit: 'oz', detail: 'Pisco' },
          { fragment: 'Jarabe de Granadina', quantity: 1.0, unit: 'oz', detail: 'Capa inferior' },
          { fragment: 'Jugo de Naranja', quantity: 3.0, unit: 'oz', detail: 'Capa media' },
          { fragment: 'Licor de Menta', quantity: 0.75, unit: 'oz', detail: 'Capa superior verde' },
        ],
      },
      // ─── Moscow Mule ───
      {
        match: (n) => n.includes('Moscow Mule'),
        ingredients: [
          { fragment: 'Vodka', quantity: 2.0, unit: 'oz', detail: 'Vodka' },
          { fragment: 'Ginger Ale', quantity: 4.0, unit: 'oz', detail: 'Mixer jengibre' },
          { fragment: 'Limón Sutil', quantity: 0.75, unit: 'oz', detail: 'Zumo fresco' },
        ],
      },
      // ─── Tequila Sunrise ───
      {
        match: (n) => n.includes('Tequila Sunrise'),
        ingredients: [
          { fragment: 'Tequila Blanco', quantity: 2.0, unit: 'oz', detail: 'Tequila' },
          { fragment: 'Jugo de Naranja', quantity: 4.0, unit: 'oz', detail: 'Jugo de naranja' },
          { fragment: 'Jarabe de Granadina', quantity: 0.75, unit: 'oz', detail: 'Granadina' },
        ],
      },
      // ─── Mai Tai & Pain Killer (Tikis) ───
      {
        match: (n, c) => c === 'Tikis' || n.includes('Mai Tai') || n.includes('Pain Killer'),
        ingredients: [
          { fragment: 'Ron Rubio', quantity: 1.5, unit: 'oz', detail: 'Ron añejo' },
          { fragment: 'Ron Oscuro', quantity: 0.75, unit: 'oz', detail: 'Ron oscuro' },
          { fragment: 'Triple Sec', quantity: 0.5, unit: 'oz', detail: 'Triple sec' },
          { fragment: 'Jugo de Piña', quantity: 3.0, unit: 'oz', detail: 'Jugo de piña' },
        ],
      },
      // ─── Bey Liz Colado ───
      {
        match: (n) => n.includes('Bey Liz') || n.includes('Baileys'),
        ingredients: [
          { fragment: 'Baileys', quantity: 2.0, unit: 'oz', detail: 'Crema irlandesa' },
          { fragment: 'Crema de Coco', quantity: 1.5, unit: 'oz', detail: 'Crema de coco' },
          { fragment: 'Leche Evaporada', quantity: 1.0, unit: 'oz', detail: 'Leche' },
        ],
      },
      // ─── Caipirinha ───
      {
        match: (n) => n.includes('Caipirinha'),
        ingredients: [
          { fragment: 'Cachaça', quantity: 2.0, unit: 'oz', detail: 'Cachaça brasileña' },
          { fragment: 'Limón Sutil', quantity: 1.5, unit: 'oz', detail: 'Gajos macerados' },
          { fragment: 'Jarabe de Goma', quantity: 0.75, unit: 'oz', detail: 'Jarabe dulce' },
        ],
      },
      // ─── Fresa Colada ───
      {
        match: (n) => n.includes('Fresa Colada'),
        ingredients: [
          { fragment: 'Ron Blanco', quantity: 2.0, unit: 'oz', detail: 'Ron' },
          { fragment: 'Pulpa de Fresa', quantity: 2.0, unit: 'oz', detail: 'Fresa natural' },
          { fragment: 'Crema de Coco', quantity: 1.5, unit: 'oz', detail: 'Crema de coco' },
        ],
      },
      // ─── Pantera Rosa ───
      {
        match: (n) => n.includes('Pantera Rosa'),
        ingredients: [
          { fragment: 'Vodka', quantity: 1.5, unit: 'oz', detail: 'Vodka' },
          { fragment: 'Licor de Fresa', quantity: 1.0, unit: 'oz', detail: 'Licor de fresa' },
          { fragment: 'Leche Condensada', quantity: 1.0, unit: 'oz', detail: 'Leche condensada' },
          { fragment: 'Jugo de Piña', quantity: 2.0, unit: 'oz', detail: 'Jugo de piña' },
        ],
      },

      // ─── Lomo Saltado de Res ───
      {
        match: (n) => n.includes('Lomo Saltado de Res'),
        ingredients: [
          { fragment: 'Lomo Fino', quantity: 0.20, unit: 'kg', detail: 'Corte en tiras 200g' },
          { fragment: 'Cebolla Roja', quantity: 0.10, unit: 'kg', detail: 'Corte gajos gruesos' },
          { fragment: 'Tomate', quantity: 0.08, unit: 'kg', detail: 'Corte gajos sin pepa' },
          { fragment: 'Papa Amarilla', quantity: 0.15, unit: 'kg', detail: 'Papas fritas crocantes' },
          { fragment: 'Arroz Superior', quantity: 0.18, unit: 'kg', detail: 'Porción arroz graneado' },
          { fragment: 'Sillao', quantity: 0.03, unit: 'Litro', detail: 'Toque de sillao y vinagre' },
        ],
      },
      // ─── Lomo Saltado de Pollo ───
      {
        match: (n) => n.includes('Lomo Saltado de Pollo'),
        ingredients: [
          { fragment: 'Pechuga de Pollo', quantity: 0.20, unit: 'kg', detail: 'Tiras de pechuga 200g' },
          { fragment: 'Cebolla Roja', quantity: 0.10, unit: 'kg', detail: 'Corte gajos' },
          { fragment: 'Tomate', quantity: 0.08, unit: 'kg', detail: 'Corte gajos' },
          { fragment: 'Papa Amarilla', quantity: 0.15, unit: 'kg', detail: 'Papas fritas' },
          { fragment: 'Arroz Superior', quantity: 0.18, unit: 'kg', detail: 'Porción arroz' },
        ],
      },
      // ─── Lomo Saltado Amazónico ───
      {
        match: (n) => n.includes('Lomo Saltado Amazónico'),
        ingredients: [
          { fragment: 'Cecina Ahumada', quantity: 0.18, unit: 'kg', detail: 'Cecina de Tarapoto en tiras' },
          { fragment: 'Plátano Bellaco Verde', quantity: 2.0, unit: 'und', detail: 'Patacones crocantes' },
          { fragment: 'Cebolla Roja', quantity: 0.10, unit: 'kg', detail: 'Corte gajos' },
          { fragment: 'Tomate', quantity: 0.08, unit: 'kg', detail: 'Tomate fresco' },
          { fragment: 'Ají Charapita', quantity: 0.01, unit: 'kg', detail: 'Toque amazónico' },
        ],
      },
      // ─── Chaufa de Res ───
      {
        match: (n) => n.includes('Chaufa de Res'),
        ingredients: [
          { fragment: 'Lomo Fino', quantity: 0.18, unit: 'kg', detail: 'Carne picada al wok' },
          { fragment: 'Arroz Superior', quantity: 0.25, unit: 'kg', detail: 'Arroz al wok' },
          { fragment: 'Huevos', quantity: 2.0, unit: 'und', detail: 'Tortilla en cubos' },
          { fragment: 'Cebolla China', quantity: 0.04, unit: 'kg', detail: 'Picada fina' },
          { fragment: 'Sillao', quantity: 0.03, unit: 'Litro', detail: 'Sillao oscuro' },
          { fragment: 'Aceite de Ajonjolí', quantity: 0.01, unit: 'Litro', detail: 'Aroma tostado' },
        ],
      },
      // ─── Chaufa de Pollo ───
      {
        match: (n) => n.includes('Chaufa de Pollo'),
        ingredients: [
          { fragment: 'Pechuga de Pollo', quantity: 0.18, unit: 'kg', detail: 'Pollo en cubos' },
          { fragment: 'Arroz Superior', quantity: 0.25, unit: 'kg', detail: 'Arroz al wok' },
          { fragment: 'Huevos', quantity: 2.0, unit: 'und', detail: 'Tortilla en cubos' },
          { fragment: 'Cebolla China', quantity: 0.04, unit: 'kg', detail: 'Picada fina' },
          { fragment: 'Sillao', quantity: 0.03, unit: 'Litro', detail: 'Sillao' },
        ],
      },
      // ─── Chaufa Amazónica ───
      {
        match: (n) => n.includes('Chaufa Amazónica'),
        ingredients: [
          { fragment: 'Cecina Ahumada', quantity: 0.10, unit: 'kg', detail: 'Cecina picada' },
          { fragment: 'Chorizo Amazónico', quantity: 0.08, unit: 'kg', detail: 'Chorizo regional' },
          { fragment: 'Arroz Superior', quantity: 0.25, unit: 'kg', detail: 'Arroz al wok' },
          { fragment: 'Huevos', quantity: 2.0, unit: 'und', detail: 'Tortilla' },
          { fragment: 'Plátano Bellaco Maduro', quantity: 1.0, unit: 'und', detail: 'Maduritos fritos' },
          { fragment: 'Cebolla China', quantity: 0.04, unit: 'kg', detail: 'Picada' },
        ],
      },
      // ─── Aeropuerto ───
      {
        match: (n) => n.includes('Aeropuerto'),
        ingredients: [
          { fragment: 'Pechuga de Pollo', quantity: 0.15, unit: 'kg', detail: 'Pollo salteado' },
          { fragment: 'Arroz Superior', quantity: 0.20, unit: 'kg', detail: 'Arroz chaufa' },
          { fragment: 'Fideo Tallarín', quantity: 0.10, unit: 'kg', detail: 'Fideo frito crocante' },
          { fragment: 'Frijolito Chino', quantity: 0.05, unit: 'kg', detail: 'Salteado al dente' },
          { fragment: 'Huevos', quantity: 2.0, unit: 'und', detail: 'Huevo montado' },
        ],
      },
      // ─── Tacacho con Cecina ───
      {
        match: (n) => n.includes('Tacacho con Cecina'),
        ingredients: [
          { fragment: 'Plátano Bellaco Verde', quantity: 3.0, unit: 'und', detail: 'Plátanos asados y majados' },
          { fragment: 'Cecina Ahumada', quantity: 0.20, unit: 'kg', detail: 'Cecina frita dorada' },
          { fragment: 'Manteca de Chancho', quantity: 0.05, unit: 'kg', detail: 'Manteca tradicional y chicharrón' },
          { fragment: 'Cocona', quantity: 0.05, unit: 'kg', detail: 'Ají de cocona' },
        ],
      },
      // ─── Tacacho con Chorizo ───
      {
        match: (n) => n.includes('Tacacho con Chorizo'),
        ingredients: [
          { fragment: 'Plátano Bellaco Verde', quantity: 3.0, unit: 'und', detail: 'Plátanos majados' },
          { fragment: 'Chorizo Amazónico', quantity: 0.20, unit: 'kg', detail: 'Chorizo regional frito' },
          { fragment: 'Manteca de Chancho', quantity: 0.05, unit: 'kg', detail: 'Manteca para tacacho' },
          { fragment: 'Cocona', quantity: 0.05, unit: 'kg', detail: 'Ají de cocona' },
        ],
      },
      // ─── Ceviche de Doncella ───
      {
        match: (n) => n.includes('Ceviche'),
        ingredients: [
          { fragment: 'Filete de Doncella', quantity: 0.25, unit: 'kg', detail: 'Doncella fresca en cubos' },
          { fragment: 'Limón Sutil', quantity: 0.15, unit: 'kg', detail: 'Zumo recién exprimido' },
          { fragment: 'Cebolla Roja', quantity: 0.08, unit: 'kg', detail: 'Corte pluma lavado' },
          { fragment: 'Ají Charapita', quantity: 0.01, unit: 'kg', detail: 'Picadito' },
          { fragment: 'Choclo desgranado', quantity: 0.08, unit: 'kg', detail: 'Choclo tierno' },
          { fragment: 'Camote', quantity: 0.10, unit: 'kg', detail: 'Camote glaseado' },
        ],
      },
      // ─── Chicharrón de Doncella ───
      {
        match: (n) => n.includes('Chicharrón de Doncella'),
        ingredients: [
          { fragment: 'Filete de Doncella', quantity: 0.25, unit: 'kg', detail: 'Trozos crocantes de doncella' },
          { fragment: 'Yuca Blanca', quantity: 0.15, unit: 'kg', detail: 'Yuca frita' },
          { fragment: 'Cebolla Roja', quantity: 0.05, unit: 'kg', detail: 'Salsa criolla' },
        ],
      },
      // ─── Chicharrón de Chancho ───
      {
        match: (n) => n.includes('Chicharrón de Chancho'),
        ingredients: [
          { fragment: 'Panceta de Cerdo', quantity: 0.25, unit: 'kg', detail: 'Panceta crocante' },
          { fragment: 'Yuca Blanca', quantity: 0.15, unit: 'kg', detail: 'Yuca sancochada o frita' },
          { fragment: 'Cebolla Roja', quantity: 0.05, unit: 'kg', detail: 'Salsa criolla con hierbabuena' },
        ],
      },
      // ─── Chicharrón de Pollo ───
      {
        match: (n) => n.includes('Chicharrón de Pollo'),
        ingredients: [
          { fragment: 'Pechuga de Pollo', quantity: 0.25, unit: 'kg', detail: 'Tiras crocantes' },
          { fragment: 'Papa Amarilla', quantity: 0.15, unit: 'kg', detail: 'Papas fritas' },
          { fragment: 'Lechuga', quantity: 0.05, unit: 'kg', detail: 'Ensalada' },
        ],
      },
      // ─── Broaster ───
      {
        match: (n) => n.includes('Broaster'),
        ingredients: [
          { fragment: 'Pollo trozado', quantity: 0.25, unit: 'kg', detail: 'Pieza seleccionada' },
          { fragment: 'Harina Broaster', quantity: 0.06, unit: 'kg', detail: 'Rebozado crocante' },
          { fragment: 'Papa Amarilla', quantity: 0.15, unit: 'kg', detail: 'Papas fritas' },
        ],
      },
      // ─── Tequeños Amazónicos ───
      {
        match: (n) => n.includes('Tequeños Amazónicos'),
        ingredients: [
          { fragment: 'Masa Wantán', quantity: 10.0, unit: 'und', detail: '10 unidades' },
          { fragment: 'Cecina Ahumada', quantity: 0.08, unit: 'kg', detail: 'Relleno de cecina' },
          { fragment: 'Queso Andino', quantity: 0.08, unit: 'kg', detail: 'Queso derretido' },
        ],
      },
      // ─── Tequeños Clásicos / Rellenos ───
      {
        match: (n) => n.includes('Tequeños'),
        ingredients: [
          { fragment: 'Masa Wantán', quantity: 10.0, unit: 'und', detail: '10 unidades' },
          { fragment: 'Queso Andino', quantity: 0.12, unit: 'kg', detail: 'Queso andino' },
        ],
      },
      // ─── Patacones / Yuca / Maduro ───
      {
        match: (n) => n.includes('Patacones'),
        ingredients: [
          { fragment: 'Plátano Bellaco Verde', quantity: 2.0, unit: 'und', detail: 'Patacones fritos' },
        ],
      },
      {
        match: (n) => n.includes('Yuca Frita'),
        ingredients: [
          { fragment: 'Yuca Blanca', quantity: 0.25, unit: 'kg', detail: 'Yuca dorada' },
        ],
      },
      {
        match: (n) => n.includes('Maduro'),
        ingredients: [
          { fragment: 'Plátano Bellaco Maduro', quantity: 2.0, unit: 'und', detail: 'Maduritos fritos' },
        ],
      },
      // ─── Café & Frappes ───
      {
        match: (n, c) => c === 'Café' || n.includes('Café') || n.includes('Capuchino') || n.includes('Moccacino'),
        ingredients: [
          { fragment: 'Café en Grano', quantity: 0.02, unit: 'kg', detail: 'Molienda espresso 20g' },
          { fragment: 'Leche Fresca', quantity: 0.15, unit: 'Litro', detail: 'Leche vaporizada' },
        ],
      },
      {
        match: (n, c) => c === 'Frappes' || n.includes('Frappe'),
        ingredients: [
          { fragment: 'Leche Fresca', quantity: 0.15, unit: 'Litro', detail: 'Base de leche fría' },
          { fragment: 'Crema Chantilly', quantity: 0.05, unit: 'Lata (500ml)', detail: 'Topping chantilly' },
          { fragment: 'Galletas Oreo', quantity: 2.0, unit: 'und', detail: 'Galleta triturada' },
        ],
      },
      // ─── Refrescos ───
      {
        match: (n) => n.includes('Camu Camu'),
        ingredients: [
          { fragment: 'Pulpa de Camu Camu', quantity: 3.0, unit: 'oz', detail: 'Pulpa natural' },
          { fragment: 'Jarabe de Goma', quantity: 1.5, unit: 'oz', detail: 'Jarabe' },
        ],
      },
      {
        match: (n) => n.includes('Maracuyá'),
        ingredients: [
          { fragment: 'Pulpa de Maracuyá', quantity: 3.0, unit: 'oz', detail: 'Pulpa natural' },
          { fragment: 'Jarabe de Goma', quantity: 1.5, unit: 'oz', detail: 'Jarabe' },
        ],
      },
      {
        match: (n) => n.includes('Limonada'),
        ingredients: [
          { fragment: 'Limón Sutil', quantity: 2.5, unit: 'oz', detail: 'Zumo recién exprimido' },
          { fragment: 'Jarabe de Goma', quantity: 1.5, unit: 'oz', detail: 'Jarabe dulce' },
        ],
      },
      // ─── Cervezas envasadas ───
      {
        match: (n, c) => c === 'Cerveza' || n.includes('Pilsen') || n.includes('San Juan') || n.includes('Trigo') || n.includes('Mike') || n.includes('Smirnoff'),
        ingredients: [
          { fragment: 'Cerveza Pilsen Callao', quantity: 1.0, unit: 'und', detail: 'Botella/Lata fría' },
        ],
      },
      // ─── Gaseosas & Aguas ───
      {
        match: (n, c) => c === 'Gaseosas' || n.includes('Inca Kola') || n.includes('Coca Cola') || n.includes('Agua Mineral') || n.includes('Sporade') || n.includes('Volt') || n.includes('Bio') || n.includes('Guaranita'),
        ingredients: [
          { fragment: 'Inca Kola 500ml', quantity: 1.0, unit: 'und', detail: 'Botella sellada' },
        ],
      },
      // ─── Infusiones ───
      {
        match: (n, c) => c === 'Infusiones' || n.includes('Té'),
        ingredients: [
          { fragment: 'Té Filtrante Manzanilla', quantity: 1.0, unit: 'und', detail: 'Sobre filtrante' },
        ],
      },
    ];

    let linkedCount = 0;

    for (const item of allMenuItems) {
      // Find matching rule
      const rule = RECIPE_RULES.find((r) => r.match(item.name, item.category));

      if (rule && rule.ingredients.length > 0) {
        // Clear previous ingredients for clean sync
        await db.delete(menuItemIngredients).where(eq(menuItemIngredients.menuItemId, item.id));

        const ingredientsToInsert = [];
        for (const ingRule of rule.ingredients) {
          const invId = getInv(ingRule.fragment);
          if (invId) {
            ingredientsToInsert.push({
              propertyId,
              menuItemId: item.id,
              inventoryItemId: invId,
              quantity: String(ingRule.quantity),
              unit: ingRule.unit,
              detail: ingRule.detail ?? null,
            });
          }
        }

        if (ingredientsToInsert.length > 0) {
          await db.insert(menuItemIngredients).values(ingredientsToInsert);
          linkedCount++;
        }
      }
    }

    console.log(`[Seed] Successfully linked recipes for ${linkedCount} / ${allMenuItems.length} menu items!`);
  } finally {
    await pool.end();
  }
}

if (process.argv[1]?.includes('seed-inventory-recipes')) {
  seedInventoryAndRecipes().then(() => {
    console.log('[Seed] Seeding completed successfully.');
    process.exit(0);
  }).catch((err) => {
    console.error('[Seed] Error during seeding:', err);
    process.exit(1);
  });
}
