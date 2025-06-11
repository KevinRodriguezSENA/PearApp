import React, { useState, useEffect, useRef } from 'react';
import Draggable from 'react-draggable';
import { ResizableBox } from 'react-resizable';
import supabase from '../supabaseClient';

const StickerMaster = ({ stickerData, onStyleChange, onPositionChange, onLogoUpload }) => {
  const { reference, color, size, barcode, styles, selectedField, logoUrl } = stickerData;
  const stickerRef = useRef(null);

  const handleDrag = (field, e, data) => {
    const stickerBounds = stickerRef.current.getBoundingClientRect();
    const newLeftPercent = (data.x / stickerBounds.width) * 100;
    const newTopPercent = (data.y / stickerBounds.height) * 100;
    const constrainedLeft = Math.max(0, Math.min(100, newLeftPercent));
    const constrainedTop = Math.max(0, Math.min(100, newTopPercent));
    onPositionChange(field, { left: `${constrainedLeft}%`, top: `${constrainedTop}%` });
  };

  const handleStyleChange = (styleKey, value) => {
    if (selectedField) {
      onStyleChange(selectedField, { ...styles[selectedField], [styleKey]: value });
    }
  };

  const handleResize = (field, e, { size }) => {
    onStyleChange(field, { width: `${size.width}px`, height: `${size.height}px` });
  };

  const gridLines = [];
  const cols = 3;
  const rows = 3;
  const widthPx = 340;
  const heightPx = 453;
  for (let i = 1; i < cols; i++) {
    const xPercent = (i * (113 / widthPx)) * 100;
    gridLines.push(
      <line
        key={`v-${i}`}
        x1={`${xPercent}%`}
        x2={`${xPercent}%`}
        y1="0%"
        y2="100%"
        stroke="gray"
        strokeWidth="0.5"
        opacity="0.3"
      />
    );
  }
  for (let i = 1; i < rows; i++) {
    const yPercent = (i * (151 / heightPx)) * 100;
    gridLines.push(
      <line
        key={`h-${i}`}
        x1="0%"
        x2="100%"
        y1={`${yPercent}%`}
        y2={`${yPercent}%`}
        stroke="gray"
        strokeWidth="0.5"
        opacity="0.3"
      />
    );
  }

  return (
    <div className="flex flex-col items-center">
      <div className="mb-2 p-2 bg-gray-200 rounded-lg flex space-x-2 w-[340px]">
        <select
          value={styles[selectedField]?.fontFamily || 'Arial'}
          onChange={(e) => handleStyleChange('fontFamily', e.target.value)}
          className="border border-pear-green rounded p-1"
        >
          <option value="Arial">Arial</option>
          <option value="Times New Roman">Times New Roman</option>
          <option value="Courier New">Courier New</option>
        </select>
        <input
          type="number"
          value={parseInt(styles[selectedField]?.fontSize || '16') || 16}
          onChange={(e) => handleStyleChange('fontSize', `${e.target.value}px`)}
          className="w-16 p-1 border border-pear-green rounded"
          min="8"
          max="24"
        />
        <button
          onClick={() => handleStyleChange('fontWeight', styles[selectedField]?.fontWeight === 'bold' ? 'normal' : 'bold')}
          className={`p-1 ${styles[selectedField]?.fontWeight === 'bold' ? 'bg-blue-500 text-white' : 'bg-gray-300'}`}
        >
          B
        </button>
        <button
          onClick={() => handleStyleChange('fontStyle', styles[selectedField]?.fontStyle === 'italic' ? 'normal' : 'italic')}
          className={`p-1 ${styles[selectedField]?.fontStyle === 'italic' ? 'bg-blue-500 text-white' : 'bg-gray-300'}`}
        >
          I
        </button>
        <button
          onClick={onLogoUpload}
          className="bg-pear-dark-green text-white p-1 rounded hover:bg-pear-green"
        >
          Agregar Logo
        </button>
      </div>
      <h4 className="text-lg text-pear-dark mb-2">Ajustes</h4>
      <div
        ref={stickerRef}
        className="bg-white p-4 rounded-lg shadow-md relative"
        style={{ width: `${widthPx}px`, height: `${heightPx}px`, position: 'relative', overflow: 'visible' }}
      >
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 1,
          }}
        >
          {gridLines}
        </svg>

        {logoUrl && (
          <Draggable
            bounds="parent"
            onStop={(e, data) => handleDrag('logo', e, data)}
            position={{
              x: (parseFloat(styles.logo?.left || '38.89') / 100) * widthPx,
              y: (parseFloat(styles.logo?.top || '4.17') / 100) * heightPx,
            }}
          >
            <ResizableBox
              width={parseFloat(styles.logo?.width || '100px') || 100}
              height={parseFloat(styles.logo?.height || '100px') || 100}
              onResize={(e, data) => handleResize('logo', e, data)}
              minConstraints={[75, 75]}
              maxConstraints={[200, 200]}
              style={{ position: 'relative', zIndex: 5 }}
            >
              <img
                src={logoUrl}
                alt="Logo"
                className="absolute cursor-move"
                style={{ width: '100%', height: '100%', objectFit: 'contain', zIndex: 6 }}
                onError={() => console.error('Error loading logo in StickerMaster')}
              />
            </ResizableBox>
          </Draggable>
        )}

        {['reference', 'color', 'size', 'barcode'].map((field) => (
          <Draggable
            key={field}
            bounds="parent"
            onStop={(e, data) => handleDrag(field, e, data)}
            onStart={() => onStyleChange(field, styles[field])}
            position={{
              x: (parseFloat(styles[field]?.left || '33.33') / 100) * widthPx,
              y: (parseFloat(styles[field]?.top || (field === 'barcode' ? '75' : '25')) / 100) * heightPx,
            }}
          >
            <ResizableBox
              width={parseFloat(styles[field]?.width || (field === 'barcode' ? 250 : 120)) || (field === 'barcode' ? 250 : 120)}
              height={parseFloat(styles[field]?.height || 40) || 40}
              onResize={(e, data) => handleResize(field, e, data)}
              minConstraints={[field === 'barcode' ? 150 : 80, 30]}
              maxConstraints={[field === 'barcode' ? 320 : 250, 120]}
              style={{
                position: 'absolute',
                border: selectedField === field ? '2px dashed blue' : 'none',
                zIndex: 5,
              }}
            >
              <div
                className="absolute cursor-move"
                style={{ ...styles[field], width: 'fit-content', padding: '2px', zIndex: 6 }}
              >
                <span>{field === 'barcode' ? barcode : stickerData[field] || field.charAt(0).toUpperCase() + field.slice(1)}</span>
              </div>
            </ResizableBox>
          </Draggable>
        ))}
      </div>
    </div>
  );
};

const StickerPreview = ({ sticker, onDelete, styles }) => {
  const scaleFactor = 340 / 113;

  const getScaledFontSize = (fontSize, defaultSize = 16) => {
    const parsedSize = parseInt(fontSize || defaultSize) || defaultSize;
    return parsedSize / scaleFactor;
  };

  return (
    <div
      className="border border-gray-300 relative"
      style={{ width: '113px', height: '151px', position: 'relative', zIndex: 2 }}
    >
      <button
        onClick={() => onDelete(sticker.id)}
        className="absolute top-0 right-0 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center"
        style={{ zIndex: 3 }}
      >
        X
      </button>
      {sticker.logoUrl && (
        <div
          className="absolute"
          style={{
            width: parseFloat(styles.logo?.width || '100px') / scaleFactor,
            height: parseFloat(styles.logo?.height || '100px') / scaleFactor,
            top: styles.logo?.top || '4.17%',
            left: styles.logo?.left || '38.89%',
            zIndex: 2,
          }}
        >
          <img
            src={sticker.logoUrl}
            alt="Logo"
            style={{ width: '100%', height: '100%', zIndex: 2 }}
            onError={() => console.error('Error loading logo in StickerPreview')}
          />
        </div>
      )}
      {['reference', 'color', 'size', 'barcode'].map((field) => (
        <div
          key={field}
          className="absolute"
          style={{
            top: styles[field]?.top || (field === 'barcode' ? '75%' : '25%'),
            left: styles[field]?.left || '33.33%',
            fontSize: getScaledFontSize(styles[field]?.fontSize, field === 'barcode' ? 10 : 16),
            fontFamily: styles[field]?.fontFamily || (field === 'barcode' ? 'monospace' : 'Arial'),
            fontWeight: styles[field]?.fontWeight || 'normal',
            fontStyle: styles[field]?.fontStyle || 'normal',
            width: styles[field]?.width ? `${parseFloat(styles[field]?.width) / scaleFactor}px` : 'fit-content',
            height: styles[field]?.height ? `${parseFloat(styles[field]?.height) / scaleFactor}px` : 'auto',
            textAlign: field === 'barcode' ? 'center' : 'left',
            zIndex: 2,
          }}
        >
          <span>{sticker[field]}</span>
        </div>
      ))}
    </div>
  );
};

const SubStickerGeneration = ({ setError, setShowStickerGen, user }) => {
  const [stickerRefs, setStickerRefs] = useState([]);
  const [showRefForm, setShowRefForm] = useState(false);
  const [refForm, setRefForm] = useState({ reference: '', color: '', size: '', quantity: 1, addToStock: false });
  const [masterStyles, setMasterStyles] = useState({
    logo: { top: '4.17%', left: '38.89%', width: '100px', height: '100px' },
    reference: { fontFamily: 'Arial', fontSize: '16px', top: '25%', left: '33.33%', width: '120px', height: '40px' },
    color: { fontFamily: 'Arial', fontSize: '16px', top: '41.67%', left: '33.33%', width: '120px', height: '40px' },
    size: { fontFamily: 'Arial', fontSize: '16px', top: '58.33%', left: '33.33%', width: '120px', height: '40px' },
    barcode: { fontFamily: 'monospace', fontSize: '10px', top: '75%', left: '5.56%', width: '250px', height: '40px' },
  });
  const [selectedField, setSelectedField] = useState('reference');
  const [logoUrl, setLogoUrl] = useState(null);

  useEffect(() => {
    const loadSettings = async () => {
      const { data, error } = await supabase.from('settings').select('value').eq('key', 'sticker_layout').single();
      if (data && data.value) {
        setMasterStyles(JSON.parse(data.value));
      }
      if (error) {
        console.error('Error loading sticker layout:', error);
      }
    };
    loadSettings();
  }, []);

  const handleAddProduct = async (e) => {
    e.preventDefault();
    if (!refForm.reference || !refForm.color || !refForm.size || refForm.quantity < 1) {
      alert('Por favor, completa todos los campos del formulario.');
      return;
    }

    const barcode = `${refForm.reference}-${refForm.color}-${refForm.size}`;
    const newRef = {
      id: Date.now(),
      reference: refForm.reference,
      color: refForm.color,
      size: refForm.size,
      barcode,
      logoUrl,
    };
    const refsToAdd = Array.from({ length: refForm.quantity }, (_, i) => ({
      ...newRef,
      id: `${newRef.id}-${i}`,
    }));
    setStickerRefs([...stickerRefs, ...refsToAdd]);

    if (refForm.addToStock) {
      try {
        const { data: productData } = await supabase
          .from('products')
          .select('id')
          .eq('reference', refForm.reference)
          .single();

        let productId = productData?.id;
        if (!productId) {
          const { data: newProduct, error: productError } = await supabase
            .from('products')
            .insert({ reference: refForm.reference, created_by: user ? user.id : null })
            .select()
            .single();
          if (productError) throw productError;
          productId = newProduct.id;
        }

        const { data: existingVariation } = await supabase
          .from('variations')
          .select('id, stock')
          .eq('product_id', productId)
          .eq('color', refForm.color)
          .eq('size', refForm.size)
          .single();

        if (existingVariation) {
          await supabase
            .from('variations')
            .update({ stock: existingVariation.stock + refForm.quantity })
            .eq('id', existingVariation.id);
        } else {
          await supabase.from('variations').insert({
            product_id: productId,
            color: refForm.color,
            size: refForm.size,
            stock: refForm.quantity,
            barcode_code: barcode,
            created_at: new Date().toISOString(),
            created_by: user ? user.id : null, // Usar user.id
          });
        }

        await supabase.from('inventory_movements').insert({
          variation_id: existingVariation?.id || (await supabase.from('variations').select('id').eq('barcode_code', barcode).single()).id,
          user_id: user ? user.id : null, // Usar user.id
          movement_type: 'entrada',
          quantity: refForm.quantity,
          method: 'manual',
          details: JSON.stringify({ reference: refForm.reference, color: refForm.color, size: refForm.size }),
        });
      } catch (err) {
        setError(`Error al agregar al stock: ${err.message}`);
      }
    }

    const { data: variation } = await supabase
      .from('variations')
      .select('id')
      .eq('barcode_code', barcode)
      .single();

    if (variation) {
      await supabase.from('print_jobs').insert({
        variation_id: variation.id,
        quantity: refForm.quantity,
        add_to_stock: refForm.addToStock,
        requested_by: user ? user.id : null, // Usar user.id
        created_at: new Date().toISOString(),
      });
    }

    setRefForm({ reference: '', color: '', size: '', quantity: 1, addToStock: false });
    setShowRefForm(false);
  };

  const removeStickerRef = (id) => {
    setStickerRefs(stickerRefs.filter((ref) => ref.id !== id));
  };

  const handleStyleChange = (field, newStyles) => {
    setSelectedField(field);
    setMasterStyles((prev) => ({
      ...prev,
      [field]: { ...prev[field], ...newStyles },
    }));
  };

  const handlePositionChange = (field, position) => {
    setMasterStyles((prev) => ({
      ...prev,
      [field]: { ...prev[field], ...position },
    }));
  };

  const handleLogoUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setLogoUrl(reader.result);
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  const printStickers = async () => {
  if (!stickerRefs.length) {
    alert('No hay referencias para imprimir.');
    return;
  }

  await supabase.from('settings').upsert({
    key: 'sticker_layout',
    value: JSON.stringify(masterStyles),
  });

  const stickersToPrint = stickerRefs.map((ref) => ({
    reference: ref.reference,
    color: ref.color,
    size: ref.size,
    barcode: ref.barcode,
    logoUrl: ref.logoUrl,
    styles: masterStyles,
  }));

  try {
    // Usar la API de Electron en lugar de fetch
    stickersToPrint.forEach((sticker) => {
      window.electronAPI.printSticker(sticker);
    });
    console.log('Stickers enviados a la impresora.');
  } catch (err) {
    console.error('Error printing stickers:', err);
    setError('Error al enviar a la impresora.');
  }
};

  return (
    <div className="bg-pear-neutral p-6">
      <div className="flex justify-between mb-4">
        <button
          onClick={() => setShowStickerGen(false)}
          className="bg-pear-yellow text-pear-dark p-2 rounded hover:bg-pear-green transition"
        >
          Volver
        </button>
        <button
          onClick={() => setShowRefForm(true)}
          className="bg-pear-dark-green text-white p-2 rounded hover:bg-pear-green transition"
        >
          Agregar Referencias
        </button>
      </div>

      {showRefForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg w-full max-w-md">
            <h3 className="text-xl font-bold text-pear-dark-green mb-4">Agregar Referencia</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-pear-dark">Referencia</label>
                <input
                  type="text"
                  value={refForm.reference}
                  onChange={(e) => setRefForm({ ...refForm, reference: e.target.value })}
                  className="w-full p-2 border border-pear-green rounded"
                  required
                />
              </div>
              <div>
                <label className="block text-pear-dark">Color</label>
                <input
                  type="text"
                  value={refForm.color}
                  onChange={(e) => setRefForm({ ...refForm, color: e.target.value })}
                  className="w-full p-2 border border-pear-green rounded"
                  required
                />
              </div>
              <div>
                <label className="block text-pear-dark">Talla</label>
                <select
                  value={refForm.size}
                  onChange={(e) => setRefForm({ ...refForm, size: e.target.value })}
                  className="w-full p-2 border border-pear-green rounded"
                  required
                >
                  <option value="">Selecciona una talla</option>
                  {['34', '35', '36', '37', '38', '39', '40', '41'].map((size) => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-pear-dark">Cantidad de Stickers</label>
                <input
                  type="number"
                  value={refForm.quantity}
                  onChange={(e) => setRefForm({ ...refForm, quantity: parseInt(e.target.value) || 1 })}
                  className="w-full p-2 border border-pear-green rounded"
                  min="1"
                  required
                />
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={refForm.addToStock}
                  onChange={(e) => setRefForm({ ...refForm, addToStock: e.target.checked })}
                  className="mr-2"
                />
                <label className="text-pear-dark">Agregar a Stock</label>
              </div>
            </div>
            <div className="mt-4 flex justify-end space-x-2">
              <button
                onClick={() => setShowRefForm(false)}
                className="bg-pear-yellow text-pear-dark p-2 rounded hover:bg-pear-green"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddProduct}
                className="bg-pear-dark-green text-white p-2 rounded hover:bg-pear-green"
              >
                Agregar
              </button>
            </div>
          </div>
        </div>
      )}

      <h3 className="text-xl text-pear-dark mb-2">Previsualización de Stickers</h3>
      <div className="flex space-x-6">
        <div className="flex-1">
          <div className="bg-white p-4 rounded-lg shadow-md max-h-96 overflow-y-auto">
            <div className="grid grid-cols-3 gap-2">
              {stickerRefs.map((ref) => (
                <StickerPreview
                  key={ref.id}
                  sticker={ref}
                  onDelete={removeStickerRef}
                  styles={masterStyles}
                />
              ))}
            </div>
            <button
              onClick={printStickers}
              className="bg-pear-dark-green text-white p-2 rounded hover:bg-pear-green transition w-full mt-4"
            >
              Imprimir Stickers
            </button>
          </div>
        </div>
        <div>
          <StickerMaster
            stickerData={{
              reference: stickerRefs.length > 0 ? stickerRefs[0].reference : 'Referencia',
              color: stickerRefs.length > 0 ? stickerRefs[0].color : 'Color',
              size: stickerRefs.length > 0 ? stickerRefs[0].size : 'Talla',
              barcode: stickerRefs.length > 0 ? stickerRefs[0].barcode : '[Barcode: Ejemplo]',
              styles: masterStyles,
              selectedField,
              logoUrl,
            }}
            onStyleChange={handleStyleChange}
            onPositionChange={handlePositionChange}
            onLogoUpload={handleLogoUpload}
          />
        </div>
      </div>
    </div>
  );
};

export default SubStickerGeneration;