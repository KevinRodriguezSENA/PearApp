// DOCUMENT filename="Customers.jsx"
import React, { useState, useEffect } from 'react';
import supabase from '../supabaseClient';

function Customers({ setError, errorMessage }) {
  const [customers, setCustomers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    document: '',
    phone: '',
    city: '',
    address: '',
    notes: '',
  });

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase.from('customers').select(`
        *,
        sales (
          id,
          created_at,
          status
        )
      `);
      if (error) throw error;
      setCustomers(data);
    } catch (err) {
      setError(`Error al obtener clientes: ${err.message}`);
    }
  };

  const handleSaveCustomer = async () => {
    try {
      if (editingCustomer) {
        await supabase
          .from('customers')
          .update(newCustomer)
          .eq('id', editingCustomer.id);
      } else {
        await supabase.from('customers').insert(newCustomer);
      }
      setShowForm(false);
      setEditingCustomer(null);
      setNewCustomer({ name: '', document: '', phone: '', city: '', address: '', notes: '' });
      fetchCustomers();
    } catch (err) {
      setError(`Error al guardar cliente: ${err.message}`);
    }
  };

  const handleDeleteCustomer = async (id) => {
    if (!window.confirm('¿Está seguro de eliminar este cliente?')) return;
    try {
      await supabase.from('customers').delete().eq('id', id);
      fetchCustomers();
    } catch (err) {
      setError(`Error al eliminar cliente: ${err.message}`);
    }
  };

  return (
    <div className="bg-pear-neutral p-6">
      <h2 className="text-2xl font-bold text-pear-dark-green mb-4 flex items-center">
        <span className="mr-2">👥</span> Gestión de Clientes
      </h2>
      {errorMessage && <p className="text-red-500 mb-4">{errorMessage}</p>}
      <button
        onClick={() => {
          setEditingCustomer(null);
          setNewCustomer({ name: '', document: '', phone: '', city: '', address: '', notes: '' });
          setShowForm(true);
        }}
        className="bg-pear-dark-green text-white px-4 py-2 rounded hover:bg-pear-green mb-4"
      >
        + Nuevo Cliente
      </button>

      <table className="w-full border-collapse bg-white rounded-lg shadow-md">
        <thead>
          <tr className="bg-pear-green text-white">
            <th className="border p-2">Nombre</th>
            <th className="border p-2">CC o NIT</th>
            <th className="border p-2">Teléfono</th>
            <th className="border p-2">Ciudad</th>
            <th className="border p-2">Dirección</th>
            <th className="border p-2">Última Venta</th>
            <th className="border p-2">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {customers.map((customer) => {
            const lastSale = customer.sales
              .filter(sale => sale.status === 'confirmed')
              .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
            return (
              <tr key={customer.id} className="border-t">
                <td className="border p-2">{customer.name}</td>
                <td className="border p-2">{customer.document}</td>
                <td className="border p-2">{customer.phone || 'N/A'}</td>
                <td className="border p-2">{customer.city || 'N/A'}</td>
                <td className="border p-2">{customer.address || 'N/A'}</td>
                <td className="border p-2">
                  {lastSale ? new Date(lastSale.created_at).toLocaleDateString() : 'N/A'}
                </td>
                <td className="border p-2">
                  <button
                    onClick={() => {
                      setEditingCustomer(customer);
                      setNewCustomer({
                        name: customer.name,
                        document: customer.document,
                        phone: customer.phone,
                        city: customer.city,
                        address: customer.address,
                        notes: customer.notes,
                      });
                      setShowForm(true);
                    }}
                    className="bg-blue-500 text-white px-2 py-1 rounded mr-2"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDeleteCustomer(customer.id)}
                    className="bg-red-500 text-white px-2 py-1 rounded"
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {showForm && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-[400px]">
            <h2 className="text-xl font-bold mb-4 text-pear-dark">
              {editingCustomer ? 'Editar Cliente' : 'Nuevo Cliente'}
            </h2>
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Nombre completo"
                value={newCustomer.name}
                onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                className="w-full p-2 border border-gray-300 rounded"
              />
              <input
                type="text"
                placeholder="CC o NIT"
                value={newCustomer.document}
                onChange={(e) => setNewCustomer({ ...newCustomer, document: e.target.value })}
                className="w-full p-2 border border-gray-300 rounded"
              />
              <input
                type="text"
                placeholder="Teléfono"
                value={newCustomer.phone}
                onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                className="w-full p-2 border border-gray-300 rounded"
              />
              <input
                type="text"
                placeholder="Ciudad"
                value={newCustomer.city}
                onChange={(e) => setNewCustomer({ ...newCustomer, city: e.target.value })}
                className="w-full p-2 border border-gray-300 rounded"
              />
              <input
                type="text"
                placeholder="Dirección"
                value={newCustomer.address}
                onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                className="w-full p-2 border border-gray-300 rounded"
              />
              <textarea
                placeholder="Observaciones"
                value={newCustomer.notes}
                onChange={(e) => setNewCustomer({ ...newCustomer, notes: e.target.value })}
                className="w-full p-2 border border-gray-300 rounded"
              />
            </div>
            <div className="flex justify-end space-x-2 mt-4">
              <button
                onClick={() => setShowForm(false)}
                className="bg-gray-300 px-4 py-2 rounded"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveCustomer}
                className="bg-pear-dark-green text-white px-4 py-2 rounded"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Customers;