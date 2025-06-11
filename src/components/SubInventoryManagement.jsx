// src/components/SubInventoryManagement.jsx

import React, { useState, useEffect, useRef } from 'react';
import supabase from '../supabaseClient';
import axios from 'axios';
import BarcodeGeneratorModal from './BarcodeGeneratorModal';

const updateStockInWooCommerce = async (sku, quantity) => {
  // Esta función no necesita cambios.
};

const SubInventoryManagement = ({ logMovement, setError, errorMessage, user }) => {
  // Tus estados existentes
  const [barcode, setBarcode] = useState('');
  const [mode, setMode] = useState('Off');
  const [groupedProducts, setGroupedProducts] = useState([]);
  const [filteredGroupedProducts, setFilteredGroupedProducts] = useState([]);
  const [filters, setFilters] = useState({ search: '', size: '', created_at: '' });
  const [sortConfig, setSortConfig] = useState({ key: 'reference', direction: 'asc' });
  const [showPopup, setShowPopup] = useState(false);
  const [newReference, setNewReference] = useState({
    image_url: '', reference: '', color: '',
    sizes: { 34: 0, 35: 0, 36: 0, 37: 0, 38: 0, 39: 0, 40: 0, 41: 0 },
    price_r: 'Precio detal', price_w: 'Precio mayorista',
    created_at: new Date().toISOString(), created_by: user ? user.id : null,
  });
  const [editingGroup, setEditingGroup] = useState(null);
  const [showFilters, setShowFilters] = useState(true);
  const sizes = ['34', '35', '36', '37', '38', '39', '40', '41'];
  const barcodeInputRef = useRef(null);
  
  // Nuevo estado para controlar el modal
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);

  useEffect(() => {
    fetchInventory();
    if (barcodeInputRef.current) barcodeInputRef.current.focus();
  }, []);

  useEffect(() => {
    applyFiltersAndSorting();
  }, [groupedProducts, sortConfig, filters]);

  const fetchInventory = async () => {
    // Tu función fetchInventory existente
  };

  const applyFiltersAndSorting = () => {
    // Tu función applyFiltersAndSorting existente
  };
  
  const handleSaveReference = async () => {
    // Tu función handleSaveReference existente (ya genera el barcode_code, está bien)
  };

  const handleFilterChange = (e) => setFilters({ ...filters, [e.target.name]: e.target.value });
  const handleClearFilters = () => setFilters({ search: '', size: '', created_at: '' });
  const handleSort = (key) => setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }));
  const handleBarcodeChange = async (e) => {
    // Tu lógica de Cargar/Descargar por escáner
  };
  const handleDeleteReference = async (productId, reference) => {
    // Tu lógica de eliminar
  };

  return (
    <>
      <div className="bg-pear-neutral p-6">
        <h1 className="text-2xl font-bold text-pear-dark-green mb-4">Gestión de Inventarios</h1>
        
        {/* Tu sección de escaneo */}
        <div className="flex items-center mb-4 space-x-4">
            <div className="flex-1">
                <input
                    type="text" value={barcode} onChange={handleBarcodeChange}
                    placeholder="Escanea el código (referencia-color-talla)"
                    className="w-full p-2 border rounded" ref={barcodeInputRef}
                />
            </div>
            <div className="flex space-x-2">
                {['Cargar', 'Off', 'Descargar'].map(option => (
                    <button key={option} onClick={() => setMode(option)}
                        className={`px-4 py-2 rounded ${mode === option ? 'bg-pear-dark-green text-white' : 'bg-gray-200'}`}>
                        {option}
                    </button>
                ))}
            </div>
        </div>

        {/* Tus botones de acción, incluyendo el nuevo */}
        <div className="flex flex-wrap justify-between items-center mb-4 gap-4">
          <button onClick={() => { setEditingGroup(null); setNewReference({ image_url: '', reference: '', color: '', sizes: { '34':0,'35':0,'36':0,'37':0,'38':0,'39':0,'40':0,'41':0 }, price_r: 'Precio detal', price_w: 'Precio mayorista', created_at: new Date().toISOString(), created_by: user ? user.id : null }); setShowPopup(true); }} className="bg-pear-dark-green text-white p-2 rounded hover:bg-opacity-80 transition">
            Agregar Referencia
          </button>
          
          <button onClick={() => setShowBarcodeModal(true)} className="bg-purple-600 text-white p-2 rounded hover:bg-purple-700 transition">
            Generar/Ver Códigos de Barras
          </button>

          <button onClick={() => setShowFilters(!showFilters)} className="bg-gray-300 text-pear-dark p-2 rounded hover:bg-gray-400 transition">
            {showFilters ? 'Ocultar Filtros' : 'Mostrar Filtros'}
          </button>
        </div>

        {/* ... El resto de tu componente (filtros, tabla, etc.) ... */}
         {showFilters && (
          <div className="flex flex-wrap justify-between mb-4 gap-2">
            <div className="flex items-center space-x-2">
              <input type="text" name="search" placeholder="Filtrar por Referencia o Color" value={filters.search} onChange={handleFilterChange} className="p-2 border rounded w-64"/>
              <input type="text" name="size" placeholder="Filtrar Talla" value={filters.size} onChange={handleFilterChange} className="p-2 border rounded"/>
              <input type="date" name="created_at" value={filters.created_at} onChange={handleFilterChange} className="p-2 border rounded"/>
              <button onClick={handleClearFilters} className="bg-gray-300 px-4 py-2 rounded">Limpiar</button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full border-collapse bg-white rounded-lg shadow-md">
            <thead>
                <tr className="bg-pear-green text-white">
                    <th className="border p-2">Imagen</th>
                    <th className="border p-2 cursor-pointer" onClick={() => handleSort('reference')}>Referencia</th>
                    <th className="border p-2 cursor-pointer" onClick={() => handleSort('color')}>Color</th>
                    {sizes.map(size => <th key={size} className="border p-2 text-center">{size}</th>)}
                    <th className="border p-2">Acciones</th>
                </tr>
            </thead>
            <tbody>
                {filteredGroupedProducts.map((group, index) => (
                <tr key={index} className="border-t">
                    <td className="border p-2">
                      <img src={group.image_url || 'https://placehold.co/48x48/EFEFEF/AAAAAA&text=No+Img'} alt={group.reference} className="w-12 h-12 object-cover" />
                    </td>
                    <td className="border p-2">{group.reference}</td>
                    <td className="border p-2">{group.color}</td>
                    {sizes.map((size) => (
                    <td key={size} className="border p-2 text-center">{group.sizes[size] || 0}</td>
                    ))}
                    <td className="border p-2">
                    <button onClick={() => { setEditingGroup(group); setNewReference({ ...group, sizes: { ...newReference.sizes, ...group.sizes } }); setShowPopup(true); }} className="bg-blue-500 text-white px-2 py-1 rounded">
                        Editar
                    </button>
                    </td>
                </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Renderizado del nuevo modal */}
      <BarcodeGeneratorModal show={showBarcodeModal} onClose={() => setShowBarcodeModal(false)} />

      {/* Tu modal existente para agregar/editar referencias */}
      {showPopup && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          {/* ... contenido del popup ... */}
        </div>
      )}
    </>
  );
};

export default SubInventoryManagement;
