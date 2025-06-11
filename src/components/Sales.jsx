// DOCUMENT filename="Sales.jsx"
import React, { useState, useEffect } from 'react';
import supabase from '../supabaseClient';

function Sales({ user, setError, errorMessage }) {
  const [sales, setSales] = useState([]);
  const [filters, setFilters] = useState({ customer: '', date: '', created_by: '', approved_by: '' });
  const [selectedSale, setSelectedSale] = useState(null);

  useEffect(() => {
    fetchSales();
  }, []);

  const fetchSales = async () => {
    try {
      // ARREGLO 1: Se incluyen los `sale_items` en la consulta para obtener los detalles.
      const { data, error } = await supabase
        .from('sales')
        .select(`
          *,
          customers (name),
          created_by_users: users!sales_created_by_fkey (username),
          approved_by_users: users!sales_approved_by_fkey (username),
          sale_items (*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSales(data);
    } catch (err) {
      setError(`Error al obtener ventas: ${err.message}`);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters({ ...filters, [name]: value });
  };

  const applyFilters = () => {
    let filtered = [...sales];
    if (filters.customer) {
      filtered = filtered.filter(sale => 
        sale.customers?.name.toLowerCase().includes(filters.customer.toLowerCase())
      );
    }
    if (filters.date) {
      filtered = filtered.filter(sale => 
        new Date(sale.created_at).toLocaleDateString() === new Date(filters.date).toLocaleDateString()
      );
    }
    if (filters.created_by) {
      filtered = filtered.filter(sale => 
        sale.created_by_users?.username?.toLowerCase().includes(filters.created_by.toLowerCase())
      );
    }
    if (filters.approved_by) {
      filtered = filtered.filter(sale => 
        sale.approved_by_users?.username?.toLowerCase().includes(filters.approved_by.toLowerCase())
      );
    }
    return filtered;
  };

  const handleApproveSale = async (saleId) => {
    if (!window.confirm('¿Aprobar esta venta?')) return;
    try {
      await supabase
        .from('sales')
        .update({ approved_by: user.id, approved_at: new Date().toISOString(), status: 'confirmed' })
        .eq('id', saleId);
      fetchSales();
    } catch (err) {
      setError(`Error al aprobar venta: ${err.message}`);
    }
  };

  const handleDeleteSale = async (saleId) => {
    if (!window.confirm('¿Eliminar esta venta? Esta acción no se puede deshacer.')) return;
    try {
      await supabase.from('sale_items').delete().eq('sale_id', saleId);
      await supabase.from('notifications').delete().eq('sale_id', saleId);
      await supabase.from('sales').delete().eq('id', saleId);
      
      setSelectedSale(null);
      fetchSales();
    } catch (err) {
      setError(`Error al eliminar venta: ${err.message}`);
    }
  };

  const filteredSales = applyFilters();

  return (
    <div className="bg-pear-neutral p-6">
      <h2 className="text-2xl font-bold text-pear-dark-green mb-4 flex items-center">
        <span className="mr-2">💰</span> Historial de Ventas
      </h2>
      {errorMessage && <p className="text-red-500 mb-4">{errorMessage}</p>}
      
      {!selectedSale ? (
        <>
          <div className="mb-4 space-y-2">
        <input
          type="text"
          name="customer"
          placeholder="Filtrar por cliente"
          value={filters.customer}
          onChange={handleFilterChange}
          className="p-2 border border-gray-300 rounded w-1/4"
        />
        <input
          type="date"
          name="date"
          value={filters.date}
          onChange={handleFilterChange}
          className="p-2 border border-gray-300 rounded w-1/4"
        />
        <input
          type="text"
          name="created_by"
          placeholder="Creado por"
          value={filters.created_by}
          onChange={handleFilterChange}
          className="p-2 border border-gray-300 rounded w-1/4"
        />
        <input
          type="text"
          name="approved_by"
          placeholder="Aprobado por"
          value={filters.approved_by}
          onChange={handleFilterChange}
          className="p-2 border border-gray-300 rounded w-1/4"
        />
      </div>
          
          <table className="w-full border-collapse bg-white rounded-lg shadow-md">
            <thead>
              <tr className="bg-pear-green text-white">
                <th className="border p-2">Cliente</th>
                <th className="border p-2">Vendedor</th>
                <th className="border p-2">Aprobado por</th>
                <th className="border p-2">Fecha</th>
                <th className="border p-2">Total</th>
                <th className="border p-2">Estado</th>
                <th className="border p-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredSales.map(sale => (
                <tr key={sale.id} className="border-t">
                  <td className="border p-2">{sale.customers?.name || 'Cliente no encontrado'}</td>
                  <td className="border p-2">{sale.created_by_users?.username || 'N/A'}</td>
                  <td className="border p-2">{sale.approved_by_users?.username || 'N/A'}</td>
                  <td className="border p-2">{new Date(sale.created_at).toLocaleDateString()}</td>
                  <td className="border p-2">${sale.total_value.toFixed(2)}</td>
                  <td className="border p-2">{sale.status}</td>
                  <td className="border p-2">
                    <button
                      onClick={() => setSelectedSale(sale)}
                      className="bg-blue-500 text-white px-2 py-1 rounded mr-2"
                    >
                      Ver
                    </button>
                    {/* ARREGLO 2: Se elimina el rol 'vendedor' de esta condición */}
                    {['admin'].includes(user?.role) && (
                      <button
                        onClick={() => handleDeleteSale(sale.id)}
                        className="bg-red-500 text-white px-2 py-1 rounded mr-2"
                      >
                        Eliminar
                      </button>
                    )}
                    {['admin'].includes(user?.role) && sale.status === 'pending' && (
                    <button
                      onClick={() => handleApproveSale(sale.id)}
                      className="bg-green-600 hover:bg-green-700 text-white font-medium px-3 py-1 rounded shadow"
                      style={{ backgroundColor: '#38a169' }} // Forzar el verde aunque haya conflictos de herencia
                    >
                      Aprobar
                    </button>
                  )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <h3 className="text-xl font-bold mb-4 text-pear-dark">Detalles de Venta</h3>
          <div className="grid grid-cols-2 gap-4">
            <p><strong>Cliente:</strong> {selectedSale.customers?.name || 'Cliente no encontrado'}</p>
            <p><strong>Vendedor:</strong> {selectedSale.created_by_users?.username || 'N/A'}</p>
            <p><strong>Aprobado por:</strong> {selectedSale.approved_by_users?.username || 'N/A'}</p>
            <p><strong>Fecha:</strong> {new Date(selectedSale.created_at).toLocaleDateString()}</p>
            <p><strong>Total:</strong> ${selectedSale.total_value.toFixed(2)}</p>
            <p><strong>Estado:</strong> {selectedSale.status}</p>
          </div>
          <h4 className="text-lg font-semibold mt-4">Items:</h4>
          <table className="w-full mt-2 border-collapse">
            <thead>
              <tr className="bg-pear-green text-white">
                <th className="border p-2">Referencia</th>
                <th className="border p-2">Color</th>
                <th className="border p-2">Talla</th>
                <th className="border p-2">Cantidad</th>
                <th className="border p-2">Precio Unit.</th>
                <th className="border p-2">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {selectedSale.sale_items?.length > 0 ? (
                selectedSale.sale_items.map(item => (
                  <tr key={item.id} className="border-t">
                    <td className="border p-2">{item.reference}</td>
                    <td className="border p-2">{item.color}</td>
                    <td className="border p-2">{item.size}</td>
                    <td className="border p-2">{item.quantity}</td>
                    <td className="border p-2">${item.unit_price.toFixed(2)}</td>
                    <td className="border p-2">${item.subtotal.toFixed(2)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="text-center p-4">No hay items para esta venta.</td>
                </tr>
              )}
            </tbody>
          </table>
          <button
            onClick={() => setSelectedSale(null)}
            className="bg-pear-dark-green text-white px-4 py-2 rounded mt-4"
          >
            Volver
          </button>
        </div>
      )}
    </div>
  );
}

export default Sales;