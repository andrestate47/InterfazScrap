const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { OpenAI } = require('openai');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'crm.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error("Error opening SQLite db:", err);
    else {
        db.serialize(() => {
            db.run(`CREATE TABLE IF NOT EXISTS leads (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nombre_negocio TEXT,
                categoria TEXT,
                telefono TEXT,
                direccion TEXT,
                estado TEXT,
                estado_web TEXT,
                motivo_estado_web TEXT,
                whatsapp_web TEXT,
                tiene_instagram TEXT,
                cantidad_fotos TEXT,
                actividad_reciente TEXT,
                rating TEXT,
                reviews TEXT,
                score TEXT,
                prioridad TEXT,
                analisis_ia TEXT,
                mensaje TEXT,
                sitio_web TEXT,
                observation TEXT,
                estado_comercial TEXT DEFAULT 'nuevo',
                notas TEXT,
                fecha_importacion TEXT,
                fecha_ultimo_contacto TEXT,
                id_lead TEXT,
                fecha_proximo_seguimiento TEXT,
                responsable TEXT,
                respuesta_cliente TEXT,
                fecha_cierre TEXT,
                valor_estimado TEXT,
                origen_scraping TEXT,
                selected BOOLEAN DEFAULT 1
            )`);
        });
    }
});

const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve(this);
    });
});

const dbAll = (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
    });
});
const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static frontend files (HTML, CSS, JS) from the current folder
app.use(express.static(__dirname));

// Initialize Supabase (Backend only - uses Service Role Key)
const supabase = createClient(
  process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder'
);

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'placeholder',
  timeout: 180000, // 3 minutos de timeout explícito
  maxRetries: 2 // Reintentar automáticamente 2 veces en caso de errores de red
});

// Endpoint 1: Process scrap using AI
app.post('/api/process-scrap', async (req, res) => {
    try {
        const { rawText, source } = req.body;
        
        if (!rawText) {
            return res.status(400).json({ error: 'Falta el texto a procesar' });
        }

        const prompt = `
Extrae leads desde este texto desordenado.
Devuelve únicamente un objeto JSON con una propiedad llamada "leads" que contenga un array de objetos. 
No incluyas markdown.

Campos requeridos para cada objeto en el array "leads":

- nombre_negocio: string (el nombre del local o restaurante)
- categoria: string (categoría principal del negocio)
- telefono: string (teléfono, ej. +51999999999, o vacío)
- direccion: string (dirección física del lugar)
- estado: string (ej. "OPERATIONAL", "CLOSED", etc., deduce si no dice)
- estado_web: string (ej. "Activo", "Inexistente", "Caído")
- motivo_estado_web: string (explica brevemente por qué tiene ese estado_web)
- whatsapp_web: string ("Sí" o "No", deduce si el teléfono puede tener whatsapp)
- tiene_instagram: string (Extrae la URL completa de la red social si aparece en el texto, o el @usuario. Si no tiene, pon "No")
- cantidad_fotos: string (número de fotos si aparece en el texto)
- actividad_reciente: string (deduce si está activo basado en reviews o data)
- rating: string (puntuación de estrellas, ej. "4.7")
- reviews: string (cantidad total de reseñas)
- score: string (tu puntuación interna o totalScore si existe)
- prioridad: string ("Alta", "Media", o "Baja". REGLAS CLAVE: Si NO tienen sitio web, es prioridad ALTA (podemos venderles web). Si tienen pocas reseñas (menos de 50), es prioridad ALTA (podemos venderles reputación). Si tienen sitio web perfecto y cientos de reseñas, es BAJA. Asigna según esta lógica comercial).
- analisis_ia: string (breve resumen de 1 oración sobre este lugar)
- mensaje: string (propuesta corta de 1 oración para escribirles por chat)
- sitio_web: string (URL de su web si la tiene)
- observation: string (observaciones adicionales)

REGLA CRÍTICA: Debes procesar y extraer TODOS los leads presentes en el texto, sin omitir absolutamente ninguno. Si el texto contiene 50 leads, tu array JSON debe tener exactamente 50 objetos. NO te detengas, NO resumas, extrae TODO.

Texto a analizar:
${rawText}
`;

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.1,
            response_format: { type: "json_object" } 
        });

        const content = response.choices[0].message.content;
        let parsedJSON = JSON.parse(content);
        
        // Extract array
        let leads = parsedJSON.leads || [];

        // Add 'selected' property required by our frontend UI
        leads = leads.map(l => ({
            ...l,
            selected: true
        }));

        res.json(leads);

    } catch (error) {
        console.error("Error processing scrap:", error);
        
        if (error.status === 408 || error.code === 'ETIMEDOUT' || error.name === 'APIConnectionTimeoutError') {
            return res.status(504).json({ error: 'La Inteligencia Artificial tardó demasiado en responder (Timeout). Por favor, intenta procesar menos texto a la vez.' });
        }
        
        res.status(500).json({ error: 'Error interno procesando los datos con IA. Revisa la consola.' });
    }
});

// Endpoint 2: Proxy para leer datos de la DB Local (CRM GET)
app.post('/api/sheets/get', async (req, res) => {
    try {
        const rows = await dbAll("SELECT * FROM leads ORDER BY id DESC");
        // Asegurar que devuelva un objeto con { data: [...] } tal como esperaba el frontend
        res.json({ data: rows });
    } catch (error) {
        console.error("Error fetching leads from DB:", error);
        res.status(500).json({ error: 'Error al leer la base de datos' });
    }
});

// Endpoint 3: Proxy para guardar/actualizar datos en DB Local (CRM POST)
app.post('/api/sheets/post', async (req, res) => {
    try {
        const { payload } = req.body;
        if (!payload || !payload.leads) return res.status(400).json({ error: 'Faltan parámetros' });

        const newLeads = payload.leads;
        let insertedCount = 0;
        let duplicatesCount = 0;

        // Obtener leads existentes para comparar
        const existingLeads = await dbAll("SELECT telefono, nombre_negocio, direccion FROM leads");

        for (const lead of newLeads) {
            let isDuplicate = false;

            if (lead.telefono && lead.telefono.trim() !== '') {
                isDuplicate = existingLeads.some(existing => 
                    existing.telefono && existing.telefono.toString().trim() === lead.telefono.trim()
                );
            } else if (lead.nombre_negocio && lead.direccion) {
                isDuplicate = existingLeads.some(existing => 
                    existing.nombre_negocio && existing.direccion &&
                    existing.nombre_negocio.trim().toLowerCase() === lead.nombre_negocio.trim().toLowerCase() &&
                    existing.direccion.trim().toLowerCase() === lead.direccion.trim().toLowerCase()
                );
            }

            if (isDuplicate) {
                duplicatesCount++;
            } else {
                // Insert into DB
                const cols = Object.keys(lead).filter(k => k !== 'id'); // Excluir id si viene
                const placeholders = cols.map(() => '?').join(',');
                const values = cols.map(k => lead[k] !== undefined ? lead[k] : null);

                await dbRun(`INSERT INTO leads (${cols.join(',')}) VALUES (${placeholders})`, values);
                insertedCount++;
            }
        }

        res.json({ 
            success: true, 
            stats: {
                nuevos: insertedCount,
                duplicadosEvitados: duplicatesCount
            }
        });
    } catch (error) {
        console.error("Error saving to DB:", error);
        res.status(500).json({ error: 'Error al guardar en Base de Datos' });
    }
});

// Endpoint 3.5: Proxy para actualizar un lead en DB Local
app.post('/api/sheets/update', async (req, res) => {
    try {
        const { payload } = req.body;
        if (!payload || !payload.lead) return res.status(400).json({ error: 'Faltan parámetros' });

        const lead = payload.lead;
        
        // Determinar cómo buscar el lead (por id, telefono, o nombre+direccion)
        let query = "";
        let params = [];
        
        if (lead.id) {
            query = "UPDATE leads SET estado_comercial = ?, notas = ?, fecha_ultimo_contacto = ? WHERE id = ?";
            params = [lead.estado_comercial, lead.notas, lead.fecha_ultimo_contacto, lead.id];
        } else if (lead.telefono) {
            query = "UPDATE leads SET estado_comercial = ?, notas = ?, fecha_ultimo_contacto = ? WHERE telefono = ?";
            params = [lead.estado_comercial, lead.notas, lead.fecha_ultimo_contacto, lead.telefono];
        } else {
            query = "UPDATE leads SET estado_comercial = ?, notas = ?, fecha_ultimo_contacto = ? WHERE nombre_negocio = ? AND direccion = ?";
            params = [lead.estado_comercial, lead.notas, lead.fecha_ultimo_contacto, lead.nombre_negocio, lead.direccion];
        }

        const result = await dbRun(query, params);

        res.json({ success: true, message: 'Actualizado correctamente en DB' });
    } catch (error) {
        console.error("Error updating DB:", error);
        res.status(500).json({ error: 'Error al actualizar base de datos' });
    }
});

// Endpoint 4: Generador de Mensaje IA (CRM Fase 5)
app.post('/api/generate-message', async (req, res) => {
    try {
        const { negocio, categoria, rating, reviews, analisis, instagram, web } = req.body;

        const prompt = `
Eres Andrés, un programador y vendedor. Tu objetivo es enviar un primer mensaje en frío (cold outreach) por WhatsApp al dueño del negocio "${negocio}". 

REGLA DE ORO: EL MENSAJE DEBE SER CORTO Y DIRECTO AL GRANO.

Contexto del negocio:
- Categoría: ${categoria}
- Rating: ${rating} estrellas (${reviews} reseñas)
- Web: ${web}
- Detalles: ${analisis}

Instrucciones Estrictas:
1. DEBES empezar exactamente con esta frase (o una muy, muy parecida): "Hola, soy Andrés, programador, ayudo a empresas a elevar sus ventas. Vi ${negocio}..."
2. PROHIBIDO decir dónde lo viste (NO digas "en Google", "en Maps", "en internet").
3. Basado en el rating (${rating}):
   - Si tienen buen rating (4.0 o más): Di que tienen muy buenas reseñas pero siempre se puede captar más gente.
   - Si tienen mal rating (menos de 4.0) o pocas reseñas: Menciónalo de forma disimulada y sin ofender (Ej: "noté que tienen una oportunidad genial para mejorar su presencia online y atraer más gente").
4. Termina inmediatamente con una pregunta corta. Ej: "¿Les interesaría que les pase una idea rápida por acá de cómo conseguir más clientes locales?" o "¿Tienen un minuto para ver cómo atraer más gente de la zona?".
5. PROHIBIDO MENCIONAR AUDIOS, LLAMADAS O REUNIONES. Todo es por chat.
6. NO incluyas saludos finales ni despedidas. El mensaje termina en el signo de interrogación.

Devuelve SOLO el mensaje generado, nada más.
`;

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7
        });

        const mensaje = response.choices[0].message.content.trim();
        res.json({ mensaje });

    } catch (error) {
        console.error("Error generating message:", error);
        res.status(500).json({ error: 'Error al generar el mensaje con IA' });
    }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`🚀 Backend server running on http://localhost:${PORT}`);
});
