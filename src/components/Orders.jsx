import React, { useState, useEffect } from 'react';
import supabase from '../supabaseClient';

function Orders({ user }) {
  const [customers, setCustomers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [groupedOrders, setGroupedOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [activeTab, setActiveTab] = useState('pending');
  const [showCreateOrder, setShowCreateOrder] = useState(false);
  const [showOrderDetails, setShowOrderDetails] = useState(null);
  const [showAddReference, setShowAddReference] = useState(false);
  const [showEditOrder, setShowEditOrder] = useState(null);
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [showNewReferenceForm, setShowNewReferenceForm] = useState(false);
  const [filters, setFilters] = useState({ search: '', created_at: '' });
  const [newOrder, setNewOrder] = useState({
    client_name: '',
    observations: '',
    deadline: '',
    items: [],
  });
  const [editOrder, setEditOrder] = useState(null);
  const [newReference, setNewReference] = useState({
    reference: '',
    color: '',
    sizes: { 34: 0, 35: 0, 36: 0, 37: 0, 38: 0, 39: 0, 40: 0, 41: 0 },
    observation: '',
    image_url: '',
    price_r: 'Precio detal',
    price_w: 'Precio mayorista',
  });
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    document_type: 'Cédula',
    document: '',
    phone: '',
    city: '',
    address: '',
    notes: '',
  });
  const [error, setError] = useState(null);
  const [references, setReferences] = useState([]);
  const [colors, setColors] = useState([]);
  const [suggestedSizes, setSuggestedSizes] = useState({
    34: 0, 35: 1, 36: 2, 37: 3, 38: 3, 39: 2, 40: 1, 41: 0,
  });
  const sizes = ['34', '35', '36', '37', '38', '39', '40', '41'];

  useEffect(() => {
    fetchOrders();
    fetchReferencesAndColors();
    checkAndCreateStockOrders();
    const fetchCustomers = async () => {
      const { data, error } = await supabase.from('customers').select('id, name');
      if (error) console.error(error);
      else setCustomers(data || []);
    };
    fetchCustomers();

    const subscription = supabase
      .channel('orders-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload) => {
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [user?.id]);

  useEffect(() => {
    groupOrders();
  }, [orders, activeTab]);

  useEffect(() => {
    applyFilters();
  }, [groupedOrders, filters]);

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*, users(username)')
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      setOrders(data || []);
    } catch (err) {
      setError(`Error al obtener pedidos: ${err.message}`);
    }
  };

  const groupOrders = () => {
    const grouped = [];
    orders.forEach(order => {
      if (order.status !== activeTab) return;
      if (order.user_id === null || order.client_name === 'Stock') {
        order.items.forEach(item => {
          grouped.push({ ...order, item });
        });
      } else {
        grouped.push(order);
      }
    });
    setGroupedOrders(grouped);
  };

  const applyFilters = () => {
    let filtered = [...groupedOrders];
    if (filters.search) {
      const searchTerms = filters.search.toLowerCase().split(' ').filter(term => term);
      filtered = filtered.filter(o =>
        o.user_id === null || o.client_name === 'Stock'
          ? searchTerms.every(term => o.item.reference.toLowerCase().includes(term))
          : searchTerms.every(term => o.client_name.toLowerCase().includes(term) || o.items.some(i => i.reference.toLowerCase().includes(term)))
      );
    }
    if (filters.created_at) {
      filtered = filtered.filter(o =>
        o.created_at ? new Date(o.created_at).toISOString().split('T')[0] === filters.created_at : false
      );
    }
    setFilteredOrders(filtered);
  };

  const fetchReferencesAndColors = async () => {
    try {
      const { data: products, error: productError } = await supabase
        .from('products')
        .select('reference');
      if (productError) throw new Error(productError.message);

      const { data: variations, error: variationError } = await supabase
        .from('variations')
        .select('color');
      if (variationError) throw new Error(variationError.message);

      setReferences([...new Set(products.map(p => p.reference))]);
      setColors([...new Set(variations.map(v => v.color))]);
    } catch (err) {
      setError(`Error al obtener referencias y colores: ${err.message}`);
    }
  };

  const checkAndCreateStockOrders = async () => {
    if (!user?.id || !['admin', 'produccion'].includes(user.role)) return;

    try {
      const { data: sizesData, error: sizesError } = await supabase
        .from('settings')
        .select('value')
        .eq('key', `suggested_sizes_${user.id}`)
        .limit(1)
        .maybeSingle();
      if (sizesError) throw new Error(`Error en settings: ${sizesError.message}`);
      const effectiveSuggestedSizes = sizesData?.value ? JSON.parse(sizesData.value) : suggestedSizes;

      const { data: products, error: productError } = await supabase
        .from('products')
        .select('id, reference, variations(color, size, stock)');
      if (productError) throw new Error(`Error en productos: ${productError.message}`);

      const { data: stockOrders, error: ordersError } = await supabase
        .from('orders')
        .select('id, status, items')
        .eq('client_name', 'Stock')
        .in('status', ['pending', 'in_process']);
      if (ordersError) throw new Error(`Error en órdenes: ${ordersError.message}`);

      const idealItemsToOrder = [];

      for (const product of products) {
        const variationsByColor = product.variations.reduce((acc, variation) => {
          if (!acc[variation.color]) acc[variation.color] = {};
          acc[variation.color][variation.size] = variation.stock;
          return acc;
        }, {});

        for (const [color, currentStockBySize] of Object.entries(variationsByColor)) {
          const inProcess = stockOrders.some(o => o.status === 'in_process' && o.items.some(i => i.reference === product.reference && i.color === color));
          if (inProcess) continue;

          const neededSizes = {};
          for (const size of sizes) {
            const currentStock = currentStockBySize[size] || 0;
            const suggestedStock = effectiveSuggestedSizes[size] || 0;
            const needed = suggestedStock - currentStock;

            if (needed > 0) {
              neededSizes[size] = needed;
            }
          }

          if (Object.keys(neededSizes).length > 0) {
            idealItemsToOrder.push({
              reference: product.reference,
              color: color,
              sizes: neededSizes,
              observation: 'Reposición automática',
            });
          }
        }
      }

      const pendingStockOrder = stockOrders.find(o => o.status === 'pending');

      if (idealItemsToOrder.length > 0) {
        if (pendingStockOrder) {
          const { error: updateError } = await supabase
            .from('orders')
            .update({ items: idealItemsToOrder, updated_at: new Date().toISOString() })
            .eq('id', pendingStockOrder.id);
          if (updateError) throw updateError;
        } else {
          const { error: insertError } = await supabase.from('orders').insert({
            client_name: 'Stock',
            status: 'pending',
            items: idealItemsToOrder,
            created_at: new Date().toISOString(),
            deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            observations: 'Orden automática para reposición de stock.',
          });
          if (insertError) throw insertError;
        }
      } else if (pendingStockOrder) {
        await supabase.from('orders').delete().eq('id', pendingStockOrder.id);
      }

      fetchOrders();
    } catch (err) {
      setError(`Error al crear/actualizar pedidos de stock: ${err.message}`);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters({ ...filters, [name]: value });
  };

  const handleClearFilters = () => {
    setFilters({ search: '', created_at: '' });
  };

  const handleAddReference = () => {
    if (!newReference.reference || !newReference.color || !Object.values(newReference.sizes).some(v => v > 0)) {
      setError('Por favor, completa referencia, color y al menos una talla.');
      return;
    }
    if (showEditOrder) {
      setEditOrder({
        ...editOrder,
        items: [...editOrder.items, { ...newReference }],
      });
    } else {
      setNewOrder({
        ...newOrder,
        items: [...newOrder.items, { ...newReference }],
      });
    }
    setNewReference({
      reference: '',
      color: '',
      sizes: { 34: 0, 35: 0, 36: 0, 37: 0, 38: 0, 39: 0, 40: 0, 41: 0 },
      observation: '',
      image_url: '',
      price_r: 'Precio detal',
      price_w: 'Precio mayorista',
    });
    setShowAddReference(false); // Cierra al agregar
    if (showCreateOrder) setShowCreateOrder(true); // Regresa al cuadro principal
    else if (showEditOrder) setShowEditOrder(true);
  };

  const handleCreateOrder = async () => {
    try {
      if (!user?.id) {
        setError('Error: usuario no autenticado. Por favor, inicia sesión nuevamente.');
        return;
      }
      if (!newOrder.client_name || !newOrder.deadline || newOrder.items.length === 0) {
        setError('Por favor, completa todos los campos obligatorios y agrega al menos una referencia.');
        return;
      }
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          client_name: newOrder.client_name,
          user_id: user.id,
          status: 'pending',
          items: newOrder.items,
          created_at: new Date().toISOString(),
          deadline: newOrder.deadline,
          observations: newOrder.observations,
        })
        .select('id')
        .single();
      if (orderError) throw orderError;
      const orderId = orderData.id;
      const { data: adminUsers, error: adminError } = await supabase
        .from('users')
        .select('id')
        .in('role', ['admin', 'produccion']);
      if (adminError) throw adminError;
      const notificationMessage = `Nueva orden creada: ${newOrder.client_name} (${newOrder.items.length} referencias).`;
      const notificationsToInsert = adminUsers.map(adminUser => ({
        user_id: adminUser.id,
        message: notificationMessage,
        created_at: new Date().toISOString(),
        read: false,
        order_id: orderId,
        type: 'order_created',
      }));
      const { error: notificationError } = await supabase.from('notifications').insert(notificationsToInsert);
      if (notificationError) throw notificationError;
      setNewOrder({ client_name: '', observations: '', deadline: '', items: [] });
      setShowCreateOrder(false);
      fetchOrders();
    } catch (err) {
      setError(`Error al crear pedido: ${err.message}`);
    }
  };

  const handleEditOrder = async () => {
    try {
      if (!editOrder.client_name || !editOrder.deadline || editOrder.items.length === 0) {
        setError('Por favor, completa todos los campos obligatorios y agrega al menos una referencia.');
        return;
      }
      await supabase
        .from('orders')
        .update({
          client_name: editOrder.client_name,
          deadline: editOrder.deadline,
          items: editOrder.items,
          observations: editOrder.observations,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editOrder.id);
      setShowEditOrder(false);
      setEditOrder(null);
      fetchOrders();
    } catch (err) {
      setError(`Error al editar pedido: ${err.message}`);
    }
  };

  const handleAcceptOrder = async (orderId) => {
    try {
      const { data: order, error: fetchError } = await supabase
        .from('orders')
        .select('*, users(username)')
        .eq('id', orderId)
        .single();
      if (fetchError) throw fetchError;
      await supabase
        .from('orders')
        .update({ status: 'in_process', accepted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', orderId);
      if (order.user_id) {
        const { error: notifyError } = await supabase
          .from('notifications')
          .insert({
            user_id: order.user_id,
            message: `La orden de ${order.client_name} ha pasado a "En Proceso".`,
            created_at: new Date().toISOString(),
            read: false,
            order_id: orderId,
            type: 'order_status_changed',
          });
        if (notifyError) throw notifyError;
      }
      fetchOrders();
    } catch (err) {
      setError(`Error al aceptar pedido: ${err.message}`);
    }
  };

  const handleCompleteOrder = async (orderId) => {
    try {
      const { data: order, error: fetchError } = await supabase
        .from('orders')
        .select('*, users(username)')
        .eq('id', orderId)
        .single();
      if (fetchError) throw fetchError;
      const { error } = await supabase
        .from('orders')
        .update({ status: 'completed', completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', orderId);
      if (error) throw error;
      if (order.user_id) {
        const { error: notifyError } = await supabase
          .from('notifications')
          .insert({
            user_id: order.user_id,
            message: `La orden de ${order.client_name} ha sido completada.`,
            created_at: new Date().toISOString(),
            read: false,
            order_id: orderId,
            type: 'order_status_changed',
          });
        if (notifyError) throw notifyError;
      }
      fetchOrders();
    } catch (err) {
      setError(`Error al completar pedido: ${err.message}`);
    }
  };

  const handleDeleteOrder = async (orderId) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar esta orden?')) return;
    try {
      const { error } = await supabase.from('orders').delete().eq('id', orderId);
      if (error) throw new Error(error.message);
      fetchOrders();
    } catch (err) {
      setError(`Error al eliminar pedido: ${err.message}`);
    }
  };

  const handleAddNewCustomer = async () => {
    if (!newCustomer.name || !newCustomer.document) {
      setError('El nombre y el documento son obligatorios.');
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
      setNewOrder({ ...newOrder, client_name: newCustomer.name });
      setShowCreateOrder(true);
      setError(null);
    } catch (err) {
      setError(`Error al agregar cliente: ${err.message}`);
    }
  };

  const handleSaveNewReference = async () => {
    try {
      if (!newReference.reference || !newReference.color || newReference.price_r === 'Precio detal' || newReference.price_w === 'Precio mayorista') {
        setError('La Referencia, Color, Precio Detal y Precio Mayorista son campos obligatorios.');
        return;
      }

      const { data: newProduct, error: productError } = await supabase
        .from('products')
        .insert({
          reference: newReference.reference,
          image_url: newReference.image_url,
          price_r: parseFloat(newReference.price_r),
          price_w: parseFloat(newReference.price_w),
          created_by: user ? user.id : null,
        })
        .select()
        .single();

      if (productError) throw productError;

      for (const size of sizes) {
        const stockToInsert = parseInt(newReference.sizes[size]) || 0;
        if (!isNaN(stockToInsert) && stockToInsert > 0) {
          await supabase.from('variations').insert({
            product_id: newProduct.id,
            color: newReference.color,
            size,
            stock: stockToInsert,
            barcode_code: `${newReference.reference}-${newReference.color}-${size}`,
            created_at: new Date().toISOString(),
            created_by: user ? user.id : null,
          });
        }
      }

      setReferences([...new Set([...references, newReference.reference])]);
      setColors([...new Set([...colors, newReference.color])]);
      setNewReference({
        reference: newReference.reference,
        color: '',
        sizes: { 34: 0, 35: 0, 36: 0, 37: 0, 38: 0, 39: 0, 40: 0, 41: 0 },
        observation: '',
        image_url: '',
        price_r: 'Precio detal',
        price_w: 'Precio mayorista',
      });
      setShowNewReferenceForm(false);
      setShowAddReference(true);
      setError(null);
    } catch (err) {
      setError(`Error al guardar referencia: ${err.message}`);
    }
  };

  const getDaysSinceAccepted = (acceptedAt) => {
    if (!acceptedAt) return 0;
    const diff = new Date() - new Date(acceptedAt);
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  const getDaysUntilDeadline = (deadline) => {
    if (!deadline) return 0;
    const diff = new Date(deadline) - new Date();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const getTotalPairs = (items) => {
    return items.reduce((total, item) => total + Object.values(item.sizes).reduce((a, b) => a + b, 0), 0);
  };

  return (
    <div className="bg-pear-neutral p-6">
      <h2 className="text-2xl font-bold text-pear-dark-green mb-4 flex items-center">
        <span className="mr-2">📦</span> Pedidos
      </h2>
      {error && <p className="text-red-500 mb-4">{error}</p>}

      <div className="flex space-x-4 mb-4">
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-4 py-2 rounded ${activeTab === 'pending' ? 'bg-pear-dark-green text-white shadow-md' : 'bg-gray-200'}`}
        >
          Pendientes
        </button>
        <button
          onClick={() => setActiveTab('in_process')}
          className={`px-4 py-2 rounded ${activeTab === 'in_process' ? 'bg-pear-dark-green text-white shadow-md' : 'bg-gray-200'}`}
        >
          En Proceso
        </button>
        <button
          onClick={() => setActiveTab('completed')}
          className={`px-4 py-2 rounded ${activeTab === 'completed' ? 'bg-pear-dark-green text-white shadow-md' : 'bg-gray-200'}`}
        >
          Completados
        </button>
        {user?.role !== 'lector' && (
          <button
            onClick={() => setShowCreateOrder(true)}
            className="bg-pear-dark-green text-white p-2 rounded hover:bg-pear-green transition ml-auto"
          >
            Crear Orden
          </button>
        )}
      </div>

      <div className="flex flex-wrap justify-between mb-4 gap-2">
        <div className="flex items-center space-x-2">
          <input
            type="text"
            name="search"
            placeholder="Filtrar por Nombre del Cliente o Referencia"
            value={filters.search}
            onChange={handleFilterChange}
            className="p-2 border border-gray-300 rounded w-64"
          />
          <input
            type="date"
            name="created_at"
            value={filters.created_at}
            onChange={handleFilterChange}
            className="p-2 border border-gray-300 rounded"
          />
          <button
            onClick={handleClearFilters}
            className="bg-gray-300 text-pear-dark px-4 py-2 rounded hover:bg-gray-400"
          >
            Limpiar Filtros
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredOrders.map((order, index) => (
          <div key={index} className="bg-white p-4 rounded-lg shadow-md">
            {order.user_id === null || order.client_name === 'Stock' ? (
              <div
                className="cursor-pointer"
                onClick={() => setShowOrderDetails(order)}
              >
                <h3 className="text-lg font-bold text-pear-dark-green">Ref: {order.item.reference}</h3>
                <p className="text-pear-dark">Color: {order.item.color}</p>
                <p className="text-pear-dark">
                  Tallas: {Object.entries(order.item.sizes)
                    .filter(([_, stock]) => stock > 0)
                    .map(([size, stock]) => `${size}: ${stock}`)
                    .join(', ')}
                </p>
                <p className="text-pear-dark">Cliente: {order.client_name}</p>
                <p className="text-pear-dark">Creado: {new Date(order.created_at).toLocaleDateString()}</p>
                <p className="text-pear-dark">Límite: {new Date(order.deadline).toLocaleDateString()}</p>
                {order.status === 'in_process' && (
                  <>
                    <p className="text-pear-dark">Días transcurridos: {getDaysSinceAccepted(order.accepted_at)}</p>
                    <p className="text-pear-dark">Días restantes: {getDaysUntilDeadline(order.deadline)}</p>
                  </>
                )}
              </div>
            ) : (
              <div
                className="cursor-pointer"
                onClick={() => setShowOrderDetails(order)}
              >
                <h3 className="text-lg font-bold text-pear-dark-green">{order.client_name}</h3>
                <p className="text-pear-dark">Total Referencias: {order.items.length}</p>
                <p className="text-pear-dark">Total Pares: {getTotalPairs(order.items)}</p>
                <p className="text-pear-dark">Usuario: {order.users?.username || 'Desconocido'}</p>
                <p className="text-pear-dark">Creado: {new Date(order.created_at).toLocaleDateString()}</p>
                <p className="text-pear-dark">Límite: {new Date(order.deadline).toLocaleDateString()}</p>
                {order.status === 'in_process' && (
                  <>
                    <p className="text-pear-dark">Días transcurridos: {getDaysSinceAccepted(order.accepted_at)}</p>
                    <p className="text-pear-dark">Días restantes: {getDaysUntilDeadline(order.deadline)}</p>
                  </>
                )}
              </div>
            )}
            {user?.role !== 'lector' && (
              <div className="flex justify-end space-x-2 mt-2">
                {['admin', 'produccion'].includes(user?.role) && (
                  <button
                    onClick={() => handleDeleteOrder(order.id)}
                    className="bg-red-500 text-white px-2 py-1 rounded"
                  >
                    Eliminar
                  </button>
                )}
                {order.status === 'pending' && ['admin', 'produccion'].includes(user?.role) && (
                  <button
                    onClick={() => handleAcceptOrder(order.id)}
                    className="bg-pear-dark-green text-white px-2 py-1 rounded"
                  >
                    Aceptar
                  </button>
                )}
                {order.status === 'pending' && order.client_name !== 'Stock' && order.user_id === user?.id && (
                  <button
                    onClick={() => {
                      setEditOrder(order);
                      setShowEditOrder(true);
                    }}
                    className="bg-pear-dark-green text-white px-3 py-1.5 rounded hover:bg-pear-green transition"
                  >
                    Editar
                  </button>
                )}
                {order.status === 'in_process' && ['admin', 'produccion'].includes(user?.role) && (
                  <button
                    onClick={() => handleCompleteOrder(order.id)}
                    className="bg-blue-500 text-white px-2 py-1 rounded"
                  >
                    Completado
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {showCreateOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40">
          <div className="bg-white p-6 rounded-lg w-full max-w-lg">
            <h3 className="text-xl font-bold text-pear-dark-green mb-4">Crear Nueva Orden</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-pear-dark">Nombre del Cliente</label>
                <input
                  type="text"
                  value={newOrder.client_name}
                  onChange={(e) => setNewOrder({ ...newOrder, client_name: e.target.value })}
                  list="customer-suggestions"
                  className="w-full p-2 border border-pear-green rounded"
                  required
                />
                <datalist id="customer-suggestions">
                  {customers.map(customer => (
                    <option key={customer.id} value={customer.name} />
                  ))}
                </datalist>
                <button
                  onClick={() => { setShowCreateOrder(false); setShowNewCustomerForm(true); }}
                  className="mt-2 text-sm text-blue-500 underline"
                >
                  + Crear Cliente
                </button>
              </div>
              <div>
                <label className="block text-pear-dark">Fecha Límite</label>
                <input
                  type="date"
                  value={newOrder.deadline}
                  onChange={(e) => setNewOrder({ ...newOrder, deadline: e.target.value })}
                  className="w-full p-2 border border-pear-green rounded"
                  required
                />
              </div>
              <div>
                <label className="block text-pear-dark">Observaciones Generales</label>
                <textarea
                  value={newOrder.observations}
                  onChange={(e) => setNewOrder({ ...newOrder, observations: e.target.value })}
                  className="w-full p-2 border border-pear-green rounded"
                />
              </div>
              <div>
                <h4 className="text-lg font-bold text-pear-dark mb-2">Referencias Agregadas</h4>
                {newOrder.items.length === 0 ? (
                  <p className="text-pear-dark">No hay referencias agregadas.</p>
                ) : (
                  <div className="border rounded">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-pear-light-green">
                          <th className="p-2">Referencia</th>
                          <th className="p-2">Color</th>
                          <th className="p-2">Tallas</th>
                          <th className="p-2">Observación</th>
                          <th className="p-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {newOrder.items.map((item, index) => (
                          <tr key={index} className="border-t">
                            <td className="p-2">{item.reference}</td>
                            <td className="p-2">{item.color}</td>
                            <td className="p-2">
                              {Object.entries(item.sizes)
                                .filter(([_, stock]) => stock > 0)
                                .map(([size, stock]) => `${size}: ${stock}`)
                                .join(', ')}
                            </td>
                            <td className="p-2">{item.observation || 'N/A'}</td>
                            <td className="p-2">
                              <button
                                onClick={() => {
                                  const updatedItems = newOrder.items.filter((_, i) => i !== index);
                                  setNewOrder({ ...newOrder, items: updatedItems });
                                }}
                                className="bg-red-500 text-white px-2 py-1 rounded"
                              >
                                Eliminar
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <button
                  onClick={() => { setShowAddReference(true); }}
                  className="mt-2 bg-pear-dark-green text-white p-2 rounded hover:bg-pear-green"
                >
                  + Agregar Referencia
                </button>
              </div>
            </div>
            <div className="flex justify-end space-x-2 mt-4">
              <button
                onClick={() => setShowCreateOrder(false)}
                className="bg-gray-300 px-4 py-2 rounded"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateOrder}
                className="bg-pear-dark-green text-white px-4 py-2 rounded"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {showNewCustomerForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
            <h3 className="text-xl font-bold mb-4 text-pear-dark-green">Nuevo Cliente</h3>
            {error && <p className="text-red-500 mb-4">{error}</p>}
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
              <button onClick={() => { setShowNewCustomerForm(false); setShowCreateOrder(true); }} className="bg-gray-300 text-pear-dark px-4 py-2 rounded hover:bg-gray-400">
                Cancelar
              </button>
              <button onClick={handleAddNewCustomer} className="bg-pear-dark-green text-white px-4 py-2 rounded hover:bg-pear-green">
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditOrder && editOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-lg">
            <h3 className="text-xl font-bold text-pear-dark-green mb-4">Editar Orden</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-pear-dark">Nombre del Cliente</label>
                <input
                  type="text"
                  value={editOrder.client_name}
                  onChange={(e) => setEditOrder({ ...editOrder, client_name: e.target.value })}
                  className="w-full p-2 border border-pear-green rounded"
                  required
                />
              </div>
              <div>
                <label className="block text-pear-dark">Fecha Límite</label>
                <input
                  type="date"
                  value={editOrder.deadline}
                  onChange={(e) => setEditOrder({ ...editOrder, deadline: e.target.value })}
                  className="w-full p-2 border border-pear-green rounded"
                  required
                />
              </div>
              <div>
                <label className="block text-pear-dark">Observaciones Generales</label>
                <textarea
                  value={editOrder.observations}
                  onChange={(e) => setEditOrder({ ...editOrder, observations: e.target.value })}
                  className="w-full p-2 border border-pear-green rounded"
                />
              </div>
              <div>
                <h4 className="text-lg font-bold text-pear-dark mb-2">Referencias Agregadas</h4>
                {editOrder.items.length === 0 ? (
                  <p className="text-pear-dark">No hay referencias agregadas.</p>
                ) : (
                  <div className="border rounded">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-pear-light-green">
                          <th className="p-2">Referencia</th>
                          <th className="p-2">Color</th>
                          <th className="p-2">Tallas</th>
                          <th className="p-2">Observación</th>
                          <th className="p-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {editOrder.items.map((item, index) => (
                          <tr key={index} className="border-t">
                            <td className="p-2">{item.reference}</td>
                            <td className="p-2">{item.color}</td>
                            <td className="p-2">
                              {Object.entries(item.sizes)
                                .filter(([_, stock]) => stock > 0)
                                .map(([size, stock]) => `${size}: ${stock}`)
                                .join(', ')}
                            </td>
                            <td className="p-2">{item.observation || 'N/A'}</td>
                            <td className="p-2">
                              <button
                                onClick={() => {
                                  const updatedItems = editOrder.items.filter((_, i) => i !== index);
                                  setEditOrder({ ...editOrder, items: updatedItems });
                                }}
                                className="bg-red-500 text-white px-2 py-1 rounded"
                              >
                                Eliminar
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <button
                  onClick={() => { setShowAddReference(true); }}
                  className="mt-2 bg-pear-dark-green text-white p-2 rounded hover:bg-pear-green"
                >
                  + Agregar Referencia
                </button>
              </div>
            </div>
            <div className="flex justify-end space-x-2 mt-4">
              <button
                onClick={() => {
                  setShowEditOrder(false);
                  setEditOrder(null);
                }}
                className="bg-gray-300 px-4 py-2 rounded"
              >
                Cancelar
              </button>
              <button
                onClick={handleEditOrder}
                className="bg-pear-dark-green text-white px-4 py-2 rounded"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddReference && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"> {/* z-60 para estar adelante */}
          <div className="bg-white p-6 rounded-lg w-full max-w-4xl">
            <h3 className="text-xl font-bold text-pear-dark-green mb-4">Agregar Referencia</h3>
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <div className="flex-1">
                  <label className="block text-pear-dark">Referencia</label>
                  <select
                    value={newReference.reference}
                    onChange={(e) => setNewReference({ ...newReference, reference: e.target.value })}
                    className="w-full p-2 border border-pear-green rounded text-sm"
                  >
                    <option value="">Selecciona una referencia</option>
                    {references.map(ref => (
                      <option key={ref} value={ref}>{ref}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => { setShowAddReference(false); setShowNewReferenceForm(true); }}
                    className="mt-2 text-sm text-blue-500 underline"
                  >
                    + Crear Referencia
                  </button>
                </div>
                <div className="flex-1">
                  <label className="block text-pear-dark">Color</label>
                  <input
                    type="text"
                    value={newReference.color}
                    onChange={(e) => setNewReference({ ...newReference, color: e.target.value })}
                    list="color-suggestions"
                    className="w-full p-2 border border-pear-green rounded text-sm"
                  />
                  <datalist id="color-suggestions">
                    {colors.map(color => (
                      <option key={color} value={color} />
                    ))}
                  </datalist>
                </div>
              </div>
              <div>
                <label className="block text-pear-dark mb-2">Tallas</label>
                <div className="flex space-x-2">
                  {sizes.map(size => (
                    <div key={size} className="flex flex-col items-center">
                      <label className="text-pear-dark text-sm mb-1">{size}</label>
                      <input
                        type="number"
                        value={newReference.sizes[size]}
                        onChange={(e) => {
                          setNewReference({
                            ...newReference,
                            sizes: { ...newReference.sizes, [size]: parseInt(e.target.value) || 0 },
                          });
                        }}
                        className="w-12 p-1 border border-pear-green rounded text-sm text-center"
                        min="0"
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-pear-dark">Observación</label>
                <textarea
                  value={newReference.observation}
                  onChange={(e) => setNewReference({ ...newReference, observation: e.target.value })}
                  className="w-full p-2 border border-pear-green rounded text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-2 mt-4">
              <button
                onClick={() => { setShowAddReference(false); if (showCreateOrder) setShowCreateOrder(true); else if (showEditOrder) setShowEditOrder(true); }}
                className="bg-gray-300 px-4 py-2 rounded text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddReference}
                className="bg-pear-dark-green text-white px-4 py-2 rounded text-sm"
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}

      {showNewReferenceForm && (
  <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-40">
    <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl max-h-[80vh] overflow-y-auto">
      <h2 className="text-xl font-bold mb-4 text-pear-dark">Nueva Referencia</h2>
      <div className="space-y-4">
        <input
          type="text"
          placeholder="URL de la imagen"
          value={newReference.image_url}
          onChange={(e) => setNewReference({ ...newReference, image_url: e.target.value })}
          className="w-full p-2 border border-gray-300 rounded"
        />
        <input
          type="text"
          placeholder="Referencia"
          value={newReference.reference}
          onChange={(e) => setNewReference({ ...newReference, reference: e.target.value })}
          className="w-full p-2 border border-gray-300 rounded"
        />
        <input
          type="text"
          placeholder="Color"
          value={newReference.color}
          onChange={(e) => setNewReference({ ...newReference, color: e.target.value })}
          className="w-full p-2 border border-gray-300 rounded"
        />
        <input
          type="number"
          placeholder="Precio detal"
          value={newReference.price_r === 'Precio detal' ? '' : newReference.price_r}
          onChange={(e) => setNewReference({ ...newReference, price_r: e.target.value || 'Precio detal' })}
          className="w-full p-2 border border-gray-300 rounded"
        />
        <input
          type="number"
          placeholder="Precio mayorista"
          value={newReference.price_w === 'Precio mayorista' ? '' : newReference.price_w}
          onChange={(e) => setNewReference({ ...newReference, price_w: e.target.value || 'Precio mayorista' })}
          className="w-full p-2 border border-gray-300 rounded"
        />
        <div className="grid grid-cols-8 gap-2">
          {sizes.map((size) => (
            <div key={size} className="flex flex-col items-center">
              <label className="block text-pear-dark sm:text-xs font-medium">T{size}</label>
              <input
                type="number"
                value={newReference.sizes[size]}
                onChange={(e) =>
                  setNewReference({
                    ...newReference,
                    sizes: { ...newReference.sizes, [size]: parseInt(e.target.value) || 0 },
                  })
                }
                className="w-full p-1 border border-gray-300 rounded text-sm text-center"
              />
            </div>
          ))}
        </div>
      </div>
      <div className="flex justify-end space-x-2 mt-4">
        <button
          onClick={() => { setShowNewReferenceForm(false); setShowAddReference(true); }}
          className="bg-gray-300 px-4 py-2 rounded"
        >
          Cancelar
        </button>
        <button
          onClick={handleSaveNewReference}
          className="bg-pear-dark-green text-white px-4 py-2 rounded"
        >
          Guardar
        </button>
      </div>
    </div>
  </div>
)}

      {showOrderDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-lg">
            <h3 className="text-xl font-bold text-pear-dark-green mb-4">Detalles del Pedido</h3>
            <p><strong>Cliente:</strong> {showOrderDetails.client_name}</p>
            <p><strong>Usuario:</strong> {showOrderDetails.user_id ? showOrderDetails.users?.username || 'Desconocido' : 'Sistema'}</p>
            <p><strong>Fecha de Creación:</strong> {new Date(showOrderDetails.created_at).toLocaleDateString()}</p>
            <p><strong>Fecha Límite:</strong> {new Date(showOrderDetails.deadline).toLocaleDateString()}</p>
            {showOrderDetails.status === 'in_process' && (
              <>
                <p><strong>Fecha de Inicio:</strong> {new Date(showOrderDetails.accepted_at).toLocaleDateString()}</p>
                <p><strong>Días Transcurridos:</strong> {getDaysSinceAccepted(showOrderDetails.accepted_at)}</p>
                <p><strong>Días Restantes:</strong> {getDaysUntilDeadline(showOrderDetails.deadline)}</p>
              </>
            )}
            {showOrderDetails.status === 'completed' && (
              <p><strong>Fecha de Completado:</strong> {new Date(showOrderDetails.completed_at).toLocaleDateString()}</p>
            )}
            <p><strong>Observaciones:</strong> {showOrderDetails.observations || 'N/A'}</p>
            <h4 className="text-lg font-bold mt-4">Referencias Solicitadas</h4>
            {showOrderDetails.items.map((item, index) => (
              <div key={index} className="border p-2 rounded mt-2">
                <p><strong>Referencia:</strong> {item.reference}</p>
                <p><strong>Color:</strong> {item.color}</p>
                <p><strong>Tallas:</strong> {Object.entries(item.sizes)
                  .filter(([_, stock]) => stock > 0)
                  .map(([size, stock]) => `${size}: ${stock}`)
                  .join(', ')}</p>
                <p><strong>Observación:</strong> {item.observation || 'N/A'}</p>
              </div>
            ))}
            <div className="flex justify-end space-x-2 mt-4">
              <button
                onClick={() => setShowOrderDetails(null)}
                className="bg-gray-300 px-4 py-2 rounded"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Orders;