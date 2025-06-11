// src/components/BarcodeGenerator.jsx
import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

const BarcodeGenerator = ({ data }) => {
  const barcodeRef = useRef(null);

  useEffect(() => {
    if (barcodeRef.current && data) {
      // Limpiar el contenedor antes de generar nuevos códigos
      barcodeRef.current.innerHTML = '';

      data.forEach((item, index) => {
        // Create a container for each barcode and its download button
        const itemContainer = document.createElement('div');
        itemContainer.className = 'barcode-item mb-4 p-4 border rounded shadow-sm'; // Add some styling

        const svgElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svgElement.setAttribute('id', `barcode-${item.id || index}`); // Use item.id if available, otherwise index
        itemContainer.appendChild(svgElement);

        // Append the container to the main barcodeRef
        barcodeRef.current.appendChild(itemContainer);

        try {
          // Construct the barcode string using the separated fields for consistency
          JsBarcode(`#barcode-${item.id || index}`, `${item.referencia}-${item.color}-${item.talla}`, {
            format: "CODE128",
            displayValue: true,
            fontSize: 16,
            width: 2,
            height: 100,
            margin: 10, // Add some margin around the barcode
          });
        } catch (e) {
          console.error(`Error generating barcode for ${item.barcode_code}:`, e);
        }
      });
    }
  }, [data]);

  const downloadBarcode = (itemId, barcodeCode) => {
    const svgId = `barcode-${itemId}`;
    const svgElement = document.getElementById(svgId);
    if (svgElement) {
      const serializer = new XMLSerializer();
      let source = serializer.serializeToString(svgElement);

      // Add XML declaration and DOCTYPE for better compatibility
      source = '<?xml version="1.0" standalone="no"?>\r\n<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\r\n' + source;

      const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = `barcode-${barcodeCode}.svg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div>
      <div ref={barcodeRef} className="barcode-list">
        {/* The barcodes will be rendered here by the useEffect hook */}
      </div>
      {/* Render download buttons separately to avoid re-rendering issues with JsBarcode */}
      <div className="mt-4">
        {data && data.map((item, index) => (
          <button
            key={item.id || index}
            onClick={() => downloadBarcode(item.id || index, item.barcode_code)}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mr-2 mb-2" // Tailwind classes for button
          >
            Descargar {item.barcode_code}
          </button>
        ))}
      </div>
    </div>
  );
};

export default BarcodeGenerator;