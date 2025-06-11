// netlify/functions/api.js

const serverless = require('serverless-http');
const dotenv = require('dotenv');
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');

// Cargar variables de entorno (Netlify las proveerá en producción)
dotenv.config();

const app = express();

// Middlewares
app.use(cors({ origin: '*' })); // Permitir cualquier origen para las funciones de Netlify
app.use(express.json());

// Crear cliente de Supabase
// En Netlify, estas variables vendrán del panel de control, no de un archivo .env
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// --- COPIA Y PEGA TODAS TUS RUTAS DE `server/index.js` AQUÍ ---
// Por ejemplo:

// Ruta para crear usuario
app.post('/api/users', async (req, res) => {
  const { email, password, username, role } = req.body;
  try {
    const { data, error } = await supabase.auth.admin.createUser({
      email, password, username, email_confirm: false,
    });
    if (error) throw error;
    
    const { error: insertError } = await supabase.from('users').insert({
      id: data.user.id, email, username, role
    });
    if (insertError) throw insertError;

    res.status(201).json({ message: 'Usuario creado', user: data.user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Ruta para obtener todos los usuarios
app.get('/api/users', async (req, res) => {
  try {
    const { data, error } = await supabase.from('users').select('*');
    if (error) throw error;
    res.status(200).json(data);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ... (y así sucesivamente con TODAS las demás rutas: variations, products, etc.)
// ...

// Ruta "catch-all" para manejar rutas no encontradas
app.use((req, res, next) => {
  return res.status(404).json({ error: "Ruta no encontrada." });
});


// Exportar el manejador para Netlify
module.exports.handler = serverless(app);