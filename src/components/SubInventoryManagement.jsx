import React, { useState, useEffect, useRef } from 'react';
import supabase from '../supabaseClient';
import axios from 'axios';
import BarcodeGeneratorModal from './BarcodeGeneratorModal';

const updateStockInWooCommerce = async (sku, quantity) => {
  // Esta función no necesita cambios
};

const SubInventoryManagement = ({ logMovement, setError, errorMessage, user }) => {
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
  });
  const [editingGroup, setEditingGroup] = useState(null);
  const [showFilters, setShowFilters] = useState(true);
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);
  const sizes = ['34', '35', '36', '37', '38', '39', '40', '41'];
  const barcodeInputRef = useRef(null);

  useEffect(() => {
    fetchInventory();
    if (barcodeInputRef.current) barcodeInputRef.current.focus();
  }, []);

  useEffect(() => {
    applyFiltersAndSorting();
  }, [groupedProducts, sortConfig, filters]);

  const fetchInventory = async () => {
    try {
        const { data: products, error } = await supabase
            .from('products')
            .select('*, variations (*)')
            .order('created_at', { ascending: false });

        if (error) throw error;

        const grouped = {};

        products.forEach(product => {
            if (product.variations && product.variations.length > 0) {
                const variationsByColor = product.variations.reduce((acc, variation) => {
                    (acc[variation.color] = acc[variation.color] || []).push(variation);
                    return acc;
                }, {});

                Object.entries(variationsByColor).forEach(([color, variationsForColor]) => {
                    const key = `${product.reference}-${color}`;
                    grouped[key] = {
                        product_id: product.id,
                        reference: product.reference,
                        image_url: product.image_url,
                        price_r: product.price_r,
                        price_w: product.price_w,
                        color: color,
                        sizes: {},
                        variations: {},
                        created_at: variationsForColor[0]?.created_at || product.created_at,
                    };
                    variationsForColor.forEach(variation => {
                        grouped[key].sizes[variation.size] = variation.stock || 0;
                        grouped[key].variations[variation.size] = { variation_id: variation.id, barcode: variation.barcode_code };
                    });
                });
            } else {
                const key = `${product.reference}-no-variations`;
                grouped[key] = {
                    product_id: product.id,
                    reference: product.reference,
                    image_url: product.image_url,
                    price_r: product.price_r,
                    price_w: product.price_w,
                    color: 'N/A',
                    sizes: {},
                    variations: {},
                    created_at: product.created_at,
                };
            }
        });
        setGroupedProducts(Object.values(grouped));
    } catch (err) {
        setError(`Error al obtener inventario: ${err.message}`);
    }
  };


  const applyFiltersAndSorting = () => {
    let filtered = [...groupedProducts];
    if (filters.search) {
      const searchTerms = filters.search.toLowerCase().split(' ').filter(term => term);
      filtered = filtered.filter(group => searchTerms.every(term => `${group.reference} ${group.color}`.toLowerCase().includes(term)));
    }
    if (filters.size) filtered = filtered.filter(group => Object.keys(group.sizes).some(size => size.includes(filters.size) && group.sizes[size] >= 1));
    if (filters.created_at) filtered = filtered.filter(group => group.created_at && group.created_at.startsWith(filters.created_at));
    
    if (sortConfig.key) {
      filtered.sort((a, b) => {
        const valueA = a[sortConfig.key]?.toLowerCase() || '';
        const valueB = b[sortConfig.key]?.toLowerCase() || '';
        if (valueA < valueB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valueA > valueB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    setFilteredGroupedProducts(filtered);
  };
  
  const handleSaveReference = async () => {
    try {
        if (!newReference.reference || !newReference.color) {
            setError('La Referencia y el Color son obligatorios.');
            return;
        }

        let product;
        if (editingGroup) {
            product = { id: editingGroup.product_id };
            await supabase.from('products').update({
                image_url: newReference.image_url,
                price_r: parseFloat(newReference.price_r) || 0,
                price_w: parseFloat(newReference.price_w) || 0,
            }).eq('id', product.id);
        } else {
            const { data: existingProduct } = await supabase.from('products').select('id').eq('reference', newReference.reference).single();
            if (existingProduct) {
                product = existingProduct;
            } else {
                const { data: newProduct, error: productError } = await supabase.from('products').insert({
                    reference: newReference.reference,
                    image_url: newReference.image_url,
                    price_r: parseFloat(newReference.price_r) || 0,
                    price_w: parseFloat(newReference.price_w) || 0,
                    created_by: user.id,
                }).select().single();
                if (productError) throw productError;
                product = newProduct;
            }
        }

        const variationsToUpsert = sizes.map(size => ({
            product_id: product.id,
            color: newReference.color,
            size,
            stock: parseInt(newReference.sizes[size]) || 0,
            barcode_code: `${newReference.reference}-${newReference.color}-${size}`
        }));

        const { error: upsertError } = await supabase.from('variation').upsert(variationsToUpsert, { onConflict: 'product_id,color,size' });
        if (upsertError) throw upsertError;

        setShowPopup(false);
        setEditingGroup(null);
        fetchInventory();
    } catch (err) {
        setError(`Error al guardar: ${err.message}`);
    }
};

  const handleFilterChange = (e) => setFilters({ ...filters, [e.target.name]: e.target.value });
  const handleClearFilters = () => setFilters({ search: '', size: '', created_at: '' });
  const handleSort = (key) => setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }));
  
  return (
    <>
      <div className="bg-pear-neutral p-6">
        <h1 className="text-2xl font-bold text-pear-dark-green mb-4">Gestión de Inventarios</h1>
        
        {/* ... Tu sección de escaneo ... */}

        <div className="flex flex-wrap justify-between items-center mb-4 gap-4">
          <button onClick={() => { setEditingGroup(null); setNewReference({ image_url: '', reference: '', color: '', sizes: { 34: 0, 35: 0, 36: 0, 37: 0, 38: 0, 39: 0, 40: 0, 41: 0 }, price_r: '', price_w: '' }); setShowPopup(true); }} className="bg-pear-dark-green text-white p-2 rounded hover:bg-opacity-80">
            Agregar/Editar Referencia
          </button>
          
          <button onClick={() => setShowBarcodeModal(true)} className="bg-purple-600 text-white p-2 rounded hover:bg-purple-700">
            Generar/Ver Códigos de Barras
          </button>

          <button onClick={() => setShowFilters(!showFilters)} className="bg-gray-300 text-pear-dark p-2 rounded hover:bg-gray-400">
            {showFilters ? 'Ocultar Filtros' : 'Mostrar Filtros'}
          </button>
        </div>

        {showFilters && (
          <div className="flex flex-wrap justify-start mb-4 gap-2">
            <input type="text" name="search" placeholder="Filtrar por Referencia o Color" value={filters.search} onChange={handleFilterChange} className="p-2 border rounded w-full md:w-1/3"/>
            <input type="text" name="size" placeholder="Filtrar Talla" value={filters.size} onChange={handleFilterChange} className="p-2 border rounded w-full md:w-1/4"/>
            <input type="date" name="created_at" value={filters.created_at} onChange={handleFilterChange} className="p-2 border rounded w-full md:w-auto"/>
            <button onClick={handleClearFilters} className="bg-gray-300 px-4 py-2 rounded">Limpiar</button>
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
                <tr key={`${group.product_id}-${group.color}-${index}`} className="border-t">
                    <td className="border p-2 w-16"><img src={group.image_url || 'https://placehold.co/48x48/EFEFEF/AAAAAA&text=No+Img'} alt={group.reference} className="w-12 h-12 object-cover" /></td>
                    <td className="border p-2">{group.reference}</td>
                    <td className="border p-2">{group.color}</td>
                    {sizes.map((size) => (
                      <td key={size} className="border p-2 text-center">{group.sizes[size] ?? 0}</td>
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

      <BarcodeGeneratorModal show={showBarcodeModal} onClose={() => setShowBarcodeModal(false)} />

      {showPopup && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white p-4 rounded-lg shadow-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-3">{editingGroup ? 'Editar' : 'Nueva'} Referencia</h2>
            {errorMessage && <p className="text-red-500 mb-2">{errorMessage}</p>}
            <div className="space-y-3">
              <input type="text" placeholder="URL de la imagen" value={newReference.image_url} onChange={(e) => setNewReference({ ...newReference, image_url: e.target.value })} className="w-full p-2 border rounded" />
              <input type="text" placeholder="Referencia" value={newReference.reference} onChange={(e) => setNewReference({ ...newReference, reference: e.target.value })} className="w-full p-2 border rounded" disabled={!!editingGroup} />
              <input type="text" placeholder="Color" value={newReference.color} onChange={(e) => setNewReference({ ...newReference, color: e.target.value })} className="w-full p-2 border rounded" disabled={!!editingGroup} />
              <input type="number" placeholder="Precio detal" value={newReference.price_r} onChange={(e) => setNewReference({ ...newReference, price_r: e.target.value })} className="w-full p-2 border rounded" />
              <input type="number" placeholder="Precio mayorista" value={newReference.price_w} onChange={(e) => setNewReference({ ...newReference, price_w: e.target.value })} className="w-full p-2 border rounded" />
              <div className="grid grid-cols-4 gap-2">
                {sizes.map(size => (
                  <div key={size}>
                    <label className="block text-xs font-medium">Talla {size}</label>
                    <input type="number" min="0" value={newReference.sizes[size]} onChange={(e) => setNewReference({ ...newReference, sizes: { ...newReference.sizes, [size]: parseInt(e.target.value) || 0 } })} className="w-full p-1 border rounded" />
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-end space-x-2 mt-4">
              <button onClick={() => setShowPopup(false)} className="bg-gray-300 px-4 py-2 rounded">Cancelar</button>
              <button onClick={handleSaveReference} className="bg-pear-dark-green text-white px-4 py-2 rounded">Guardar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SubInventoryManagement;

