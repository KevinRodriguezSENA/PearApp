import React from 'react';
import SubInventoryManagement from './SubInventoryManagement';


const Production = ({ user, logMovement, setError, errorMessage, activeSubmodule, setActiveModule }) => {
  const renderSubmodule = () => {
    if (activeSubmodule === 'inventory') {
      return (
        <SubInventoryManagement
          logMovement={logMovement}
          setError={setError}
          errorMessage={errorMessage}
          setShowInventory={() => setActiveModule('production')}
          user={user}
        />
      );
    }
    
    // Default view with two rectangles for submodules
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div
          className="bg-white p-6 rounded-lg shadow-md hover:bg-pear-green cursor-pointer transition"
          onClick={() => setActiveModule('inventory')}
        >
          <h3 className="text-xl font-bold text-pear-dark-green mb-2">Gestión de Inventario</h3>
          <p className="text-pear-dark">Crea, edita y elimina referencias de productos.</p>
        </div>
        <div
          className="bg-white p-6 rounded-lg shadow-md hover:bg-pear-green cursor-pointer transition"
          onClick={() => setActiveModule('stickers')}
        >
          <h3 className="text-xl font-bold text-pear-dark-green mb-2">Generación de Stickers</h3>
          <p className="text-pear-dark">Imprime stickers con códigos de barras para productos.</p>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-pear-neutral p-6 min-h-screen">
      <h2 className="text-2xl font-bold text-pear-dark-green mb-4 flex items-center">
        <span className="mr-2"></span> Módulo de Producción
      </h2>
      {errorMessage && <p className="text-red-500 mb-4">{errorMessage}</p>}
      {renderSubmodule()}
    </div>
  );
};

export default Production;