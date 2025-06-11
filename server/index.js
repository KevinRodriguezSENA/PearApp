const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors({ origin: 'http://localhost:3000' }));

console.log('URL:', process.env.SUPABASE_URL);
console.log('KEY:', process.env.SUPABASE_SERVICE_KEY);

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// --- RUTAS DE USUARIOS ---
app.post('/api/users', async (req, res) => {
  const { email, password, username, role } = req.body;
  try {
    const { data, error } = await supabase.auth.admin.createUser({
      email, password, user_metadata: { username, role }
    });
    if (error) throw error;

    const { error: insertError } = await supabase.from('users').insert({
      id: data.user.id, email, username, role,
    });
    if (insertError) throw insertError;

    res.status(201).json({ message: 'Usuario creado', user: data.user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { error: authError } = await supabase.auth.admin.deleteUser(id);
    if (authError) throw authError;

    const { error } = await supabase.from('users').delete().eq('id', id);
    if (error) throw error;

    res.status(200).json({ message: 'Usuario eliminado' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/users', async (req, res) => {
  try {
    const { data, error } = await supabase.from('users').select('*');
    if (error) throw error;
    res.status(200).json(data);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --- RUTAS PARA PRODUCTOS Y VARIACIONES ---
app.get('/api/products-variations', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('id, reference, image_url, price_r, price_w, variations(id, color, size, stock, barcode_code, created_at)');
    if (error) throw error;
    res.status(200).json(data);
  } catch (err) {
    res.status(400).json({ error: `Error al obtener inventario: ${err.message}` });
  }
});

app.post('/api/products', async (req, res) => {
  const { reference, image_url, price_r, price_w, created_by } = req.body;
  try {
    const { data, error } = await supabase
      .from('products')
      .insert([{ reference, image_url, price_r, price_w, created_by }])
      .select()
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(400).json({ error: `Error al crear producto: ${err.message}` });
  }
});

app.post('/api/variations', async (req, res) => {
  const variations = req.body;
  try {
    const { data, error } = await supabase.from('variation').insert(variations).select();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(400).json({ error: `Error al crear variaciones: ${err.message}` });
  }
});

app.put('/api/variations/:id', async (req, res) => {
  const { id } = req.params;
  const { stock } = req.body;
  try {
    const { data, error } = await supabase.from('variation').update({ stock }).eq('id', id).select();
    if (error) throw error;
    res.status(200).json(data[0]);
  } catch (err) {
    res.status(400).json({ error: `Error al actualizar stock: ${err.message}` });
  }
});


app.listen(process.env.PORT || 5000, () => {
  console.log(`Server running on port ${process.env.PORT || 5000}`);
});
