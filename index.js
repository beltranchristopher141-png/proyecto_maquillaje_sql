require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors());
app.use(express.json());

const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'maquillaje',
  port: Number(process.env.DB_PORT || 3306),
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true,
  decimalNumbers: true
});

const query = (sql, params = []) => new Promise((resolve, reject) => {
  db.query(sql, params, (err, results) => err ? reject(err) : resolve(results));
});
const asyncRoute = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

app.get('/', (req, res) => res.json({ message: 'API de la tienda de maquillaje funcionando' }));
app.get('/health', (req, res) => res.json({ ok: true }));

// CRUD de empleados
app.get('/empleados', asyncRoute(async (_req, res) => res.json(await query('SELECT * FROM empleados ORDER BY id DESC'))));
app.post('/empleados', asyncRoute(async (req, res) => {
  const { nombre, turno } = req.body;
  if (!nombre?.trim() || !turno?.trim()) return res.status(400).json({ error: 'Nombre y turno son obligatorios.' });
  const r = await query('INSERT INTO empleados (nombre, turno) VALUES (?, ?)', [nombre.trim(), turno.trim()]);
  res.status(201).json({ id: r.insertId, message: 'Empleado agregado correctamente.' });
}));
app.put('/empleados/:id', asyncRoute(async (req, res) => {
  const { nombre, turno } = req.body;
  if (!nombre?.trim() || !turno?.trim()) return res.status(400).json({ error: 'Nombre y turno son obligatorios.' });
  const r = await query('UPDATE empleados SET nombre=?, turno=? WHERE id=?', [nombre.trim(), turno.trim(), req.params.id]);
  if (!r.affectedRows) return res.status(404).json({ error: 'Empleado no encontrado.' });
  res.json({ message: 'Empleado actualizado.' });
}));
app.delete('/empleados/:id', asyncRoute(async (req, res) => {
  try {
    const r = await query('DELETE FROM empleados WHERE id=?', [req.params.id]);
    if (!r.affectedRows) return res.status(404).json({ error: 'Empleado no encontrado.' });
    res.json({ message: 'Empleado eliminado.' });
  } catch (e) { if (e.code === 'ER_ROW_IS_REFERENCED_2') return res.status(409).json({ error: 'No puedes eliminar a un empleado con ventas registradas.' }); throw e; }
}));

// CRUD de productos de maquillaje
app.get('/productos', asyncRoute(async (_req, res) => res.json(await query('SELECT * FROM productos ORDER BY id DESC'))));
app.post('/productos', asyncRoute(async (req, res) => {
  const { nombre, categoria, precio, stock } = req.body;
  if (!nombre?.trim() || !categoria?.trim() || !Number.isFinite(Number(precio)) || Number(precio) < 0 || !Number.isInteger(Number(stock ?? 0)) || Number(stock ?? 0) < 0)
    return res.status(400).json({ error: 'Completa nombre, categoría, precio válido y stock entero no negativo.' });
  const r = await query('INSERT INTO productos (nombre, categoria, precio, stock) VALUES (?, ?, ?, ?)', [nombre.trim(), categoria.trim(), Number(precio), Number(stock ?? 0)]);
  res.status(201).json({ id: r.insertId, message: 'Producto agregado correctamente.' });
}));
app.put('/productos/:id', asyncRoute(async (req, res) => {
  const { nombre, categoria, precio, stock } = req.body;
  if (!nombre?.trim() || !categoria?.trim() || !Number.isFinite(Number(precio)) || Number(precio) < 0 || !Number.isInteger(Number(stock ?? 0)) || Number(stock ?? 0) < 0)
    return res.status(400).json({ error: 'Datos del producto no válidos.' });
  const r = await query('UPDATE productos SET nombre=?, categoria=?, precio=?, stock=? WHERE id=?', [nombre.trim(), categoria.trim(), Number(precio), Number(stock ?? 0), req.params.id]);
  if (!r.affectedRows) return res.status(404).json({ error: 'Producto no encontrado.' });
  res.json({ message: 'Producto actualizado.' });
}));
app.delete('/productos/:id', asyncRoute(async (req, res) => {
  try {
    const r = await query('DELETE FROM productos WHERE id=?', [req.params.id]);
    if (!r.affectedRows) return res.status(404).json({ error: 'Producto no encontrado.' });
    res.json({ message: 'Producto eliminado.' });
  } catch (e) { if (e.code === 'ER_ROW_IS_REFERENCED_2') return res.status(409).json({ error: 'No puedes eliminar un producto que aparece en ventas.' }); throw e; }
}));

// Ventas: JOIN para combinar empleado, producto, precio y total
app.get('/ventas', asyncRoute(async (_req, res) => {
  const sql = `SELECT v.id, v.empleado_id, v.producto_id, e.nombre AS empleado,
    p.nombre AS producto, p.categoria, p.precio, v.cantidad, v.fecha,
    (v.cantidad * v.precio_unitario) AS total
    FROM ventas v INNER JOIN empleados e ON v.empleado_id=e.id
    INNER JOIN productos p ON v.producto_id=p.id ORDER BY v.id DESC`;
  res.json(await query(sql));
}));
app.post('/ventas', asyncRoute(async (req, res) => {
  const { empleado_id, producto_id, cantidad, fecha } = req.body;
  if (!Number.isInteger(Number(empleado_id)) || !Number.isInteger(Number(producto_id)) || !Number.isInteger(Number(cantidad)) || Number(cantidad) < 1 || !/^\d{4}-\d{2}-\d{2}$/.test(fecha || ''))
    return res.status(400).json({ error: 'Selecciona empleado, producto, cantidad positiva y fecha válida.' });
  const productos = await query('SELECT precio, stock FROM productos WHERE id=?', [producto_id]);
  if (!productos.length) return res.status(400).json({ error: 'El producto seleccionado no existe.' });
  if (productos[0].stock < Number(cantidad)) return res.status(409).json({ error: 'No hay suficiente stock para esa cantidad.' });
  const r = await query('INSERT INTO ventas (empleado_id, producto_id, cantidad, fecha, precio_unitario) VALUES (?, ?, ?, ?, ?)', [empleado_id, producto_id, Number(cantidad), fecha, productos[0].precio]);
  await query('UPDATE productos SET stock = stock - ? WHERE id=?', [Number(cantidad), producto_id]);
  res.status(201).json({ id: r.insertId, message: 'Venta registrada correctamente.' });
}));
app.put('/ventas/:id', asyncRoute(async (req, res) => {
  const { empleado_id, producto_id, cantidad, fecha } = req.body;
  if (!Number.isInteger(Number(empleado_id)) || !Number.isInteger(Number(producto_id)) || !Number.isInteger(Number(cantidad)) || Number(cantidad) < 1 || !/^\d{4}-\d{2}-\d{2}$/.test(fecha || ''))
    return res.status(400).json({ error: 'Datos de la venta no válidos.' });
  const producto = await query('SELECT precio FROM productos WHERE id=?', [producto_id]);
  if (!producto.length) return res.status(400).json({ error: 'Producto no encontrado.' });
  const r = await query('UPDATE ventas SET empleado_id=?, producto_id=?, cantidad=?, fecha=?, precio_unitario=? WHERE id=?', [empleado_id, producto_id, cantidad, fecha, producto[0].precio, req.params.id]);
  if (!r.affectedRows) return res.status(404).json({ error: 'Venta no encontrada.' });
  res.json({ message: 'Venta actualizada. Nota: el stock no se recalcula al editar ventas.' });
}));
app.delete('/ventas/:id', asyncRoute(async (req, res) => {
  const r = await query('DELETE FROM ventas WHERE id=?', [req.params.id]);
  if (!r.affectedRows) return res.status(404).json({ error: 'Venta no encontrada.' });
  res.json({ message: 'Venta eliminada. Nota: el stock no se repone automáticamente.' });
}));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor. Revisa la conexión a MySQL y los logs.' });
});
app.listen(PORT, () => console.log(`API lista en http://localhost:${PORT}`));
