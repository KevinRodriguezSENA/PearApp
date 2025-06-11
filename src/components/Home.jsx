import React, { useEffect, useState } from 'react';
import { Bar, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import supabase from '../supabaseClient';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

function Home() {
  const [topSoldItems, setTopSoldItems] = useState([]);
  const [leastSoldItems, setLeastSoldItems] = useState([]);
  const [totalMovements, setTotalMovements] = useState(0);
  const [activeUsers, setActiveUsers] = useState(0);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchStatistics();
  }, []);

  const fetchStatistics = async () => {
    try {
      const { data: movementsData, error: movementsError } = await supabase
        .from('inventory_movements')
        .select('*');

      if (movementsError) {
        throw new Error(`Error al obtener movimientos: ${movementsError.message}`);
      }

      if (!movementsData || movementsData.length === 0) {
        setTopSoldItems([]);
        setLeastSoldItems([]);
        setTotalMovements(0);
        setActiveUsers(0);
        return;
      }

      setTotalMovements(movementsData.length);

      const uniqueUsers = [...new Set(movementsData.map(m => m.user_id).filter(id => id !== null))];
      setActiveUsers(uniqueUsers.length);

      const salesMovements = movementsData
        .filter(m => m.movement_type === 'salida')
        .map(m => ({
          ...m,
          details: JSON.parse(m.details),
        }));

      const itemSales = salesMovements.reduce((acc, movement) => {
        const { reference, color } = movement.details || {};
        if (!reference || !color) return acc;

        const key = `${reference}-${color}`;
        if (!acc[key]) {
          acc[key] = { reference, color, quantity: 0 };
        }
        acc[key].quantity += movement.quantity;
        return acc;
      }, {});

      const sortedItems = Object.values(itemSales).sort((a, b) => b.quantity - a.quantity);

      setTopSoldItems(sortedItems.slice(0, 10)); // Las 10 más vendidas
      const nonZeroItems = sortedItems.filter(item => item.quantity > 0);
      setLeastSoldItems(nonZeroItems.slice(-10)); // Las 10 menos vendidas

    } catch (err) {
      setError(err.message || 'Error al cargar estadísticas');
    }
  };

  // Datos para el gráfico de resumen (movimientos y usuarios)
  const summaryData = {
    labels: ['Total Movimientos', 'Usuarios Activos'],
    datasets: [
      {
        label: 'Cantidad',
        data: [totalMovements, activeUsers],
        backgroundColor: ['rgba(54, 162, 235, 0.6)', 'rgba(255, 206, 86, 0.6)'],
        borderColor: ['rgba(54, 162, 235, 1)', 'rgba(255, 206, 86, 1)'],
        borderWidth: 1,
      },
    ],
  };

  // Datos para el gráfico de prendas más vendidas
  const topSoldData = {
    labels: topSoldItems.map(item => `${item.reference} - ${item.color}`),
    datasets: [
      {
        data: topSoldItems.map(item => item.quantity),
        backgroundColor: [
          'rgba(255, 99, 132, 0.6)',
          'rgba(54, 162, 235, 0.6)',
          'rgba(255, 206, 86, 0.6)',
          'rgba(75, 192, 192, 0.6)',
          'rgba(153, 102, 255, 0.6)',
          'rgba(255, 159, 64, 0.6)',
          'rgba(199, 21, 133, 0.6)',
          'rgba(0, 128, 0, 0.6)',
          'rgba(128, 0, 128, 0.6)',
          'rgba(0, 0, 255, 0.6)',
        ],
        borderColor: [
          'rgba(255, 99, 132, 1)',
          'rgba(54, 162, 235, 1)',
          'rgba(255, 206, 86, 1)',
          'rgba(75, 192, 192, 1)',
          'rgba(153, 102, 255, 1)',
          'rgba(255, 159, 64, 1)',
          'rgba(199, 21, 133, 1)',
          'rgba(0, 128, 0, 1)',
          'rgba(128, 0, 128, 1)',
          'rgba(0, 0, 255, 1)',
        ],
        borderWidth: 1,
      },
    ],
  };

  // Datos para el gráfico de prendas menos vendidas
  const leastSoldData = {
    labels: leastSoldItems.map(item => `${item.reference} - ${item.color}`),
    datasets: [
      {
        data: leastSoldItems.map(item => item.quantity),
        backgroundColor: [
          'rgba(255, 99, 132, 0.6)',
          'rgba(54, 162, 235, 0.6)',
          'rgba(255, 206, 86, 0.6)',
          'rgba(75, 192, 192, 0.6)',
          'rgba(153, 102, 255, 0.6)',
          'rgba(255, 159, 64, 0.6)',
          'rgba(199, 21, 133, 0.6)',
          'rgba(0, 128, 0, 0.6)',
          'rgba(128, 0, 128, 0.6)',
          'rgba(0, 0, 255, 0.6)',
        ],
        borderColor: [
          'rgba(255, 99, 132, 1)',
          'rgba(54, 162, 235, 1)',
          'rgba(255, 206, 86, 1)',
          'rgba(75, 192, 192, 1)',
          'rgba(153, 102, 255, 1)',
          'rgba(255, 159, 64, 1)',
          'rgba(199, 21, 133, 1)',
          'rgba(0, 128, 0, 1)',
          'rgba(128, 0, 128, 1)',
          'rgba(0, 0, 255, 1)',
        ],
        borderWidth: 1,
      },
    ],
  };

  const barOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: 'Estadísticas del Sistema' },
    },
    scales: {
      y: { beginAtZero: true },
    },
  };

  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false, // Para permitir un tamaño personalizado
    plugins: {
      legend: { position: 'bottom' }, // Leyenda debajo para ahorrar espacio
      title: { display: false }, // Sin título en el gráfico para mantenerlo compacto
    },
  };

  return (
    <div className="bg-pear-neutral p-6">
      <h1 className="text-3xl font-bold text-pear-dark-green mb-6">Estadísticas del Sistema</h1>
      {error && <p className="text-red-500 mb-4">{error}</p>}

      <div className="mb-6">
        <div className="bg-white p-4 rounded shadow max-w-md mx-auto">
          <Bar data={summaryData} options={barOptions} />
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-2xl font-bold text-pear-dark-green mb-4 text-center">
          Comparativa de Referencias Vendidas
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-4 rounded shadow flex flex-col items-center">
            <h3 className="text-lg font-semibold text-pear-dark mb-2">Más Vendidas (Top 10)</h3>
            {topSoldItems.length > 0 ? (
              <div style={{ width: '250px', height: '250px' }}>
                <Pie data={topSoldData} options={pieOptions} />
              </div>
            ) : (
              <p className="text-pear-dark">No hay datos de ventas disponibles.</p>
            )}
          </div>
          <div className="bg-white p-4 rounded shadow flex flex-col items-center">
            <h3 className="text-lg font-semibold text-pear-dark mb-2">Menos Vendidas (Bottom 10)</h3>
            {leastSoldItems.length > 0 ? (
              <div style={{ width: '250px', height: '250px' }}>
                <Pie data={leastSoldData} options={pieOptions} />
              </div>
            ) : (
              <p className="text-pear-dark">No hay datos de ventas disponibles.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Home;