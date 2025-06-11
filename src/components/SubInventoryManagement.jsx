import React, { useState, useEffect, useRef } from 'react';
import supabase from '../supabaseClient';
import axios from 'axios';
import BarcodeGenerator from './BarcodeGenerator'; // Import the new component

const updateStockInWooCommerce = async (sku, quantity) => {
  const consumerKey = "ck_1da9c643baaf2414a6732c59aaada69eb259ba2b";
  const consumerSecret = "cs_58610e3246226199099e8d6b3705e2812300b9aa";
  const baseURL = "https://majovalero.com/wp-json/wc/v3";

  try {
    const baseSku = sku.split('-')[0]; // Extrae producto padre con sku
    const { data: products } = await axios.get(`${baseURL}/products`, {
      params: { consumer_key: consumerKey, consumer_secret: consumerSecret, sku: baseSku },
    });

    if (!products || products.length === 0) {
      console.error("Producto padre no encontrado en WooCommerce:", baseSku);
      return;
    }

    const productId = products[0].id;
    const { data: variations } = await axios.get(`${baseURL}/products/${productId}/variations`, {
      params: { consumer_key: consumerKey, consumer_secret: consumerSecret, sku: sku },
    });

    if (!variations || variations.length === 0) {
      console.error("Variación no encontrada en WooCommerce:", sku);
      return;
    }

    const variationId = variations[0].id;
    console.log(`Intentando actualizar ${sku} a stock: ${quantity}`); // Depuración
    const newStock = quantity; // Asegurar que sea el valor exacto

    await axios.put(
      `${baseURL}/products/${productId}/variations/${variationId}`,
      { stock_quantity: newStock, manage_stock: true }, // Forzar gestión de stock
      { auth: { username: consumerKey, password: consumerSecret } }
    );

    console.log("Stock de variación actualizado correctamente en WooCommerce:", sku, "a", newStock);
  } catch (error) {
    console.error("Error actualizando en WooCommerce:", error.response?.data || error.message);
  }
};

const SubInventoryManagement = ({ logMovement, setError, errorMessage, setShowInventory, user }) => {
  const [barcode, setBarcode] = useState('');
  const [mode, setMode] = useState('Off');
  const [groupedProducts, setGroupedProducts] = useState([]);
  const [filteredGroupedProducts, setFilteredGroupedProducts] = useState([]);
  const [filters, setFilters] = useState({ search: '', size: '', created_at: '' });
  const [sortConfig, setSortConfig] = useState({ key: 'reference', direction: 'asc' });
  const [showPopup, setShowPopup] = useState(false);
  const [newReference, setNewReference] = useState({
    image_url: '',
    reference: '',
    color: '',
    sizes: { 34: 0, 35: 0, 36: 0, 37: 0, 38: 0, 39: 0, 40: 0, 41: 0 },
    price_r: 'Precio detal',
    price_w: 'Precio mayorista',
    created_at: new Date().toISOString(),
    created_by: user ? user.id : null,
  });
  const [editingGroup, setEditingGroup] = useState(null);
  const [showFilters, setShowFilters] = useState(true);
  const [showInventoryScan, setShowInventoryScan] = useState(false);
  const [scannedInventory, setScannedInventory] = useState({});
  const [showSummary, setShowSummary] = useState(false);
  const [changedItems, setChangedItems] = useState([]);
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);
  const [barcodeData, setBarcodeData] = useState([]); // All barcode data from DB
  const [filteredBarcodeData, setFilteredBarcodeData] = useState([]); // Data to pass to BarcodeGenerator
  const [filterReferencia, setFilterReferencia] = useState('');
  const [filterColor, setFilterColor] = useState('');
  const [filterTalla, setFilterTalla] = useState('');
  const [loadingBarcodes, setLoadingBarcodes] = useState(false); // New loading state
  const [barcodeError, setBarcodeError] = useState(null); // New error state
  const sizes = ['34', '35', '36', '37', '38', '39', '40', '41'];
  const barcodeInputRef = useRef(null);

  useEffect(() => {
    fetchInventory();
    if (barcodeInputRef.current) barcodeInputRef.current.focus();
  }, []);

  useEffect(() => {
    applyFiltersAndSorting();
  }, [groupedProducts, sortConfig, filters]);

  // Sincronización periódica cada 3 minutos
  useEffect(() => {
    const syncInterval = setInterval(() => {
      syncInventoryWithWooCommerce();
    }, 3 * 60 * 1000); // 3 minutos en milisegundos
    return () => clearInterval(syncInterval); // Limpia el intervalo al desmontar
  }, [groupedProducts]);

  const syncInventoryWithWooCommerce = async () => {
    for (const group of groupedProducts) {
      for (const size of sizes) {
        const sku = `${group.reference}-${group.color}-${size}`;
        const stock = group.sizes[size] || 0;
        await updateStockInWooCommerce(sku, stock);
      }
    }
    console.log("Inventario sincronizado con WooCommerce a las", new Date().toLocaleTimeString());
  };

  const fetchInventory = async () => {
    try {
      const { data, error } = await supabase
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
            barcode_code,
            created_at,
            created_by
          )
       `)
        .limit(1000);

      if (error) {
        console.error('Error fetching inventory:', error);
        setError(`Error al obtener productos: ${error.message} (Código: ${error.code})`);
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
            variations: {},
            created_at: product.variations[0].created_at,
            created_by: product.variations[0].created_by,
          };
        }
        product.variations.forEach((variation) => {
          acc[key].sizes[variation.size] = variation.stock || 0;
          acc[key].variations[variation.size] = { variation_id: variation.id, barcode: variation.barcode_code };
        });
        return acc;
      }, {});
      setGroupedProducts(Object.values(grouped));
      if (showInventoryScan) {
        const initialScanned = {};
        Object.values(grouped).forEach(group => {
          initialScanned[group.reference + '-' + group.color] = { 
            reference: group.reference,
            color: group.color,
            sizes: sizes.reduce((acc, size) => ({ ...acc, [size]: 0 }), {})
          };
        });
        setScannedInventory(initialScanned);
      }
    } catch (err) {
      console.error('Unexpected error fetching inventory:', err);
      setError(`Error inesperado: ${err.message}`);
    }
  };

  const applyFiltersAndSorting = () => {
    let filtered = [...groupedProducts];
    if (filters.search) {
      const searchTerms = filters.search.toLowerCase().split(' ').filter(term => term);
      filtered = filtered.filter(group => searchTerms.every(term => `${group.reference} ${group.color}`.toLowerCase().includes(term)));
    }
    if (filters.size) {
      filtered = filtered.filter(group => Object.keys(group.sizes).some(size => size.includes(filters.size) && group.sizes[size] >= 1));
    }
    if (filters.created_at) {
      filtered = filtered.filter(group => group.created_at && group.created_at.includes(filters.created_at));
    }
    if (sortConfig.key) {
      filtered.sort((a, b) => {
        const valueA = a[sortConfig.key].toLowerCase();
        const valueB = b[sortConfig.key].toLowerCase();
        return sortConfig.direction === 'asc' ? valueA.localeCompare(valueB) : valueB.localeCompare(valueA);
      });
    }
    setFilteredGroupedProducts(filtered);
  };

  const triggerStockOrderCheck = async (reference, color, size, newStock) => {
    try {
      const { data: settingsData, error: settingsError } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'suggested_sizes')
        .eq('user_id', user.id)
        .maybeSingle();
      if (settingsError && settingsError.code !== 'PGRST116') throw new Error(settingsError.message);
      const suggestedSizes = settingsData?.value ? JSON.parse(settingsData.value) : { 34: 0, 35: 1, 36: 2, 37: 3, 38: 3, 39: 2, 40: 1, 41: 0 };
      const { data: inProcessOrders, error: inProcessError } = await supabase
        .from('orders')
        .select('id, items')
        .eq('client_name', 'Stock')
        .eq('status', 'in_process');
      if (inProcessError) throw new Error(inProcessError.message);
      if (inProcessOrders.some(order => order.items.some(item => item.reference === reference && item.color === color))) return;
      const { data: existingOrders, error: ordersError } = await supabase
        .from('orders')
        .select('id, items')
        .eq('client_name', 'Stock')
        .eq('status', 'pending');
      if (ordersError) throw new Error(ordersError.message);
      let pendingQuantity = 0;
      const existingPendingOrder = existingOrders.find(o => o.items.some(item => item.reference === reference && item.color === color));
      if (existingPendingOrder) {
        const item = existingPendingOrder.items.find(item => item.reference === reference && item.color === color);
        pendingQuantity = item.sizes[size] || 0;
      }
      const suggested = suggestedSizes[size] || 0;
      const totalStock = newStock + pendingQuantity;
      if (totalStock >= suggested) {
        if (existingPendingOrder) {
          const item = existingPendingOrder.items.find(item => item.reference === reference && item.color === color);
          const updatedSizes = { ...item.sizes };
          delete updatedSizes[size];
          const updatedItems = existingPendingOrder.items.map(item => item.reference === reference && item.color === color ? { ...item, sizes: updatedSizes } : item).filter(item => Object.keys(item.sizes).length > 0);
          if (updatedItems.length === 0) await supabase.from('orders').delete().eq('id', existingPendingOrder.id);
          else await supabase.from('orders').update({ items: updatedItems, updated_at: new Date().toISOString() }).eq('id', existingPendingOrder.id);
        }
        return;
      }
      const quantityNeeded = suggested - newStock;
      if (existingPendingOrder) {
        const item = existingPendingOrder.items.find(item => item.reference === reference && item.color === color);
        const updatedSizes = { ...item.sizes, [size]: quantityNeeded };
        await supabase.from('orders').update({ items: existingPendingOrder.items.map(item => item.reference === reference && item.color === color ? { ...item, sizes: updatedSizes } : item), updated_at: new Date().toISOString() }).eq('id', existingPendingOrder.id);
      } else {
        await supabase.from('orders').insert({
          client_name: 'Stock',
          user_id: null,
          status: 'pending',
          items: [{ reference, color, sizes: { [size]: quantityNeeded }, observation: '' }],
          created_at: new Date().toISOString(),
          deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          observations: 'Orden automática para reposición de stock',
        });
      }
    } catch (err) {
      console.error('Error al verificar órdenes de stock:', err);
      setError(`Error al verificar órdenes de stock: ${err.message}`);
    }
  };

  const handleBarcodeChange = async (e) => {
    const value = e.target.value;
    setBarcode(value);

    if (!value) return; // Do nothing if the input is empty

    if (showInventoryScan) {
      // Logic for inventory scanning mode
      try {
        const { data: variation, error } = await supabase.from('variations').select('id, stock, product_id').eq('barcode_code', value).single();

        if (error || !variation) {
          alert(`El código de barras "${value}" no existe en el inventario.`);
          setBarcode('');
          if (barcodeInputRef.current) barcodeInputRef.current.focus();
          return;
        }

        // Split and trim parts for updating scannedInventory state
        const parts = value.split('-');
        if (parts.length !== 3) {
             alert(`Formato de código de barras inválido: "${value}". Debe ser referencia-color-talla.`);
             setBarcode('');
             if (barcodeInputRef.current) barcodeInputRef.current.focus();
             return;
        }
        const [reference, color, size] = parts.map(part => part.trim());

        setScannedInventory(prev => {
          const key = reference + '-' + color;
          const current = prev[key] || { reference, color, sizes: sizes.reduce((acc, size) => ({ ...acc, [size]: 0 }), {}) };
          const newSizes = { ...current.sizes, [size]: (current.sizes[size] || 0) + 1 };
          return { ...prev, [key]: { ...current, sizes: newSizes } };
        });

        setBarcode('');
        if (barcodeInputRef.current) barcodeInputRef.current.focus();

      } catch (err) {
        console.error('Error processing barcode for scanning:', err);
        setError(`Error al procesar el código de barras para escaneo: ${err.message}`);
        setBarcode('');
        if (barcodeInputRef.current) barcodeInputRef.current.focus();
      }

    } else if (mode === 'Cargar' || mode === 'Descargar') {
      // Logic for loading/unloading mode
      try {
        const { data: variation, error } = await supabase.from('variations').select('id, stock, product_id').eq('barcode_code', value).single();

        if (error || !variation) {
          alert(`El código de barras "${value}" no existe en el inventario.`);
          setBarcode('');
          if (barcodeInputRef.current) barcodeInputRef.current.focus();
          return;
        }

        const newStock = mode === 'Cargar' ? variation.stock + 1 : variation.stock - 1;

        if (newStock < 0) {
          alert(`No hay suficiente stock para descargar (Stock actual: ${variation.stock}).`);
          setBarcode('');
          if (barcodeInputRef.current) barcodeInputRef.current.focus();
          return;
        }

        await supabase.from('variations').update({ stock: newStock }).eq('id', variation.id);

        // Split and trim parts for logging and stock checks
        const parts = value.split('-');
         if (parts.length !== 3) {
             // This case should ideally not happen if the barcode was found, but as a fallback:
             console.warn(`Unexpected barcode format after lookup: ${value}`);
             // Attempt to use raw parts if trimming fails
         }
        const [reference, color, size] = parts.length === 3 ? parts.map(part => part.trim()) : [null, null, null];

        if (reference && color && size) {
             await logMovement(variation.id, mode === 'Cargar' ? 'entrada' : 'salida', mode === 'Cargar' ? 1 : -1, 'escaneo', { reference, color, size }, null, new Date().toISOString());
             await triggerStockOrderCheck(reference, color, size, newStock);
        } else {
             console.error(`Could not extract reference, color, size from barcode: ${value} for logging/stock check.`);
             // Log movement or trigger check with partial info if possible, or skip
        }

        await updateStockInWooCommerce(value, newStock); // Use exact value for WooCommerce lookup

        setBarcode('');
        if (barcodeInputRef.current) barcodeInputRef.current.focus();
        fetchInventory();

      } catch (err) {
        console.error('Error processing barcode for loading/unloading:', err);
        setError(`Error al procesar el código de barras para carga/descarga: ${err.message}`);
        setBarcode('');
        if (barcodeInputRef.current) barcodeInputRef.current.focus();
      }
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters({ ...filters, [name]: value });
  };

  const handleClearFilters = () => {
    setFilters({ search: '', size: '', created_at: '' });
    setSortConfig({ key: 'reference', direction: 'asc' });
  };

  const handleSort = (key) => {
    setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }));
  };

  const handleSaveReference = async () => {
  try {
    if (editingGroup) {
      await supabase.from('products').update({
        image_url: newReference.image_url,
        price_r: newReference.price_r === 'Precio detal' ? 0 : parseFloat(newReference.price_r),
        price_w: newReference.price_w === 'Precio mayorista' ? 0 : parseFloat(newReference.price_w)
      }).eq('id', editingGroup.product_id);
      const updates = sizes.map(size => ({ size, stock: newReference.sizes[size], variation: editingGroup.variations[size] }));
      await Promise.all(updates.map(({ size, stock, variation }) => {
        if (variation) return supabase.from('variations').update({ stock }).eq('id', variation.variation_id);
        else if (stock > 0) return supabase.from('variations').insert({
          product_id: editingGroup.product_id,
          color: newReference.color,
          size,
          stock,
          barcode_code: `${newReference.reference}-${newReference.color}-${size}`,
          created_at: newReference.created_at,
          created_by: user ? user.id : null,
        });
        return Promise.resolve();
      }));
      await logMovement(null, 'ajuste', 0, 'manual', { reference: newReference.reference, color: newReference.color, sizes: newReference.sizes }, null, new Date().toISOString());
    } else {
      if (!newReference.reference || !newReference.color || newReference.price_r === 'Precio detal' || newReference.price_w === 'Precio mayorista') {
        setError('La Referencia, Color, Precio Detal y Precio Mayorista son campos obligatorios.');
        return;
      }
      const { data: newProduct } = await supabase.from('products').insert({
        reference: newReference.reference,
        image_url: newReference.image_url,
        price_r: parseFloat(newReference.price_r),
        price_w: parseFloat(newReference.price_w),
        created_by: user ? user.id : null,
      }).select().single();
      const newVariations = sizes.filter(size => newReference.sizes[size] >= 0).map(size => ({
        product_id: newProduct.id,
        color: newReference.color,
        size,
        stock: newReference.sizes[size],
        barcode_code: `${newReference.reference}-${newReference.color}-${size}`,
        created_at: newReference.created_at,
        created_by: user ? user.id : null,
      }));
      if (newVariations.length > 0) await supabase.from('variations').insert(newVariations);
      await logMovement(null, 'entrada', Object.values(newReference.sizes).reduce((a, b) => a + b, 0), 'manual', { reference: newReference.reference, color: newReference.color, sizes: newReference.sizes }, null, new Date().toISOString());
    }
    setShowPopup(false);
    setEditingGroup(null);
    setNewReference({
      image_url: '',
      reference: '',
      color: '',
      sizes: { 34: 0, 35: 0, 36: 0, 37: 0, 38: 0, 39: 0, 40: 0, 41: 0 },
      price_r: 'Precio detal',
      price_w: 'Precio mayorista',
      created_at: new Date().toISOString(),
      created_by: user ? user.id : null,
    });
    fetchInventory();
    // Actualizar WooCommerce con el stock exacto para cada talla, incluyendo 0
    sizes.forEach(async size => {
      const sku = `${newReference.reference}-${newReference.color}-${size}`;
      await updateStockInWooCommerce(sku, newReference.sizes[size]); // Establece stock exacto, incluyendo 0
    });
  } catch (err) {
    console.error('Error saving reference:', err);
    setError(`Error al guardar referencia: ${err.message}`);
  }
};

  const handleDeleteReference = async (productId, reference) => {
    try {
      await supabase.from('variations').delete().eq('product_id', productId);
      await supabase.from('products').delete().eq('id', productId);
      await logMovement(null, 'ajuste', 0, 'manual', { reference, action: 'delete' }, null, new Date().toISOString());
      fetchInventory();
    } catch (err) {
      console.error('Error deleting reference:', err);
      setError(`Error al eliminar referencia: ${err.message}`);
    }
  };

  const handleAcceptInventory = () => {
    if (window.confirm('¿Desea previsualizar los cambios?')) {
      const changes = [];
      for (const key in scannedInventory) {
        const scanned = scannedInventory[key];
        const current = groupedProducts.find(g => g.reference + '-' + g.color === key) || { sizes: {} };
        sizes.forEach(size => {
          const newStock = scanned.sizes[size] || 0;
          const oldStock = current.sizes[size] || 0;
          if (newStock !== oldStock) {
            changes.push({ reference: scanned.reference, color: scanned.color, size, oldStock, newStock });
          }
        });
      }
      setChangedItems(changes);
      setShowInventoryScan(false);
      setShowSummary(true);
    }
  };

  const handleConfirmChanges = async () => {
  try {
    const updates = [];
    for (const key in scannedInventory) {
      const scanned = scannedInventory[key];
      const current = groupedProducts.find(g => g.reference + '-' + g.color === key) || { product_id: null, variations: {} };
      sizes.forEach(async size => {
        const newStock = scanned.sizes[size] || 0;
        const variation = current.variations[size];
        if (variation) {
          updates.push({ variation_id: variation.variation_id, stock: newStock });
          await logMovement(variation.variation_id, 'ajuste', newStock - (current.sizes[size] || 0), 'escaneo', { reference: scanned.reference, color: scanned.color, size }, null, new Date().toISOString());
        } else if (newStock >= 0 || current.product_id) {
          updates.push({
            product_id: current.product_id,
            color: scanned.color,
            size,
            stock: newStock,
            barcode_code: `${scanned.reference}-${scanned.color}-${size}`
          });
        }
        // Actualizar WooCommerce por cada cambio, incluyendo 0
        const sku = `${scanned.reference}-${scanned.color}-${size}`;
        await updateStockInWooCommerce(sku, newStock);
      });
    }
    await Promise.all(updates.map(update => update.variation_id
      ? supabase.from('variations').update({ stock: update.stock }).eq('id', update.variation_id)
      : supabase.from('variations').upsert({
          product_id: update.product_id,
          color: update.color,
          size: update.size,
          stock: update.stock,
          barcode_code: update.barcode_code,
          created_at: new Date().toISOString(),
          created_by: user ? user.id : null,
        }, { onConflict: ['product_id', 'color', 'size'] })));
    await triggerStockOrderCheckForAll();
    setShowSummary(false);
    setScannedInventory({});
    fetchInventory();
  } catch (err) {
    console.error('Error accepting inventory:', err);
    setError(`Error al aceptar inventario: ${err.message}`);
  }
};

  const handleCancelChanges = () => {
    setShowSummary(false);
    setScannedInventory({});
    setChangedItems([]);
    setShowInventoryScan(true);
  };

  const triggerStockOrderCheckForAll = async () => {
    for (const key in scannedInventory) {
      const scanned = scannedInventory[key];
      for (const size of sizes) {
        await triggerStockOrderCheck(scanned.reference, scanned.color, size, scanned.sizes[size] || 0);
      }
    }
  };

  const fetchBarcodeDataFromDB = async () => {
    setLoadingBarcodes(true);
    setBarcodeError(null);
    try {
      const { data, error } = await supabase
        .from('variations')
        .select(`
          barcode_code,
          color,
          size,
          products (reference)
        `);

      if (error) {
        throw error;
      }

      // Map the fetched data to the structure expected by the component
      const formattedData = data.map(item => ({
        barcode_code: item.barcode_code,
        referencia: item.products.reference, // Map 'reference' from 'products' to 'referencia'
        color: item.color,
        talla: item.size, // Map 'size' to 'talla'
        id: item.barcode_code // Use barcode_code as a unique id for keys
      }));

      setBarcodeData(formattedData);
      setFilteredBarcodeData(formattedData); // Initially show all data

    } catch (err) {
      console.error('Error fetching barcode data:', err);
      setBarcodeError('Error al cargar los datos de códigos de barras.');
      setBarcodeData([]); // Clear data on error
      setFilteredBarcodeData([]);
    } finally {
      setLoadingBarcodes(false);
    }
  };

  useEffect(() => {
    // Fetch data when the modal is opened
    if (showBarcodeModal && barcodeData.length === 0 && !loadingBarcodes && !barcodeError) {
       fetchBarcodeDataFromDB();
    } else if (!showBarcodeModal) {
        // Optionally clear data when modal is closed to refetch next time
        // setBarcodeData([]);
        // setFilteredBarcodeData([]);
    }
  }, [showBarcodeModal, barcodeData.length, loadingBarcodes, barcodeError]); // Depend on modal visibility and data state

  useEffect(() => {
    // Apply filtering whenever filter inputs or original data change
    const applyFilter = () => {
      const filtered = barcodeData.filter(item => {
        const matchesReferencia = filterReferencia ? item.referencia.toLowerCase().includes(filterReferencia.toLowerCase()) : true;
        const matchesColor = filterColor ? item.color.toLowerCase().includes(filterColor.toLowerCase()) : true;
        const matchesTalla = filterTalla ? item.talla.toLowerCase().includes(filterTalla.toLowerCase()) : true;
        return matchesReferencia && matchesColor && matchesTalla;
      });
      setFilteredBarcodeData(filtered);
    };

    applyFilter();
  }, [barcodeData, filterReferencia, filterColor, filterTalla]); // Re-run filter when dependencies change

  const handleOpenBarcodeModal = () => {
    setShowBarcodeModal(true);
  };

  const handleCloseBarcodeModal = () => {
    setShowBarcodeModal(false);
    // Optionally reset filters when closing modal
    setFilterReferencia('');
    setFilterColor('');
    setFilterTalla('');
  };

  return (
    <div className="bg-pear-neutral p-6">
      <div className="flex justify-between mb-4">
        <h1 className="text-2xl font-bold text-pear-dark-green flex items-center">
          <span className="mr-2"></span> Gestión de Inventarios
        </h1>
      </div>

      <div className="flex items-center mb-4 space-x-4">
        <div className="flex-1">
          <input
            type="text"
            value={barcode}
            onChange={handleBarcodeChange}
            placeholder="Escanea el código de barras (referencia-color-talla)"
            className="w-full p-2 border border-gray-300 rounded"
            ref={barcodeInputRef}
          />
        </div>
        <div className="flex space-x-2">
          {['Cargar', 'Off', 'Descargar'].map(option => (
            <button
              key={option}
              onClick={() => { setMode(option); if (option !== 'Off' && barcode) handleBarcodeChange({ target: { value: barcode } }); }}
              className={`px-4 py-2 rounded ${mode === option ? 'bg-pear-dark-green text-white' : 'bg-gray-200'}`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-between items-center mb-4">
        <button
          onClick={() => { setEditingGroup(null); setNewReference({ image_url: '', reference: '', color: '', sizes: { 34: 0, 35: 0, 36: 0, 37: 0, 38: 0, 39: 0, 40: 0, 41: 0 }, price_r: 'Precio detal', price_w: 'Precio mayorista', created_at: new Date().toISOString(), created_by: user ? user.id : null }); setShowPopup(true); }}
          className="bg-pear-dark-green text-white p-2 rounded hover:bg-pear-green transition"
        >
          Agregar Nueva Referencia
        </button>
        {/* Button to open the barcode modal */}
        <button
          onClick={handleOpenBarcodeModal}
          className="bg-pear-dark-green text-white p-2 rounded hover:bg-pear-green transition"
        >
          Generar Códigos de Barras
        </button>
        <button
          onClick={() => { setShowInventoryScan(true); fetchInventory(); }}
          className="bg-pear-dark-green text-white p-2 rounded hover:bg-pear-green transition"
        >
          Hacer Inventariado
        </button>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="bg-gray-300 text-pear-dark p-2 rounded hover:bg-gray-400 transition"
        >
          {showFilters ? 'Ocultar Filtros' : 'Mostrar Filtros'}
        </button>
      </div>

      {showFilters && (
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
              placeholder="Filtrar por Talla (solo con existencias)"
              value={filters.size}
              onChange={handleFilterChange}
              className="p-2 border border-gray-300 rounded"
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
      )}

      <table className="w-full border-collapse bg-white rounded-lg shadow-md overflow-x-auto">
        <thead>
          <tr className="bg-pear-green text-white">
            <th className="border p-2">Imagen</th>
            <th className="border p-2">
              <div className="flex items-center justify-between w-full">
                <span>Referencia</span>
                <button onClick={() => handleSort('reference')} className="focus:outline-none p-1">
                  {sortConfig.key === 'reference' ? (sortConfig.direction === 'asc' ? <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" /></svg> : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>) : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 10l5 5 5-5m0-6l-5 5-5-5"/></svg>}
                </button>
              </div>
            </th>
            <th className="border p-2">
              <div className="flex items-center justify-between w-full">
                <span>Color</span>
                <button onClick={() => handleSort('color')} className="focus:outline-none p-1">
                  {sortConfig.key === 'color' ? (sortConfig.direction === 'asc' ? <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" /></svg> : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>) : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 10l5 5 5-5m0-6l-5 5-5-5"/></svg>}
                </button>
              </div>
            </th>
            {sizes.map(size => <th key={size} className="border p-2 min-w-[40px] text-center">{size}</th>)}
            <th className="border p-2">Fecha Creación</th>
            <th className="border p-2">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {filteredGroupedProducts.map((group, index) => (
            <tr key={index} className="border-t">
              <td className="border p-2">
                {group.image_url ? <img src={group.image_url} alt={`${group.reference} ${group.color}`} className="w-12 h-12 object-cover" onError={(e) => (e.target.src = 'https://placehold.co/48x48/EFEFEF/AAAAAA&text=No+Img')} /> : <span className="text-gray-500">Sin imagen</span>}
              </td>
              <td className="border p-2">{group.reference}</td>
              <td className="border p-2">{group.color}</td>
              {sizes.map(size => (
                <td key={size} className={`border p-2 text-center ${showInventoryScan && scannedInventory[group.reference + '-' + group.color]?.sizes[size] !== group.sizes[size] ? 'text-red-500 relative group' : ''} min-w-[40px]`}>
                  <span className="inline-block w-full text-center">{group.sizes[size] || 0}</span>
                  {showInventoryScan && scannedInventory[group.reference + '-' + group.color]?.sizes[size] !== group.sizes[size] && (
                    <span className="absolute hidden group-hover:flex bg-gray-800 text-white text-xs rounded p-1 top-[-30px] left-1/2 transform -translate-x-1/2 whitespace-nowrap z-10">
                      Tenías {group.sizes[size]} y ahora {scannedInventory[group.reference + '-' + group.color]?.sizes[size] || 0}
                    </span>
                  )}
                </td>
              ))}
              <td className="border p-2">{group.created_at ? new Date(group.created_at).toLocaleDateString() : 'N/A'}</td>
              <td className="border p-2">
                <button onClick={() => { setEditingGroup(group); setNewReference({ image_url: group.image_url, reference: group.reference, color: group.color, sizes: group.sizes, price_r: group.price_r || 'Precio detal', price_w: group.price_w || 'Precio mayorista', created_at: group.created_at, created_by: user ? user.id : null }); setShowPopup(true); }} className="bg-blue-500 text-white px-2 py-1 rounded mr-2">Editar</button>
                <button onClick={() => handleDeleteReference(group.product_id, group.reference)} className="bg-red-500 text-white px-2 py-1 rounded">Eliminar</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {showPopup && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white p-4 rounded-lg shadow-lg max-w-sm w-full max-h-[70vh]">
            <div className="max-h-[60vh] overflow-y-auto">
              <h2 className="text-lg font-bold mb-3 text-pear-dark">{editingGroup ? 'Editar Referencia' : 'Nueva Referencia'}</h2>
              {errorMessage && <p className="text-red-500 mb-2">{errorMessage}</p>}
              <div className="space-y-2">
                <input type="text" placeholder="URL de la imagen" value={newReference.image_url} onChange={(e) => setNewReference({ ...newReference, image_url: e.target.value })} className="w-full p-1 border border-gray-300 rounded text-sm" />
                <input type="text" placeholder="Referencia" value={newReference.reference} onChange={(e) => setNewReference({ ...newReference, reference: e.target.value })} className="w-full p-1 border border-gray-300 rounded text-sm" disabled={!!editingGroup} />
                <input type="text" placeholder="Color" value={newReference.color} onChange={(e) => setNewReference({ ...newReference, color: e.target.value })} className="w-full p-1 border border-gray-300 rounded text-sm" disabled={!!editingGroup} />
                <input type="number" placeholder="Precio detal" value={newReference.price_r === 'Precio detal' ? '' : newReference.price_r} onChange={(e) => setNewReference({ ...newReference, price_r: e.target.value || 'Precio detal' })} className="w-full p-1 border border-gray-300 rounded text-sm" />
                <input type="number" placeholder="Precio mayorista" value={newReference.price_w === 'Precio mayorista' ? '' : newReference.price_w} onChange={(e) => setNewReference({ ...newReference, price_w: e.target.value || 'Precio mayorista' })} className="w-full p-1 border border-gray-300 rounded text-sm" />
                <div className="grid grid-cols-4 gap-1">
                  {sizes.map(size => (
                    <div key={size}>
                      <label className="block text-pear-dark text-xs font-medium">Talla {size}</label>
                      <input type="number" value={newReference.sizes[size]} onChange={(e) => setNewReference({ ...newReference, sizes: { ...newReference.sizes, [size]: parseInt(e.target.value) || 0 } })} className="w-full p-1 border border-gray-300 rounded text-sm" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end space-x-2 mt-3">
              <button onClick={() => { setShowPopup(false); setEditingGroup(null); }} className="bg-gray-300 px-2 py-1 rounded text-sm">Cancelar</button>
              <button onClick={handleSaveReference} className="bg-pear-dark-green text-white px-2 py-1 rounded text-sm">Guardar</button>
            </div>
          </div>
        </div>
      )}

      {showInventoryScan && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white p-4 rounded-lg shadow-lg w-[90%] max-h-[80vh] overflow-y-auto relative">
            <h2 className="text-xl font-bold mb-4 text-pear-dark">Inventario</h2>
            <div className="sticky top-0 bg-white z-10 mb-4 p-2 flex space-x-2">
              <input
                type="text"
                value={barcode}
                onChange={handleBarcodeChange}
                placeholder="Escanea el código de barras (referencia-color-talla)"
                className="w-full p-2 border border-gray-300 rounded"
                ref={barcodeInputRef}
              />
              <button
                onClick={() => handleSort('reference')}
                className="bg-gray-300 text-pear-dark px-2 py-1 rounded hover:bg-gray-400"
              >
                {sortConfig.direction === 'asc' ? 'A-Z' : 'Z-A'}
              </button>
            </div>
            <div className="mt-4">
              <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4 overflow-x-auto">
                <div className="w-full md:w-1/2 p-4 bg-gray-100 rounded-lg">
                  <h3 className="text-lg font-bold mb-2">Inventario Actual</h3>
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-pear-green text-white">
                        <th className="border p-2">Referencia</th>
                        <th className="border p-2">Color</th>
                        {sizes.map(size => <th key={size} className="border p-2 min-w-[40px] text-center">{size}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredGroupedProducts.map(group => (
                        <tr key={group.reference + '-' + group.color} className="border-t">
                          <td className="border p-2">{group.reference}</td>
                          <td className="border p-2">{group.color}</td>
                          {sizes.map(size => (
                            <td
                              key={size}
                              className={`border p-2 text-center ${showInventoryScan && scannedInventory[group.reference + '-' + group.color]?.sizes[size] !== group.sizes[size] ? 'text-red-500 relative group' : ''} min-w-[40px]`}
                            >
                              <span className="inline-block w-full text-center">{group.sizes[size] || 0}</span>
                              {showInventoryScan &&
                                scannedInventory[group.reference + '-' + group.color]?.sizes[size] !== group.sizes[size] && (
                                  <span className="absolute hidden group-hover:flex bg-gray-800 text-white text-xs rounded p-1 top-[-30px] left-1/2 transform -translate-x-1/2 whitespace-nowrap z-10">
                                    Tenías {group.sizes[size]} y ahora {scannedInventory[group.reference + '-' + group.color]?.sizes[size] || 0}
                                  </span>
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="w-full md:w-1/2 p-4 bg-gray-100 rounded-lg">
                  <h3 className="text-lg font-bold mb-2">Inventario Escaneado</h3>
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-pear-green text-white">
                        <th className="border p-2">Referencia</th>
                        <th className="border p-2">Color</th>
                        {sizes.map(size => <th key={size} className="border p-2 min-w-[40px] text-center">{size}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredGroupedProducts.map(group => (
                        <tr key={group.reference + '-' + group.color} className="border-t">
                          <td className="border p-2">{group.reference}</td>
                          <td className="border p-2">{group.color}</td>
                          {sizes.map(size => (
                            <td key={size} className="border p-2 text-center min-w-[40px]">
                              <span className="inline-block w-full text-center">{scannedInventory[group.reference + '-' + group.color]?.sizes[size] || 0}</span>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="sticky bottom-0 bg-white z-10 mt-4 p-2 flex justify-end space-x-2">
              <button onClick={() => setShowInventoryScan(false)} className="bg-gray-300 px-4 py-2 rounded">Cerrar</button>
              <button onClick={handleAcceptInventory} className="bg-pear-dark-green text-white px-4 py-2 rounded">Aceptar</button>
            </div>
          </div>
        </div>
      )}

      {showSummary && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white p-4 rounded-lg shadow-lg w-[90%] max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4 text-pear-dark">Resumen de Cambios</h2>
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-pear-green text-white">
                  <th className="border p-2">Referencia</th>
                  <th className="border p-2">Color</th>
                  <th className="border p-2">Talla</th>
                  <th className="border p-2">Stock Anterior</th>
                  <th className="border p-2">Stock Nuevo</th>
                </tr>
              </thead>
              <tbody>
                {changedItems.map(item => (
                  <tr key={`${item.reference}-${item.color}-${item.size}`} className="border-t">
                    <td className="border p-2">{item.reference}</td>
                    <td className="border p-2">{item.color}</td>
                    <td className="border p-2">{item.size}</td>
                    <td className="border p-2">{item.oldStock}</td>
                    <td className="border p-2">{item.newStock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="sticky bottom-0 bg-white z-10 mt-4 p-2 flex justify-end space-x-2">
              <button onClick={handleCancelChanges} className="bg-gray-300 px-4 py-2 rounded">Cancelar</button>
              <button onClick={handleConfirmChanges} className="bg-pear-dark-green text-white px-4 py-2 rounded">Listo</button>
            </div>
          </div>
        </div>
      )}

      {errorMessage && <p className="text-red-500 mb-4">{errorMessage}</p>}

      {/* Barcode Modal */}
      {showBarcodeModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full"> {/* Modal overlay */}
          <div className="relative top-20 mx-auto p-5 border w-full max-w-4xl shadow-lg rounded-md bg-white"> {/* Modal content */}
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">Generar y Descargar Códigos de Barras</h2>
              <button className="text-black text-2xl font-semibold leading-none hover:text-gray-700" onClick={handleCloseBarcodeModal}>
                &times;
              </button>
            </div>

            {/* Filter Inputs */}
            <div className="mt-4 mb-6 flex space-x-4"> {/* Added flex and space-x for layout */}
              <input
                type="text"
                placeholder="Filtrar por Referencia"
                value={filterReferencia}
                onChange={(e) => setFilterReferencia(e.target.value)}
                className="p-2 border rounded w-1/3" // Tailwind classes for input
              />
              <input
                type="text"
                placeholder="Filtrar por Color"
                value={filterColor}
                onChange={(e) => setFilterColor(e.target.value)}
                className="p-2 border rounded w-1/3" // Tailwind classes for input
              />
              <input
                type="text"
                placeholder="Filtrar por Talla"
                value={filterTalla}
                onChange={(e) => setFilterTalla(e.target.value)}
                className="p-2 border rounded w-1/3" // Tailwind classes for input
              />
            </div>

            {/* Loading and Error Messages */}
            {loadingBarcodes && <p>Cargando códigos de barras...</p>}
            {barcodeError && <p className="text-red-500">{barcodeError}</p>}

            {/* Barcode Generator Component Container with Scroll */}
            {!loadingBarcodes && !barcodeError && filteredBarcodeData.length > 0 && (
              <div className="max-h-96 overflow-y-auto"> {/* Added max-height and overflow for scrolling */}
                <BarcodeGenerator data={filteredBarcodeData} />
              </div>
            )}
            {!loadingBarcodes && !barcodeError && filteredBarcodeData.length === 0 && (
              <p>No se encontraron códigos de barras con los filtros aplicados.</p>
            )}

          </div>
        </div>
      )}
    </div>
  );
};

export default SubInventoryManagement;