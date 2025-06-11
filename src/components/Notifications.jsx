import React, { useState, useEffect } from 'react';
import supabase from '../supabaseClient';
import { useNavigate } from 'react-router-dom';

function Notifications({ user, setError, setActiveModule }) {
  const [notifications, setNotifications] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user?.id) return; // Asegúrate de que el usuario exista antes de proceder

    // Consulta inicial
    fetchNotifications();

    // Suscripción en tiempo real
    const subscription = supabase
      .channel(`notifications:user:${user.id}`) // Canal único por usuario
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`, // Filtra por user_id
        },
        (payload) => {
          setNotifications((prev) => [payload.new, ...prev]); // Agrega la nueva notificación
        }
      )
      .subscribe();

    return () => subscription.unsubscribe();
  }, [user?.id]);

  const fetchNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*') // Simplifica la consulta, no necesitamos la relación con users
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setNotifications(data || []);
    } catch (err) {
      setError(`Error al obtener notificaciones: ${err.message}`);
    }
  };

  const markAsRead = async (id) => {
  try {
    await supabase.from('notifications').delete().eq('id', id); // Elimina la notificación de la base de datos
    setNotifications((prev) => prev.filter((notif) => notif.id !== id)); // Actualiza el estado local
  } catch (err) {
    setError(`Error al eliminar notificación: ${err.message}`);
  }
};

  const handleAcceptSale = async (notification) => {
    try {
      const { error: saleError } = await supabase
        .from('sales')
        .update({ status: 'confirmed', approved_by: user.id, approved_at: new Date().toISOString() })
        .eq('id', notification.sale_id);
      if (saleError) throw saleError;

      const { data: sale, error: saleFetchError } = await supabase
        .from('sales')
        .select('*, customers(name), created_by_users: users!sales_created_by_fkey(username)')
        .eq('id', notification.sale_id)
        .single();
      if (saleFetchError) throw saleFetchError;

      const { error: notifyCreatorError } = await supabase
        .from('notifications')
        .insert({
          user_id: sale.created_by,
          message: `La venta de ${sale.customers.name} ya fue confirmada por ${user.username}.`,
          created_at: new Date().toISOString(),
          read: false,
          sale_id: notification.sale_id,
          type: 'sale_confirmed',
        });
      if (notifyCreatorError) throw notifyCreatorError;

      await supabase.from('notifications').delete().eq('id', notification.id);
      fetchNotifications();
    } catch (err) {
      setError(`Error al aceptar venta: ${err.message}`);
    }
  };

  const handleRejectSale = async (notification) => {
    try {
      const { data: saleItems, error: itemsError } = await supabase
        .from('sale_items')
        .select('*')
        .eq('sale_id', notification.sale_id);
      if (itemsError) throw itemsError;

      for (const item of saleItems) {
        const { data: product, error: productError } = await supabase
          .from('products')
          .select('id')
          .eq('reference', item.reference)
          .single();
        if (productError) throw productError;

        const { data: variation, error: variationError } = await supabase
          .from('variations')
          .select('id, stock')
          .eq('product_id', product.id)
          .eq('color', item.color)
          .eq('size', item.size)
          .single();
        if (variationError) throw variationError;

        const { error: stockError } = await supabase
          .from('variations')
          .update({ stock: variation.stock + item.quantity })
          .eq('id', variation.id);
        if (stockError) throw stockError;
      }

      await supabase.from('sale_items').delete().eq('sale_id', notification.sale_id);
      await supabase.from('sales').delete().eq('id', notification.sale_id);

      await supabase.from('notifications').delete().eq('id', notification.id);
      fetchNotifications();
    } catch (err) {
      setError(`Error al rechazar venta: ${err.message}`);
    }
  };

  const handleOrderNotificationClick = async (notification) => {
    try {
      await supabase.from('notifications').update({ read: true }).eq('id', notification.id);
      setActiveModule('orders'); // Cambia a 'orders' en minúsculas para que coincida con el módulo
      navigate('/');
      fetchNotifications();
    } catch (err) {
      setError(`Error al manejar notificación: ${err.message}`);
    }
  };

  return (
    <div className="p-4 max-h-96 overflow-y-auto">
      <h3 className="text-lg font-bold mb-2 text-pear-dark">Notificaciones</h3>
      {notifications.length === 0 ? (
        <p className="text-pear-dark">No hay notificaciones.</p>
      ) : (
        notifications.map((notification) => (
          <div
            key={notification.id}
            className={`p-2 mb-2 rounded ${notification.read ? 'bg-gray-100' : 'bg-yellow-100'}`}
          >
            <p className="text-pear-dark">{notification.message}</p>
            <p className="text-sm text-gray-500">
              {new Date(notification.created_at).toLocaleString()}
            </p>
            <div className="flex space-x-2 mt-1">
              {!notification.read && notification.type === 'sale_pending' && ['admin', 'produccion'].includes(user?.role) && (
                <>
                  <button
                    onClick={() => handleAcceptSale(notification)}
                    className="bg-green-500 text-white px-2 py-1 rounded text-sm"
                    style={{ backgroundColor: '#38a169' }} // Forzará el verde aunque haya conflictos de herencia
                  >
                    ✓ Aceptar
                  </button>
                  <button
                    onClick={() => handleRejectSale(notification)}
                    className="bg-red-500 text-white px-2 py-1 rounded text-sm"
                  >
                    ✗ Rechazar
                  </button>
                </>
              )}
              {!notification.read && notification.type === 'order_created' && (
                <button
                  onClick={() => handleOrderNotificationClick(notification)}
                  className="bg-blue-500 text-white px-2 py-1 rounded text-sm"
                >
                  Ver Pedido
                </button>
              )}
              {!notification.read && (
                <button
                  onClick={() => markAsRead(notification.id)}
                  className="bg-pear-dark-green text-white px-2 py-1 rounded text-sm"
                >
                  Marcar como leído
                </button>
              )}
              {notification.sale_id && notification.type !== 'sale_pending' && (
                <button
                  onClick={() => {
                    setActiveModule('sales'); // Cambia a 'sales' en minúsculas
                    navigate('/');
                  }}
                  className="bg-blue-500 text-white px-2 py-1 rounded text-sm"
                >
                  Ver Venta
                </button>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export default Notifications;