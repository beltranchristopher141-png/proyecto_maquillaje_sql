import { useEffect, useMemo, useState } from 'react';
import { api } from './api';

const money = (n) => `$${Number(n || 0).toFixed(2)}`;
const today = () => new Date().toLocaleDateString('en-CA');

export default function App() {
  const [tab, setTab] = useState('resumen');
  const [empleados, setEmpleados] = useState([]);
  const [productos, setProductos] = useState([]);
  const [ventas, setVentas] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState(null);
  const [employeeForm, setEmployeeForm] = useState({ nombre: '', turno: 'Mañana' });
  const [productForm, setProductForm] = useState({ nombre: '', categoria: 'Rostro', precio: '', stock: '0' });
  const [saleForm, setSaleForm] = useState({ empleado_id: '', producto_id: '', cantidad: '1', fecha: today() });

  async function loadAll() {
    try {
      setError('');
      const [e, p, v] = await Promise.all([api.get('/empleados'), api.get('/productos'), api.get('/ventas')]);
      setEmpleados(e.data); setProductos(p.data); setVentas(v.data);
      setSaleForm((f) => ({ ...f, empleado_id: f.empleado_id || String(e.data[0]?.id || ''), producto_id: f.producto_id || String(p.data[0]?.id || '') }));
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo conectar con el backend. Comprueba que Express y MySQL estén funcionando.');
    }
  }
  useEffect(() => { loadAll(); }, []);

  const totalVendido = useMemo(() => ventas.reduce((sum, v) => sum + Number(v.total || 0), 0), [ventas]);
  const stockTotal = useMemo(() => productos.reduce((sum, p) => sum + Number(p.stock || 0), 0), [productos]);

  async function runAction(action, successText) {
    try { setError(''); setNotice(''); await action(); setNotice(successText); setEditing(null); await loadAll(); }
    catch (err) { setError(err.response?.data?.error || 'No se pudo completar la operación. Revisa los datos y la conexión.'); }
  }
  async function saveEmployee(e) {
    e.preventDefault();
    await runAction(() => editing?.type === 'empleado'
      ? api.put(`/empleados/${editing.id}`, employeeForm)
      : api.post('/empleados', employeeForm), editing?.type === 'empleado' ? 'Empleado actualizado.' : 'Empleado registrado.');
    setEmployeeForm({ nombre: '', turno: 'Mañana' });
  }
  async function saveProduct(e) {
    e.preventDefault();
    const data = { ...productForm, precio: Number(productForm.precio), stock: Number(productForm.stock) };
    await runAction(() => editing?.type === 'producto' ? api.put(`/productos/${editing.id}`, data) : api.post('/productos', data), editing?.type === 'producto' ? 'Producto actualizado.' : 'Producto registrado.');
    setProductForm({ nombre: '', categoria: 'Rostro', precio: '', stock: '0' });
  }
  async function saveSale(e) {
    e.preventDefault();
    await runAction(() => editing?.type === 'venta' ? api.put(`/ventas/${editing.id}`, { ...saleForm, empleado_id: Number(saleForm.empleado_id), producto_id: Number(saleForm.producto_id), cantidad: Number(saleForm.cantidad) }) : api.post('/ventas', { ...saleForm, empleado_id: Number(saleForm.empleado_id), producto_id: Number(saleForm.producto_id), cantidad: Number(saleForm.cantidad) }), editing?.type === 'venta' ? 'Venta actualizada.' : 'Venta registrada.');
    setSaleForm((f) => ({ ...f, cantidad: '1', fecha: today() }));
  }
  function editEmployee(item) { setEditing({ type: 'empleado', id: item.id }); setEmployeeForm({ nombre: item.nombre, turno: item.turno }); setTab('empleados'); }
  function editProduct(item) { setEditing({ type: 'producto', id: item.id }); setProductForm({ nombre: item.nombre, categoria: item.categoria, precio: String(item.precio), stock: String(item.stock) }); setTab('productos'); }
  function editSale(item) { setEditing({ type: 'venta', id: item.id }); setSaleForm({ empleado_id: String(item.empleado_id), producto_id: String(item.producto_id), cantidad: String(item.cantidad), fecha: String(item.fecha).slice(0, 10) }); setTab('ventas'); }
  function cancelEdit() { setEditing(null); setEmployeeForm({ nombre: '', turno: 'Mañana' }); setProductForm({ nombre: '', categoria: 'Rostro', precio: '', stock: '0' }); setSaleForm({ empleado_id: String(empleados[0]?.id || ''), producto_id: String(productos[0]?.id || ''), cantidad: '1', fecha: today() }); }
  function removeItem(type, id) {
    if (!window.confirm('¿Seguro que quieres eliminar este registro?')) return;
    const endpoint = type === 'empleado' ? 'empleados' : type === 'producto' ? 'productos' : 'ventas';
    runAction(() => api.delete(`/${endpoint}/${id}`), 'Registro eliminado.');
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand-mark">✿</div><p className="eyebrow">TIENDA DE BELLEZA</p><h1>Belleza<br/><span>Rosa</span></h1>
      <p className="side-copy">Inventario y ventas<br/>de maquillaje</p>
      <nav>{[['resumen','▦','Resumen'],['productos','✧','Productos'],['empleados','♙','Empleados'],['ventas','♡','Ventas']].map(([id,icon,label]) => <button key={id} className={tab===id?'nav-item active':'nav-item'} onClick={()=>{setTab(id);setNotice('');setError('');}}><span>{icon}</span>{label}</button>)}</nav>
      <div className="sidebar-bottom"><span className="online-dot"/> Sistema de gestión <small>React · Express · MySQL</small></div>
    </aside>
    <main className="main-content">
      <header className="topbar"><div><p className="eyebrow">PANEL DE ADMINISTRACIÓN</p><h2>{({resumen:'Hola, bienvenida ✨', productos:'Productos de maquillaje', empleados:'Equipo de trabajo', ventas:'Registro de ventas'})[tab]}</h2></div><div className="avatar">BR</div></header>
      {error && <div className="alert error">{error}</div>}{notice && <div className="alert success">✓ {notice}</div>}
      {tab==='resumen' && <>
        <section className="welcome-card"><div><p className="eyebrow light">TU BELLEZA, BIEN ORGANIZADA</p><h3>Todo tu negocio<br/>en un solo lugar.</h3><p>Controla productos, existencias, equipo y ventas desde un panel sencillo.</p><button className="light-button" onClick={()=>setTab('productos')}>Ver productos <span>↗</span></button></div><div className="welcome-art"><div className="art-circle circle-one"/><div className="art-circle circle-two"/><div className="lipstick">▰</div><div className="sparkle">✦</div></div></section>
        <section className="stats-grid"><Stat label="VENTAS REGISTRADAS" value={ventas.length} icon="♡"/><Stat label="TOTAL VENDIDO" value={money(totalVendido)} icon="$"/><Stat label="PRODUCTOS" value={productos.length} icon="✧"/><Stat label="UNIDADES EN STOCK" value={stockTotal} icon="▤"/></section>
        <section className="panel"><div className="panel-heading"><div><p className="eyebrow">ACTIVIDAD RECIENTE</p><h3>Últimas ventas</h3></div><button className="text-button" onClick={()=>setTab('ventas')}>Ver todas ↗</button></div><SalesTable ventas={ventas.slice(0,5)} onEdit={editSale} onDelete={(id)=>removeItem('venta',id)}/></section>
      </>}
      {tab==='productos' && <div className="two-column"><section className="panel form-panel"><p className="eyebrow">CATÁLOGO</p><h3>{editing?.type==='producto'?'Editar producto':'Agregar producto'}</h3><form onSubmit={saveProduct} className="form-grid"><Field label="Nombre del producto"><input required value={productForm.nombre} onChange={e=>setProductForm({...productForm,nombre:e.target.value})} placeholder="Ej. Labial rosa"/></Field><Field label="Categoría"><select value={productForm.categoria} onChange={e=>setProductForm({...productForm,categoria:e.target.value})}>{['Rostro','Labios','Ojos','Uñas','Brochas','Cuidado de piel','Accesorios'].map(x=><option key={x}>{x}</option>)}</select></Field><Field label="Precio ($)"><input required min="0" step="0.01" type="number" value={productForm.precio} onChange={e=>setProductForm({...productForm,precio:e.target.value})} placeholder="0.00"/></Field><Field label="Existencias"><input required min="0" step="1" type="number" value={productForm.stock} onChange={e=>setProductForm({...productForm,stock:e.target.value})}/></Field><div className="form-actions"><button className="primary-button">{editing?.type==='producto'?'Guardar cambios':'Guardar producto'}</button>{editing && <button type="button" className="secondary-button" onClick={cancelEdit}>Cancelar</button>}</div></form></section><section className="panel list-panel"><div className="panel-heading"><div><p className="eyebrow">INVENTARIO</p><h3>Productos ({productos.length})</h3></div></div><div className="product-list">{productos.map(p=><div className="product-row" key={p.id}><div className="product-icon">✧</div><div className="product-info"><strong>{p.nombre}</strong><small>{p.categoria} · Stock: {p.stock}</small></div><strong className="price">{money(p.precio)}</strong><div className="row-actions"><button onClick={()=>editProduct(p)} title="Editar">✎</button><button onClick={()=>removeItem('producto',p.id)} title="Eliminar">×</button></div></div>)}{!productos.length&&<Empty text="Todavía no hay productos. Agrega el primero."/>}</div></section></div>}
      {tab==='empleados' && <div className="two-column"><section className="panel form-panel"><p className="eyebrow">PERSONAL</p><h3>{editing?.type==='empleado'?'Editar empleado':'Registrar empleado'}</h3><form onSubmit={saveEmployee} className="form-grid"><Field label="Nombre completo"><input required value={employeeForm.nombre} onChange={e=>setEmployeeForm({...employeeForm,nombre:e.target.value})} placeholder="Nombre del empleado"/></Field><Field label="Turno"><select value={employeeForm.turno} onChange={e=>setEmployeeForm({...employeeForm,turno:e.target.value})}><option>Mañana</option><option>Tarde</option><option>Noche</option><option>Completo</option></select></Field><div className="form-actions"><button className="primary-button">{editing?.type==='empleado'?'Guardar cambios':'Agregar empleado'}</button>{editing&&<button type="button" className="secondary-button" onClick={cancelEdit}>Cancelar</button>}</div></form></section><section className="panel list-panel"><div className="panel-heading"><div><p className="eyebrow">EQUIPO</p><h3>Empleados ({empleados.length})</h3></div></div>{empleados.map(e=><div className="employee-row" key={e.id}><div className="employee-avatar">{e.nombre.split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase()}</div><div className="product-info"><strong>{e.nombre}</strong><small>Turno {e.turno}</small></div><div className="row-actions"><button onClick={()=>editEmployee(e)} title="Editar">✎</button><button onClick={()=>removeItem('empleado',e.id)} title="Eliminar">×</button></div></div>)}{!empleados.length&&<Empty text="Agrega a la primera persona del equipo."/>}</section></div>}
      {tab==='ventas' && <><section className="panel form-panel sale-form-panel"><p className="eyebrow">PUNTO DE VENTA</p><h3>{editing?.type==='venta'?'Editar venta':'Registrar una venta'}</h3>{(!empleados.length||!productos.length)&&<p className="hint">Primero registra al menos un empleado y un producto.</p>}<form onSubmit={saveSale} className="sale-form"><Field label="Empleado"><select required value={saleForm.empleado_id} onChange={e=>setSaleForm({...saleForm,empleado_id:e.target.value})}><option value="">Seleccionar empleado</option>{empleados.map(e=><option value={e.id} key={e.id}>{e.nombre}</option>)}</select></Field><Field label="Producto"><select required value={saleForm.producto_id} onChange={e=>setSaleForm({...saleForm,producto_id:e.target.value})}><option value="">Seleccionar producto</option>{productos.map(p=><option value={p.id} key={p.id}>{p.nombre} — {money(p.precio)} (stock {p.stock})</option>)}</select></Field><Field label="Cantidad"><input required type="number" min="1" step="1" value={saleForm.cantidad} onChange={e=>setSaleForm({...saleForm,cantidad:e.target.value})}/></Field><Field label="Fecha"><input required type="date" value={saleForm.fecha} onChange={e=>setSaleForm({...saleForm,fecha:e.target.value})}/></Field><div className="form-actions"><button className="primary-button" disabled={!empleados.length||!productos.length}>{editing?.type==='venta'?'Guardar cambios':'Registrar venta'}</button>{editing&&<button type="button" className="secondary-button" onClick={cancelEdit}>Cancelar</button>}</div></form></section><section className="panel"><div className="panel-heading"><div><p className="eyebrow">HISTORIAL</p><h3>Ventas registradas</h3></div><div className="total-pill">Total: {money(totalVendido)}</div></div><SalesTable ventas={ventas} onEdit={editSale} onDelete={id=>removeItem('venta',id)}/></section></>}
      <footer>© {new Date().getFullYear()} Belleza Rosa · Proyecto académico de desarrollo de software</footer>
    </main>
  </div>;
}
function Stat({label,value,icon}) { return <div className="stat-card"><div className="stat-icon">{icon}</div><p>{label}</p><strong>{value}</strong></div>; }
function Field({label,children}) { return <label className="field"><span>{label}</span>{children}</label>; }
function Empty({text}) { return <div className="empty-state">{text}</div>; }
function SalesTable({ventas,onEdit,onDelete}) { return <div className="table-wrap"><table><thead><tr><th>Producto</th><th>Empleado</th><th>Cant.</th><th>Precio</th><th>Total</th><th>Fecha</th><th>Acciones</th></tr></thead><tbody>{ventas.map(v=><tr key={v.id}><td><strong>{v.producto}</strong><small className="table-sub">{v.categoria||'Maquillaje'}</small></td><td>{v.empleado}</td><td>{v.cantidad}</td><td>{money(v.precio)}</td><td className="price">{money(v.total)}</td><td>{String(v.fecha).slice(0,10)}</td><td><div className="row-actions"><button onClick={()=>onEdit(v)} title="Editar">✎</button><button onClick={()=>onDelete(v.id)} title="Eliminar">×</button></div></td></tr>)}</tbody></table>{!ventas.length&&<Empty text="Aún no hay ventas registradas."/>}</div>; }
