import React, { useState, useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import { toPng } from 'html-to-image';
import supabase from '../supabaseClient';

const BarcodeGeneratorModal = ({ show, onClose }) => {
  const [products, setProducts] = useState([]);
  const [filters, setFilters] = useState({ reference: '', color: '', size: '' });
  const [filteredOptions, setFilteredOptions] = useState({ colors: [], sizes: [] });
  const [selectedVariation, setSelectedVariation] = useState(null);
  const barcodeContainerRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: fetchError } = await supabase
          .from('products')
          .select('id, reference, variations(id, color, size, barcode_code)');
        
        if (fetchError) throw fetchError;
        setProducts(data || []);
      } catch (err) {
        console.error("Error fetching products:", err);
        setError("No se pudieron cargar los productos.");
      } finally {
        setLoading(false);
      }
    };

    if (show) {
      fetchInitialData();
    }
  }, [show]);

  useEffect(() => {
    setSelectedVariation(null);
    if (filters.reference) {
      const product = products.find(p => p.reference === filters.reference);
      const uniqueColors = product ? [...new Set(product.variations.map(v => v.color))].sort() : [];
      setFilteredOptions({ colors: uniqueColors, sizes: [] });
      setFilters(f => ({ ...f, color: '', size: '' }));
    } else {
      setFilteredOptions({ colors: [], sizes: [] });
    }
  }, [filters.reference, products]);
  
  useEffect(() => {
    setSelectedVariation(null);
    if (filters.color) {
      const product = products.find(p => p.reference === filters.reference);
      const availableSizes = product ? product.variations
          .filter(v => v.color === filters.color)
          .map(v => v.size)
          .sort((a, b) => a - b) : [];
      setFilteredOptions(o => ({ ...o, sizes: availableSizes }));
    } else {
       setFilteredOptions(o => ({ ...o, sizes: [] }));
    }
    setFilters(f => ({ ...f, size: '' }));
  }, [filters.color, filters.reference]);

  useEffect(() => {
    if (selectedVariation && barcodeContainerRef.current) {
      barcodeContainerRef.current.innerHTML = '';
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      barcodeContainerRef.current.appendChild(svg);
      try {
        JsBarcode(svg, selectedVariation.barcode_code, {
          format: 'CODE128',
          height: 80, width: 2, fontSize: 18, margin: 10,
          displayValue: true,
        });
      } catch (e) {
        barcodeContainerRef.current.innerHTML = `<p class="text-red-500">Error: Valor inválido para código de barras.</p>`;
      }
    } else if (barcodeContainerRef.current) {
      barcodeContainerRef.current.innerHTML = '';
    }
  }, [selectedVariation]);

  const handleFilterChange = (e) => setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleGenerate = () => {
    if (!filters.reference || !filters.color || !filters.size) {
      alert("Por favor, seleccione una referencia, color y talla.");
      return;
    }
    const product = products.find(p => p.reference === filters.reference);
    const variation = product?.variations.find(v => v.color === filters.color && v.size === filters.size);
    
    if (variation?.barcode_code) {
      setSelectedVariation(variation);
    } else {
      alert("No se encontró la variación o no tiene un código de barras asociado.");
      setSelectedVariation(null);
    }
  };

  const handleDownload = () => {
    if (barcodeContainerRef.current?.firstChild) {
      toPng(barcodeContainerRef.current, { cacheBust: true, backgroundColor: 'white' })
        .then((dataUrl) => {
          const link = document.createElement('a');
          link.download = `${selectedVariation.barcode_code}.png`;
          link.href = dataUrl;
          link.click();
        })
        .catch(err => console.error("Error al descargar la imagen:", err));
    }
  };

  const handlePrint = () => {
    if (selectedVariation && window.electronAPI) {
      window.electronAPI.printSticker({
        reference: filters.reference,
        color: filters.color,
        size: filters.size,
        barcode: selectedVariation.barcode_code,
      });
    }
  };

  if (!show) return null;
  const uniqueReferences = [...new Set(products.map(p => p.reference))].sort();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-2xl">
        <h2 className="text-2xl font-bold mb-4 text-pear-dark">Generar Código de Barras</h2>
        {loading && <p>Cargando datos...</p>}
        {error && <p className="text-red-500">{error}</p>}
        {!loading && !error && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <select name="reference" value={filters.reference} onChange={handleFilterChange} className="p-2 border rounded">
                <option value="">-- Referencia --</option>
                {uniqueReferences.map(ref => <option key={ref} value={ref}>{ref}</option>)}
              </select>
              <select name="color" value={filters.color} onChange={handleFilterChange} className="p-2 border rounded" disabled={!filters.reference}>
                <option value="">-- Color --</option>
                {filteredOptions.colors.map(color => <option key={color} value={color}>{color}</option>)}
              </select>
              <select name="size" value={filters.size} onChange={handleFilterChange} className="p-2 border rounded" disabled={!filters.color}>
                <option value="">-- Talla --</option>
                {filteredOptions.sizes.map(size => <option key={size} value={size}>{size}</option>)}
              </select>
            </div>
            
            <button onClick={handleGenerate} className="w-full bg-blue-600 text-white p-3 rounded-lg mb-4">Generar / Ver Código</button>

            <div ref={barcodeContainerRef} className="text-center p-4 border-dashed border-2 rounded-lg min-h-[120px] flex items-center justify-center">
              {!selectedVariation && <p className="text-gray-500">Seleccione para ver el código.</p>}
            </div>

            <div className="flex justify-end space-x-4 mt-6">
              <button onClick={handleDownload} disabled={!selectedVariation} className="bg-green-600 text-white px-5 py-2 rounded-lg disabled:bg-gray-400">Descargar</button>
              <button onClick={handlePrint} disabled={!selectedVariation} className="bg-pear-dark-green text-white px-5 py-2 rounded-lg disabled:bg-gray-400">Imprimir</button>
              <button onClick={onClose} className="bg-gray-500 text-white px-5 py-2 rounded-lg">Cerrar</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default BarcodeGeneratorModal;
