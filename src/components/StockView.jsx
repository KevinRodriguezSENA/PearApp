// DOCUMENT filename="StockView.jsx"
import React, { useEffect, useState } from 'react';
import supabase from '../supabaseClient';

function StockView({ setError, errorMessage, setActiveModule, user }) {
  const [groupedProducts, setGroupedProducts] = useState([]);
  const [filteredGroupedProducts, setFilteredGroupedProducts] = useState([]);
  const [filters, setFilters] = useState({ search: '', size: '' });
  const [sortConfig, setSortConfig] = useState({ key: 'reference', direction: 'asc' });
  const sizes = ['34', '35', '36', '37', '38', '39', '40', '41'];
  const [showSaleForm, setShowSaleForm] = useState(false);
  const [showAddItemForm, setShowAddItemForm] = useState(false);
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [newSale, setNewSale] = useState({ customerId: '', sale_type: false, items: [] });
  const [newItem, setNewItem] = useState({ reference: '', color: '', sizes: { '34': 0, '35': 0, '36': 0, '37': 0, '38': 0, '39': 0, '40': 0, '41': 0 } });
  const [newCustomer, setNewCustomer] = useState({ name: '', document_type: 'Cédula', document: '', phone: '', city: '', address: '', notes: '' });
  const [formError, setFormError] = useState('');

  useEffect(() => {
    fetchProducts();
    fetchCustomers();
  }, []);

  useEffect(() => {
    applyFiltersAndSorting();
  }, [groupedProducts, sortConfig, filters]);

  const fetchProducts = async () => {
    try {
      const { data, error: productsError } = await supabase
        .from('products')
        .select(`
          id,
          reference,
          image_url,
          price_r,
          price_w,
          variations (
            id,
            color,
            size,
            stock,
            created_at
          )
        `);
      if (productsError) {
        setError(`Error al obtener productos: ${productsError.message}`);
        return;
      }

      const grouped = data.reduce((acc, product) => {
        if (!product.variations || !Array.isArray(product.variations) || product.variations.length === 0) return acc;

        const key = product.reference + '-' + product.variations[0].color;
        if (!acc[key]) {
          acc[key] = {
            product_id: product.id,
            reference: product.reference,
            image_url: product.image_url,
            price_r: product.price_r,
            price_w: product.price_w,
            color: product.variations[0].color,
            sizes: {},
            created_at: product.variations[0].created_at,
          };
        }

        product.variations.forEach((variation) => {
          acc[key].sizes[variation.size] = variation.stock || 0;
        });

        return acc;
      }, {});

      setGroupedProducts(Object.values(grouped));
      setFilteredGroupedProducts(Object.values(grouped));
    } catch (err) {
      setError(`Error inesperado: ${err.message}`);
    }
  };

  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase.from('customers').select('*');
      if (error) throw error;
      setCustomers(data);
    } catch (err) {
      setError(`Error al obtener clientes: ${err.message}`);
    }
  };

  const applyFiltersAndSorting = () => {
    let filtered = [...groupedProducts];

    if (filters.search) {
      const searchTerms = filters.search.toLowerCase().split(' ').filter(term => term);
      filtered = filtered.filter((group) => {
        const searchString = `${group.reference} ${group.color}`.toLowerCase();
        return searchTerms.every(term => searchString.includes(term));
      });
    }

    if (filters.size) {
      filtered = filtered.filter((group) =>
        Object.keys(group.sizes).some(size => size.includes(filters.size) && group.sizes[size] >= 1)
      );
    }

    if (sortConfig.key) {
      filtered.sort((a, b) => {
        const valueA = a[sortConfig.key].toLowerCase();
        const valueB = b[sortConfig.key].toLowerCase();
        const comparison = valueA.localeCompare(valueB);
        return sortConfig.direction === 'asc' ? comparison : -comparison;
      });
    }

    setFilteredGroupedProducts(filtered);
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters({ ...filters, [name]: value });
  };

  const handleClearFilters = () => {
    setFilters({ search: '', size: '' });
    setSortConfig({ key: 'reference', direction: 'asc' });
  };

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const uniqueReferences = [...new Set(groupedProducts.map(p => p.reference))];
  const getColorsForReference = (reference) => {
    return [...new Set(groupedProducts.filter(p => p.reference === reference).map(p => p.color))];
  };

  const calculateTotal = () => {
    return newSale.items.reduce((total, item) => {
      const product = groupedProducts.find(p => p.reference === item.reference && p.color === item.color);
      if (!product) return total;
      const price = newSale.sale_type ? product.price_w : product.price_r;
      const quantity = Object.values(item.sizes).reduce((sum, q) => sum + q, 0);
      return total + (quantity * price);
    }, 0);
  };

  const handleAddItem = () => {
    if (!newItem.reference || !newItem.color) {
      setFormError('Debe seleccionar una referencia y un color.');
      return;
    }

    const quantity = Object.values(newItem.sizes).reduce((sum, q) => sum + q, 0);
    if (quantity === 0) {
      setFormError('Debe seleccionar al menos una talla con cantidad mayor a 0.');
      return;
    }

    const stockIssues = Object.entries(newItem.sizes).filter(([size, qty]) => {
      const product = groupedProducts.find(p => p.reference === newItem.reference && p.color === newItem.color);
      return product && product.sizes[size] < qty;
    });

    if (stockIssues.length > 0) {
      setFormError(`No hay suficiente stock para: ${stockIssues.map(([size]) => `Talla ${size}`).join(', ')}`);
      return;
    }

    setNewSale((prev) => ({
      ...prev,
      items: [...prev.items, { ...newItem }],
    }));
    setNewItem({ reference: '', color: '', sizes: { '34': 0, '35': 0, '36': 0, '37': 0, '38': 0, '39': 0, '40': 0, '41': 0 } });
    setShowAddItemForm(false);
    setFormError('');
  };

  const handleItemChange = (field, value) => {
    setNewItem((prev) => ({ ...prev, [field]: value }));
    if (field === 'reference') {
      setNewItem((prev) => ({ ...prev, color: '' }));
    }
  };

  const handleSizeChange = (size, value) => {
    setNewItem((prev) => ({
      ...prev,
      sizes: { ...prev.sizes, [size]: parseInt(value) || 0 },
    }));
  };

  const handleSubmitSale = async () => {
    if (!user?.id) {
      setFormError('Usuario no autenticado. Por favor, inicia sesión.');
      return;
    }
    if (!newSale.customerId) {
      setFormError('Debe seleccionar un cliente existente.');
      return;
    }
    if (newSale.items.length === 0) {
      setFormError('Debe agregar al menos un artículo a la venta.');
      return;
    }

    try {
      const totalValue = calculateTotal();
      const totalPairs = newSale.items.reduce((sum, item) => sum + Object.values(item.sizes).reduce((a, b) => a + b, 0), 0);
      const customer = customers.find(c => c.id === newSale.customerId);

      const { data: saleData, error: saleError } = await supabase
        .from('sales')
        .insert({
          customer_id: newSale.customerId,
          total_value: totalValue,
          sale_type: newSale.sale_type ? 'wholesale' : 'retail',
          created_at: new Date().toISOString(),
          created_by: user.id,
          status: 'pending',
        })
        .select('id')
        .single();
      if (saleError) throw saleError;

      const saleId = saleData.id;

      const itemsToInsert = newSale.items.flatMap(item => {
        const product = groupedProducts.find(p => p.reference === item.reference && p.color === item.color);
        return Object.entries(item.sizes).filter(([_, qty]) => qty > 0).map(([size, quantity]) => ({
          sale_id: saleId,
          reference: item.reference,
          color: item.color,
          size,
          quantity,
          unit_price: newSale.sale_type ? product.price_w : product.price_r,
          subtotal: quantity * (newSale.sale_type ? product.price_w : product.price_r),
        }));
      });
      const { error: itemsError } = await supabase.from('sale_items').insert(itemsToInsert);
      if (itemsError) throw itemsError;

      for (const item of newSale.items) {
        for (const [size, quantity] of Object.entries(item.sizes)) {
          if (quantity > 0) {
            const product = groupedProducts.find(p => p.reference === item.reference && p.color === item.color);
            const { data: variation } = await supabase
              .from('variations')
              .select('id, stock')
              .eq('product_id', product.product_id)
              .eq('color', item.color)
              .eq('size', size)
              .single();
            if (variation) {
              await supabase
                .from('variations')
                .update({ stock: variation.stock - quantity })
                .eq('id', variation.id);
            }
          }
        }
      }

      // ARREGLO: Lógica de notificación mejorada
      const { data: usersToNotify, error: usersError } = await supabase
  .from('users')
  .select('id, settings ( key, value )')
  .in('role', ['admin', 'produccion']);
if (usersError) throw usersError;

const uniqueReferences = [...new Set(newSale.items.map(item => item.reference))].length;
const notificationMessage = `El usuario ${user.username} acaba de realizar una venta al cliente ${customer.name}. Cantidad de referencias: ${uniqueReferences}. Cantidad de pares: ${totalPairs}.`;
const notificationsToInsert = []; // Initialize the array

for (const targetUser of usersToNotify) {
  const prefsSetting = targetUser.settings.find(s => s.key === `notification_prefs_${targetUser.id}`);
  const prefs = prefsSetting ? JSON.parse(prefsSetting.value) : { receiveSaleNotifications: true };
  
  if (prefs.receiveSaleNotifications) {
    notificationsToInsert.push({
      user_id: targetUser.id,
      message: notificationMessage,
      created_at: new Date().toISOString(),
      read: false,
      sale_id: saleId,
      type: 'sale_pending',
    });
  }
}

if (notificationsToInsert.length > 0) {
  const { error: notificationError } = await supabase
    .from('notifications')
    .insert(notificationsToInsert);
  if (notificationError) throw notificationError;
}

      setShowSaleForm(false);
      setNewSale({ customerId: '', sale_type: false, items: [] });
      fetchProducts();
      setFormError('');
    } catch (err) {
      setFormError(`Error al guardar venta: ${err.message}`);
    }
  };

  const handleClearSale = () => {
    setNewSale({ customerId: '', sale_type: false, items: [] });
    setFormError('');
  };

  const handleCancelSale = () => {
    setShowSaleForm(false);
    setFormError('');
  };

  const handleAddNewCustomer = async () => {
    if (!newCustomer.name || !newCustomer.document) {
      setFormError('El nombre y el documento son obligatorios.');
      return;
    }
    try {
      const { error } = await supabase.from('customers').insert({
        name: newCustomer.name,
        document_type: newCustomer.document_type,
        document: newCustomer.document,
        phone: newCustomer.phone,
        city: newCustomer.city,
        address: newCustomer.address,
        notes: newCustomer.notes,
        created_at: new Date().toISOString(),
      });
      if (error) throw error;
      setNewCustomer({ name: '', document_type: 'Cédula', document: '', phone: '', city: '', address: '', notes: '' });
      setShowNewCustomerForm(false);
      fetchCustomers();
      setFormError('');
    } catch (err) {
      setFormError(`Error al agregar cliente: ${err.message}`);
    }
  };

  return (
    <>
      <div className="bg-pear-neutral p-6">
        <h2 className="text-2xl font-bold text-pear-dark-green mb-4 flex items-center">
          <span className="mr-2">🍐</span> Inventario Actual
        </h2>
        <p className="text-pear-dark mb-4">Visualización clara y rápida para equipo de ventas</p>
        {errorMessage && <p className="text-red-500 mb-4">{errorMessage}</p>}

        <div className="flex flex-wrap justify-between mb-4 gap-2">
          <div className="flex items-center space-x-2">
            <input
              type="text"
              name="search"
              placeholder="Filtrar por Referencia o Color (ej: MC104 DIANI ROJO)"
              value={filters.search}
              onChange={handleFilterChange}
              className="p-2 border border-gray-300 rounded w-64"
            />
            <input
              type="text"
              name="size"
              placeholder="Filtrar Talla (solo con existencias)"
              value={filters.size}
              onChange={handleFilterChange}
              className="p-2 border border-gray-300 rounded"
            />
            <button
              onClick={handleClearFilters}
              className="bg-gray-300 text-pear-dark px-4 py-2 rounded hover:bg-gray-400"
            >
              Limpiar Filtros
            </button>
            {user?.role !== 'lector' && (
              <button
                onClick={() => setShowSaleForm(true)}
                className="bg-pear-green text-white px-4 py-2 rounded hover:bg-pear-dark-green"
              >
                + Nueva Venta
              </button>
            )}
          </div>
        </div>

        <table className="w-full border-collapse bg-white rounded-lg shadow-md">
          <thead>
            <tr className="bg-pear-green text-white">
              <th className="border p-2">Imagen</th>
              <th className="border p-2">
                <div className="flex items-center justify-between w-full">
                  <span>Referencia</span>
                  <button onClick={() => handleSort('reference')} className="focus:outline-none p-1">
                    {sortConfig.key === 'reference' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                  </button>
                </div>
              </th>
              <th className="border p-2">
                <div className="flex items-center justify-between w-full">
                  <span>Color</span>
                  <button onClick={() => handleSort('color')} className="focus:outline-none p-1">
                    {sortConfig.key === 'color' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                  </button>
                </div>
              </th>
              {sizes.map((size) => (
                <th key={size} className="border p-2">{size}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredGroupedProducts.map((group, index) => (
              <tr key={index} className="border-t">
                <td className="border p-2">
                  {group.image_url ? (
                    <img src={group.image_url} alt={`${group.reference} ${group.color}`} className="w-12 h-12 object-cover" onError={(e) => (e.target.src = 'https://placehold.co/48x48/EFEFEF/AAAAAA&text=No+Img')} />
                  ) : (
                    <span className="text-gray-500">Sin imagen</span>
                  )}
                </td>
                <td className="border p-2">{group.reference}</td>
                <td className="border p-2">{group.color}</td>
                {sizes.map((size) => (
                  <td key={size} className="border p-2 text-center">{group.sizes[size] || 0}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-pear-dark mt-4 text-sm">Diseñado para Majo Valero - Visual Simple & Potente</p>
      </div>

      {showSaleForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md sm:max-w-lg">
            <h3 className="text-xl font-bold mb-4 text-pear-dark-green">Nueva Venta</h3>
            {formError && <p className="text-red-500 mb-4">{formError}</p>}
            <div className="space-y-4">
              <div>
                <label className="block mb-1 font-medium text-pear-dark">Cliente</label>
                <input
                  type="text"
                  list="customers"
                  value={customers.find(c => c.id === newSale.customerId)?.name || ''}
                  onChange={(e) => {
                    const customer = customers.find(c => c.name.toLowerCase().includes(e.target.value.toLowerCase()));
                    setNewSale({ ...newSale, customerId: customer ? customer.id : '' });
                  }}
                  className="p-2 border border-gray-300 rounded w-full"
                  placeholder="Escribe para buscar cliente..."
                />
                <datalist id="customers">
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.name} />
                  ))}
                </datalist>
                <button
                  onClick={() => setShowNewCustomerForm(true)}
                  className="mt-2 text-sm text-blue-500 underline"
                >
                  + Nuevo cliente
                </button>
              </div>
              <div>
                <label className="block mb-1 font-medium text-pear-dark">Usuario</label>
                <input
                  type="text"
                  value={user?.username || ''}
                  readOnly
                  className="p-2 border border-gray-300 rounded w-full bg-gray-100"
                />
              </div>
              <div>
                <label className="block mb-1 font-medium text-pear-dark">Modo</label>
                <div className="flex space-x-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="saleType"
                      value={false}
                      checked={!newSale.sale_type}
                      onChange={() => setNewSale({ ...newSale, sale_type: false })}
                      className="mr-2"
                    />
                    Detal
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="saleType"
                      value={true}
                      checked={newSale.sale_type}
                      onChange={() => setNewSale({ ...newSale, sale_type: true })}
                      className="mr-2"
                    />
                    Mayor
                  </label>
                </div>
              </div>
              <div>
                <button
                  onClick={() => setShowAddItemForm(true)}
                  className="bg-pear-green text-white px-4 py-2 rounded hover:bg-pear-dark-green"
                >
                  + Agregar Referencia
                </button>
                {newSale.items.length > 0 && (
                  <div className="mt-4">
                    <h4 className="font-medium text-pear-dark mb-2">Artículos:</h4>
                    {newSale.items.map((item, index) => (
                      <div key={index} className="border p-2 rounded mb-2">
                        <p><strong>Referencia:</strong> {item.reference}</p>
                        <p><strong>Color:</strong> {item.color}</p>
                        <p><strong>Tallas:</strong> {Object.entries(item.sizes).filter(([_, qty]) => qty > 0).map(([size, qty]) => `${size}: ${qty}`).join(', ')}</p>
                      </div>
                    ))}
                    <p className="mt-2 font-medium">Total: ${calculateTotal()}</p>
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end space-x-2 mt-6">
              <button onClick={handleClearSale} className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600">
                Limpiar
              </button>
              <button onClick={handleCancelSale} className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600">
                Cancelar
              </button>
              <button onClick={handleSubmitSale} className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600">
                Enviar
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddItemForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
            <h3 className="text-xl font-bold mb-4 text-pear-dark-green">Agregar Referencia</h3>
            {formError && <p className="text-red-500 mb-4">{formError}</p>}
            <div className="space-y-4">
              <div>
                <label className="block mb-1 font-medium text-pear-dark">Referencia</label>
                <select
                  value={newItem.reference}
                  onChange={(e) => handleItemChange('reference', e.target.value)}
                  className="p-2 border border-gray-300 rounded w-full"
                >
                  <option value="">Selecciona referencia</option>
                  {uniqueReferences.map((ref) => (
                    <option key={ref} value={ref}>{ref}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block mb-1 font-medium text-pear-dark">Color</label>
                <select
                  value={newItem.color}
                  onChange={(e) => handleItemChange('color', e.target.value)}
                  className="p-2 border border-gray-300 rounded w-full"
                  disabled={!newItem.reference}
                >
                  <option value="">Selecciona color</option>
                  {newItem.reference && getColorsForReference(newItem.reference).map((color) => (
                    <option key={color} value={color}>{color}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block mb-1 font-medium text-pear-dark">Tallas</label>
                <div className="grid grid-cols-4 gap-2">
                  {sizes.map((size) => (
                    <div key={size}>
                      <label className="block text-sm text-pear-dark">{size}</label>
                      <input
                        type="number"
                        min="0"
                        value={newItem.sizes[size]}
                        onChange={(e) => handleSizeChange(size, e.target.value)}
                        className="p-2 border border-gray-300 rounded w-full"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end space-x-2 mt-6">
              <button onClick={() => setShowAddItemForm(false)} className="bg-gray-300 text-pear-dark px-4 py-2 rounded hover:bg-gray-400">
                Cancelar
              </button>
              <button onClick={handleAddItem} className="bg-pear-green text-white px-4 py-2 rounded hover:bg-pear-dark-green">
                Agregar
              </button>
            </div>
          </div>
        </div>
      )}

      {showNewCustomerForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
            <h3 className="text-xl font-bold mb-4 text-pear-dark-green">Nuevo Cliente</h3>
            {formError && <p className="text-red-500 mb-4">{formError}</p>}
            <div className="space-y-4">
              <div>
                <label className="block mb-1 font-medium text-pear-dark">Nombre *</label>
                <input
                  type="text"
                  value={newCustomer.name}
                  onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                  className="p-2 border border-gray-300 rounded w-full"
                />
              </div>
              <div>
                <label className="block mb-1 font-medium text-pear-dark">Tipo de Documento *</label>
                <select
                  value={newCustomer.document_type}
                  onChange={(e) => setNewCustomer({ ...newCustomer, document_type: e.target.value })}
                  className="p-2 border border-gray-300 rounded w-full"
                >
                  <option value="Cédula">Cédula</option>
                  <option value="NIT">NIT</option>
                  <option value="Otros">Otros</option>
                </select>
              </div>
              <div>
                <label className="block mb-1 font-medium text-pear-dark">Documento *</label>
                <input
                  type="text"
                  value={newCustomer.document}
                  onChange={(e) => setNewCustomer({ ...newCustomer, document: e.target.value })}
                  className="p-2 border border-gray-300 rounded w-full"
                />
              </div>
              <div>
                <label className="block mb-1 font-medium text-pear-dark">Teléfono</label>
                <input
                  type="text"
                  value={newCustomer.phone}
                  onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                  className="p-2 border border-gray-300 rounded w-full"
                />
              </div>
              <div>
                <label className="block mb-1 font-medium text-pear-dark">Ciudad</label>
                <input
                  type="text"
                  value={newCustomer.city}
                  onChange={(e) => setNewCustomer({ ...newCustomer, city: e.target.value })}
                  className="p-2 border border-gray-300 rounded w-full"
                />
              </div>
              <div>
                <label className="block mb-1 font-medium text-pear-dark">Dirección</label>
                <input
                  type="text"
                  value={newCustomer.address}
                  onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                  className="p-2 border border-gray-300 rounded w-full"
                />
              </div>
              <div>
                <label className="block mb-1 font-medium text-pear-dark">Notas</label>
                <textarea
                  value={newCustomer.notes}
                  onChange={(e) => setNewCustomer({ ...newCustomer, notes: e.target.value })}
                  className="p-2 border border-gray-300 rounded w-full"
                  rows="3"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-2 mt-6">
              <button onClick={() => setShowNewCustomerForm(false)} className="bg-gray-300 text-pear-dark px-4 py-2 rounded hover:bg-gray-400">
                Cancelar
              </button>
              <button onClick={handleAddNewCustomer} className="bg-pear-green text-white px-4 py-2 rounded hover:bg-pear-dark-green">
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default StockView;