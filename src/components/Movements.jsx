import React, { useEffect, useState } from 'react';
import supabase from '../supabaseClient';

function Movements() {
  const [movements, setMovements] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchMovements();
  }, []);

  const fetchMovements = async () => {
    try {
      // Consultar solo los movimientos, incluyendo user_id
      const { data: movementsData, error: movementsError } = await supabase
        .from('inventory_movements') // Usar la tabla correcta inventory_movements
        .select('*')
        .order('timestamp', { ascending: false }); // Cambiado de 'id' a 'timestamp'

      if (movementsError) {
        console.error('Error fetching movements:', movementsError);
        setError(`Error al obtener movimientos: ${movementsError.message}`);
        setMovements([]);
        return;
      }

      if (!movementsData) {
        setMovements([]);
        return;
      }

      // Obtener nombres de usuario para cada user_id único
      const userIds = [...new Set(movementsData.map(movement => movement.user_id).filter(id => id !== null))];
      const { data: usersData, error: usersError } = await supabase
        .from('users') // Asumiendo que la tabla de perfiles se llama 'users'
        .select('id, username')
        .in('id', userIds);

      if (usersError) {
        console.error('Error fetching users:', usersError);
        // Continuar sin nombres de usuario si hay un error al obtenerlos
        const movementsWithDetails = movementsData.map(movement => ({
          ...movement,
          username: 'Desconocido', // Nombre de usuario por defecto
          details: JSON.parse(movement.details) // Parsear detalles
        }));
        setMovements(movementsWithDetails);
        return;
      }

      const userMap = usersData.reduce((acc, user) => {
        acc[user.id] = user.username;
        return acc;
      }, {});

      // Combinar movimientos con nombres de usuario y parsear detalles
      const movementsWithDetails = movementsData.map(movement => ({
        ...movement,
        username: userMap[movement.user_id] || 'Desconocido',
        details: JSON.parse(movement.details) // Parsear detalles
      }));

      setMovements(movementsWithDetails);

    } catch (err) {
      console.error('Unexpected error fetching movements:', err);
      setError(`Error inesperado: ${err.message}`);
      setMovements([]);
    }
  };

  return (
    <div className="bg-pear-neutral p-6">
      <h2 className="text-2xl font-bold text-pear-dark-green mb-4">Historial de Movimientos</h2>
      {error && <p className="text-red-500">{error}</p>}
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-pear-green text-white">
            <th className="border p-2">Fecha</th>
            <th className="border p-2">Usuario</th>
            <th className="border p-2">Tipo</th>
            <th className="border p-2">Cantidad</th>
            <th className="border p-2">Método</th>
            <th className="border p-2">Talla(s)</th>
            <th className="border p-2">Detalles</th>
          </tr>
        </thead>
        <tbody>
          {movements.map((movement) => (
            <tr key={movement.id} className="bg-white">
              <td className="border p-2">{new Date(movement.timestamp).toLocaleString()}</td>
              <td className="border p-2">{movement.username}</td>
              <td className="border p-2">{movement.movement_type}</td>
              <td className="border p-2">{movement.quantity}</td>
              <td className="border p-2">{movement.method}</td>
              <td className="border p-2">
                {movement.details && movement.details.sizes ? (
                  Object.entries(movement.details.sizes)
                    .filter(([_, stock]) => stock > 0)
                    .map(([size]) => size)
                    .join(', ')
                ) : movement.details && movement.details.size ? (
                  movement.details.size
                ) : 'N/A'}
              </td>
              <td className="border p-2">
                {movement.details ? (
                  <>
                    {movement.details.reference && <p><strong>Referencia:</strong> {movement.details.reference}</p>}
                    {movement.details.color && <p><strong>Color:</strong> {movement.details.color}</p>}
                    {movement.details.sizes && (
                      <p><strong>Tallas:</strong>
                        {Object.entries(movement.details.sizes)
                          .map(([size, stock]) => `${size}: ${stock}`)
                          .join(', ')}
                      </p>
                    )}
                    {/* Puedes añadir más detalles aquí si la estructura JSON varía */}
                  </>
                ) : (
                  'N/A'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Movements;