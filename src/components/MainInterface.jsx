import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import supabase from '../supabaseClient';
import SubInventoryManagement from './SubInventoryManagement';
import UserManagement from './UserManagement';
import Movements from './Movements';
import Production from './Production';
import StockView from './StockView';
import Home from './Home';
import Settings from './Settings';
import Orders from './Orders';
import Sales from './Sales';
import Notifications from './Notifications';

function MainInterface({ user, setUser }) {
  const [isSidebarVisible, setIsSidebarVisible] = useState(() => {
    return localStorage.getItem('isSidebarVisible') === 'false' ? false : true;
  });
  const [activeModule, setActiveModule] = useState(() => localStorage.getItem('activeModule') || 'home');
  const [productionSubmenuOpen, setProductionSubmenuOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [themeColor, setThemeColor] = useState(() => localStorage.getItem('themeColor') || '#2E7D32');
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    localStorage.setItem('activeModule', activeModule);
  }, [activeModule]);

  useEffect(() => {
    const loadThemeColor = async () => {
      if (user?.id) {
        try {
          const { data, error } = await supabase
            .from('settings')
            .select('value')
            .eq('key', `theme_color_${user.id}`)
            .maybeSingle();

          if (error && error.code !== 'PGRST116') {
            throw new Error(error.message);
          }
          
          if (data?.value) {
            const colorFromDB = data.value;
            setThemeColor(colorFromDB);
            localStorage.setItem('themeColor', colorFromDB);
          }
        } catch (err) {
          console.error('Error al cargar el color del tema:', err);
        }
      }
    };
    loadThemeColor();
  }, [user?.id]);

  useEffect(() => {
    document.documentElement.style.setProperty('--theme-color', themeColor);
  }, [themeColor]);

  useEffect(() => {
    localStorage.setItem('isSidebarVisible', isSidebarVisible);
  }, [isSidebarVisible]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };
  
  const messages = [
    'Confía en el Señor con todo tu corazón y no te apoyes en tu propia prudencia.',
    'Encomienda al Señor tu camino; confía en Él, y Él actuará.',
    'Los que confían en el Señor son como el monte de Sion, que no se mueve, sino que permanece para siempre.',
    'Tú guardarás en completa paz a aquel cuyo pensamiento en ti persevera, porque en ti ha confiado.',
    'Echa sobre Él toda tu ansiedad, porque Él cuida de ti.',
  ];

  const randomMessage = messages[Math.floor(Math.random() * messages.length)];

  const logMovement = async (variationId, movementType, quantity, method, details) => {
    try {
      const validMethods = ['manual', 'escaneo']; // Ajusta según el esquema
      const sanitizedMethod = validMethods.includes(method?.toLowerCase()) ? method.toLowerCase() : 'escaneo'; // Usa 'escaneo' por defecto
      const payload = {
        variation_id: variationId || null,
        user_id: user?.id || null,
        movement_type: movementType,
        quantity: parseInt(quantity) || 0,
        timestamp: new Date().toISOString(),
        method: sanitizedMethod,
        details: details ? JSON.stringify(details) : '{}'
      };
      const { error } = await supabase.from('inventory_movements').insert(payload);
      if (error) throw error;
    } catch (err) {
      console.error('Error logging movement:', err);
      setErrorMessage(`Error logging movement: ${err.message}`);
    }
  };

  const renderModule = () => {
    switch (activeModule) {
      case 'home':
        return (
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">
              Hola, {user?.username?.split('@')[0] || 'Usuario'}
            </h2>
            <p className="mb-6">{randomMessage}</p>
            <Home />
          </div>
        );
      case 'production':
        if (['admin', 'produccion'].includes(user?.role)) {
          return (
            <Production
              user={user}
              logMovement={logMovement}
              setError={setErrorMessage}
              errorMessage={errorMessage}
              activeSubmodule={'inventory'}
              setActiveModule={setActiveModule}
            />
          );
        }
        return <p className="text-red-500">Acceso denegado.</p>;
      case 'inventory':
        if (['admin', 'produccion'].includes(user?.role)) {
          return (
            <SubInventoryManagement
              logMovement={logMovement}
              setError={setErrorMessage}
              errorMessage={errorMessage}
              setShowInventory={() => setActiveModule('production')}
              user={user}
            />
          );
        }
        return <p className="text-red-500">Acceso denegado.</p>;
      case 'users':
        if (user?.role === 'admin') {
          return <UserManagement />;
        }
        return <p className="text-red-500">Acceso denegado.</p>;
      case 'movements':
        if (['admin', 'lector'].includes(user?.role)) {
          return <Movements />;
        }
        return <p className="text-red-500">Acceso denegado.</p>;
      case 'stock':
        if (['admin', 'vendedor', 'lector'].includes(user?.role)) {
          return <StockView setError={setErrorMessage} errorMessage={errorMessage} user={user} setActiveModule={setActiveModule} />;
        }
        return <p className="text-red-500">Acceso denegado.</p>;
      case 'orders':
        return <Orders user={user} />;
      case 'sales':
        if (['admin', 'vendedor'].includes(user?.role)) {
          return <Sales user={user} setError={setErrorMessage} errorMessage={errorMessage} />;
        }
        return <p className="text-red-500">Acceso denegado.</p>;
      case 'settings':
        return <Settings setThemeColor={setThemeColor} user={user} />;
      default:
        return (
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">
              Bienvenido, {user?.username?.split('@')[0] || 'Usuario'}
            </h2>
            <p className="mb-6">{randomMessage}</p>
          </div>
        );
    }
  };

  const CollapsedSidebar = () => (
    <div
      className="fixed top-16 bottom-0 text-white transition-all duration-300 z-40 w-16"
      style={{ height: 'calc(100vh - 4rem)', marginTop: '0rem', overflowY: 'auto', backgroundColor: 'var(--theme-color)' }}
    >
      <nav className="flex flex-col h-full p-2">
        <ul className="space-y-1 flex-1">
          <li>
            <button
              onClick={() => setActiveModule('home')}
              className={`flex items-center w-full p-2 rounded-lg hover:bg-pear-green transition-colors ${
                activeModule === 'home' ? 'bg-pear-green' : ''
              }`}
            >
              <svg
                className="w-5 h-5 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                />
              </svg>
            </button>
          </li>
          {['admin', 'produccion'].includes(user?.role) && (
            <li>
              <button
                onClick={() => {
                  setProductionSubmenuOpen(!productionSubmenuOpen);
                  if (!productionSubmenuOpen) setActiveModule('production');
                }}
                className={`flex items-center w-full p-2 rounded-lg hover:bg-pear-green transition-colors ${
                  activeModule === 'production' || activeModule === 'inventory' ? 'bg-pear-green' : ''
                }`}
              >
                <svg
                  className="w-5 h-5 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m4-6h4m-4 0a2 2 0 00-2 2v2m4 0V5a2 2 0 00-2-2"
                  />
                </svg>
              </button>
            </li>
          )}
          {user?.role === 'admin' && (
            <li>
              <button
                onClick={() => setActiveModule('users')}
                className={`flex items-center w-full p-2 rounded-lg hover:bg-pear-green transition-colors ${
                  activeModule === 'users' ? 'bg-pear-green' : ''
                }`}
              >
                <svg
                  className="w-5 h-5 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 4m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0m-4 8h14v2a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2z"
                  />
                </svg>
              </button>
            </li>
          )}
          {['admin', 'lector'].includes(user?.role) && (
            <li>
              <button
                onClick={() => setActiveModule('movements')}
                className={`flex items-center w-full p-2 rounded-lg hover:bg-pear-green transition-colors ${
                  activeModule === 'movements' ? 'bg-pear-green' : ''
                }`}
              >
                <svg
                  className="w-5 h-5 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 5H5v4M5 19h4m6-14h4v4m-4 10h4M5 5l14 14"
                  />
                </svg>
              </button>
            </li>
          )}
          {['admin', 'vendedor', 'lector'].includes(user?.role) && (
            <li>
              <button
                onClick={() => setActiveModule('stock')}
                className={`flex items-center w-full p-2 rounded-lg hover:bg-pear-green transition-colors ${
                  activeModule === 'stock' ? 'bg-pear-green' : ''
                }`}
              >
                <svg
                  className="w-5 h-5 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M20 7l-2-3h-12l-2 3m0 0v12a2 2 0 002 2h12a2 2 0 002-2V7m-8 5h4m-4 0H8m4 0V8"
                  />
                </svg>
              </button>
            </li>
          )}
          <li>
            <button
              onClick={() => setActiveModule('orders')}
              className={`flex items-center w-full p-2 rounded-lg hover:bg-pear-green transition-colors ${
                activeModule === 'orders' ? 'bg-pear-green' : ''
              }`}
            >
              <svg
                className="w-5 h-5 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2m-4 0h4m-4 0a2 2 0 00-2 2v2m4 0V5a2 2 0 00-2-2"
                />
              </svg>
            </button>
          </li>
          {['admin', 'vendedor'].includes(user?.role) && (
            <li>
              <button
                onClick={() => setActiveModule('sales')}
                className={`flex items-center w-full p-2 rounded-lg hover:bg-pear-green transition-colors ${
                  activeModule === 'sales' ? 'bg-pear-green' : ''
                }`}
              >
                <svg
                  className="w-5 h-5 flex-shrink-0"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 576 512"
                  fill="currentColor"
                >
                  <path d="M312 24l0 10.5c6.4 1.2 12.6 2.7 18.2 4.2c12.8 3.4 20.4 16.6 17 29.4s-16.6 20.4-29.4 17c-10.9-2.9-21.1-4.9-30.2-5c-7.3-.1-14.7 1.7-19.4 4.4c-2.1 1.3-3.1 2.4-3.5 3c-.3 .5-.7 1.2-.7 2.8c0 .3 0 .5 0 .6c.2 .2 .9 1.2 3.3 2.6c5.8 3.5 14.4 6.2 27.4 10.1l.9 .3s0 0 0 0c11.1 3.3 25.9 7.8 37.9 15.3c13.7 8.6 26.1 22.9 26.4 44.9c.3 22.5-11.4 38.9-26.7 48.5c-6.7 4.1-13.9 7-21.3 8.8l0 10.6c0 13.3-10.7 24-24 24s-24-10.7-24-24l0-11.4c-9.5-2.3-18.2-5.3-25.6-7.8c-2.1-.7-4.1-1.4-6-2c-12.6-4.2-19.4-17.8-15.2-30.4s17.8-19.4 30.4-15.2c2.6 .9 5 1.7 7.3 2.5c13.6 4.6 23.4 7.9 33.9 8.3c8 .3 15.1-1.6 19.2-4.1c1.9-1.2 2.8-2.2 3.2-2.9c.4-.6 .9-1.8 .8-4.1l0-.2c0-1 0-2.1-4-4.6c-5.7-3.6-14.3-6.4-27.1-10.3l-1.9-.6c-10.8-3.2-25-7.5-36.4-14.4c-13.5-8.1-26.5-22-26.6-44.1c-.1-22.9 12.9-38.6 27.7-47.4c6.4-3.8 13.3-6.4 20.2-8.2L264 24c0-13.3 10.7-24 24-24s24 10.7 24 24zM568.2 336.3c13.1 17.8 9.3 42.8-8.5 55.9L433.1 485.5c-23.4 17.2-51.6 26.5-80.7 26.5L192 512 32 512c-17.7 0-32-14.3-32-32l0-64c0-17.7 14.3-32 32-32l36.8 0 44.9-36c22.7-18.2 50.9-28 80-28l78.3 0 16 0 64 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-64 0-16 0c-8.8 0-16 7.2-16 16s7.2 16 16 16l120.6 0 119.7-88.2c17.8-13.1 42.8-9.3 55.9 8.5zM193.6 384c0 0 0 0 0 0l-.9 0c.3 0 .6 0 .9 0z" />
                </svg>
                <span className="text-sm"></span>
              </button>
            </li>
          )}
        </ul>
        <ul className="border-t border-pear-green pt-2 mt-4">
          <li>
            <button
              onClick={() => setActiveModule('settings')}
              className={`flex items-center w-full p-2 rounded-lg hover:bg-pear-green transition-colors ${
                activeModule === 'settings' ? 'bg-pear-green' : ''
              }`}
            >
              <svg
                className="w-5 h-5 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );

  const ExpandedSidebar = () => (
    <div
      className="fixed top-16 bottom-0 text-white transition-all duration-300 z-40 w-60"
      style={{ height: 'calc(100vh - 4rem)', marginTop: '0rem', overflowY: 'auto', backgroundColor: 'var(--theme-color)' }}
    >
      <nav className="flex flex-col h-full p-2">
        <ul className="space-y-1 flex-1">
          <li>
            <button
              onClick={() => setActiveModule('home')}
              className={`flex items-center w-full p-2 rounded-lg hover:bg-pear-green transition-colors ${
                activeModule === 'home' ? 'bg-pear-green' : ''
              }`}
            >
              <svg
                className="w-5 h-5 mr-3 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                />
              </svg>
              <span className="text-sm">Inicio</span>
            </button>
          </li>
          {['admin', 'produccion'].includes(user?.role) && (
            <li>
              <button
                onClick={() => {
                  setProductionSubmenuOpen(!productionSubmenuOpen);
                  if (!productionSubmenuOpen) setActiveModule('production');
                }}
                className={`flex items-center w-full p-2 rounded-lg hover:bg-pear-green transition-colors ${
                  activeModule === 'production' || activeModule === 'inventory' ? 'bg-pear-green' : ''
                }`}
              >
                <div className="flex items-center">
                  <svg
                    className="w-5 h-5 mr-3 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m4-6h4m-4 0a2 2 0 00-2 2v2m4 0V5a2 2 0 00-2-2"
                    />
                  </svg>
                  <span className="text-sm">Producción</span>
                </div>
              </button>
              {productionSubmenuOpen && (
                <ul className="pl-6 space-y-1">
                  <li>
                    <button
                      onClick={() => setActiveModule('inventory')}
                      className={`flex items-center w-full p-2 rounded-lg hover:bg-pear-green transition-colors ${
                        activeModule === 'inventory' ? 'bg-pear-green' : ''
                      }`}
                    >
                      <svg
                        className="w-5 h-5 mr-2 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m4-6h4m-4 0a2 2 0 00-2 2v2m4 0V5a2 2 0 00-2-2"
                        />
                      </svg>
                      <span className="text-sm">Ges. de Inventarios</span>
                    </button>
                  </li>
                </ul>
              )}
            </li>
          )}
          {user?.role === 'admin' && (
            <li>
              <button
                onClick={() => setActiveModule('users')}
                className={`flex items-center w-full p-2 rounded-lg hover:bg-pear-green transition-colors ${
                  activeModule === 'users' ? 'bg-pear-green' : ''
                }`}
              >
                <svg
                  className="w-5 h-5 mr-3 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 4m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0m-4 8h14v2a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2z"
                  />
                </svg>
                <span className="text-sm">Usuarios</span>
              </button>
            </li>
          )}
          {['admin', 'lector'].includes(user?.role) && (
            <li>
              <button
                onClick={() => setActiveModule('movements')}
                className={`flex items-center w-full p-2 rounded-lg hover:bg-pear-green transition-colors ${
                  activeModule === 'movements' ? 'bg-pear-green' : ''
                }`}
              >
                <svg
                  className="w-5 h-5 mr-3 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 5H5v4M5 19h4m6-14h4v4m-4 10h4M5 5l14 14"
                  />
                </svg>
                <span className="text-sm">Movimientos</span>
              </button>
            </li>
          )}
          {['admin', 'vendedor', 'lector'].includes(user?.role) && (
            <li>
              <button
                onClick={() => setActiveModule('stock')}
                className={`flex items-center w-full p-2 rounded-lg hover:bg-pear-green transition-colors ${
                  activeModule === 'stock' ? 'bg-pear-green' : ''
                }`}
              >
                <svg
                  className="w-5 h-5 mr-3 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M20 7l-2-3h-12l-2 3m0 0v12a2 2 0 002 2h12a2 2 0 002-2V7m-8 5h4m-4 0H8m4 0V8"
                  />
                </svg>
                <span className="text-sm">Stock</span>
              </button>
            </li>
          )}
          <li>
            <button
              onClick={() => setActiveModule('orders')}
              className={`flex items-center w-full p-2 rounded-lg hover:bg-pear-green transition-colors ${
                activeModule === 'orders' ? 'bg-pear-green' : ''
              }`}
            >
              <svg
                className="w-5 h-5 mr-3 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2m-4 0h4m-4 0a2 2 0 00-2 2v2m4 0V5a2 2 0 00-2-2"
                />
              </svg>
              <span className="text-sm">Pedidos</span>
            </button>
          </li>
          {['admin', 'vendedor'].includes(user?.role) && (
            <li>
              <button
                onClick={() => setActiveModule('sales')}
                className={`flex items-center w-full p-2 rounded-lg hover:bg-pear-green transition-colors ${
                  activeModule === 'sales' ? 'bg-pear-green' : ''
                }`}
              >
                <svg
                  className="w-5 h-5 mr-3 flex-shrink-0"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 576 512"
                  fill="currentColor"
                >
                  <path d="M312 24l0 10.5c6.4 1.2 12.6 2.7 18.2 4.2c12.8 3.4 20.4 16.6 17 29.4s-16.6 20.4-29.4 17c-10.9-2.9-21.1-4.9-30.2-5c-7.3-.1-14.7 1.7-19.4 4.4c-2.1 1.3-3.1 2.4-3.5 3c-.3 .5-.7 1.2-.7 2.8c0 .3 0 .5 0 .6c.2 .2 .9 1.2 3.3 2.6c5.8 3.5 14.4 6.2 27.4 10.1l.9 .3s0 0 0 0c11.1 3.3 25.9 7.8 37.9 15.3c13.7 8.6 26.1 22.9 26.4 44.9c.3 22.5-11.4 38.9-26.7 48.5c-6.7 4.1-13.9 7-21.3 8.8l0 10.6c0 13.3-10.7 24-24 24s-24-10.7-24-24l0-11.4c-9.5-2.3-18.2-5.3-25.6-7.8c-2.1-.7-4.1-1.4-6-2c-12.6-4.2-19.4-17.8-15.2-30.4s17.8-19.4 30.4-15.2c2.6 .9 5 1.7 7.3 2.5c13.6 4.6 23.4 7.9 33.9 8.3c8 .3 15.1-1.6 19.2-4.1c1.9-1.2 2.8-2.2 3.2-2.9c.4-.6 .9-1.8 .8-4.1l0-.2c0-1 0-2.1-4-4.6c-5.7-3.6-14.3-6.4-27.1-10.3l-1.9-.6c-10.8-3.2-25-7.5-36.4-14.4c-13.5-8.1-26.5-22-26.6-44.1c-.1-22.9 12.9-38.6 27.7-47.4c6.4-3.8 13.3-6.4 20.2-8.2L264 24c0-13.3 10.7-24 24-24s24 10.7 24 24zM568.2 336.3c13.1 17.8 9.3 42.8-8.5 55.9L433.1 485.5c-23.4 17.2-51.6 26.5-80.7 26.5L192 512 32 512c-17.7 0-32-14.3-32-32l0-64c0-17.7 14.3-32 32-32l36.8 0 44.9-36c22.7-18.2 50.9-28 80-28l78.3 0 16 0 64 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-64 0-16 0c-8.8 0-16 7.2-16 16s7.2 16 16 16l120.6 0 119.7-88.2c17.8-13.1 42.8-9.3 55.9 8.5zM193.6 384c0 0 0 0 0 0l-.9 0c.3 0 .6 0 .9 0z" />
                </svg>
                <span className="text-sm">Ventas</span>
              </button>
            </li>
          )}
        </ul>
        <ul className="border-t border-pear-green pt-2 mt-4">
          <li>
            <button
              onClick={() => setActiveModule('settings')}
              className={`flex items-center w-full p-2 rounded-lg hover:bg-pear-green transition-colors ${
                activeModule === 'settings' ? 'bg-pear-green' : ''
              }`}
            >
              <svg
                className="w-5 h-5 mr-3 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <span className="text-sm">Settings</span>
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen bg-pear-neutral">
      <header className="fixed top-0 left-0 right-0 z-50 text-white p-4 flex items-center justify-between shadow-md w-full" style={{ backgroundColor: 'var(--theme-color)' }}>
        <div className="flex items-center">
          <button
            onClick={() => setIsSidebarVisible(!isSidebarVisible)}
            className="p-1 rounded hover:bg-pear-green focus:outline-none mr-2"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d={isSidebarVisible ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'}
              />
            </svg>
          </button>
          <h1 className="text-xl font-bold">
            <span className="mr-2">🍐</span> PearAPP
          </h1>
        </div>
        <div className="flex items-center space-x-4">
          <span className="text-sm">
            Usuario: {user?.username?.split('@')[0] || 'N/A'} ({user?.role || 'N/A'})
          </span>
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-1 rounded hover:bg-pear-green focus:outline-none"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-5-5.917V5a1 1 0 10-2 0v.083A6.002 6.002 0 006 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
            </button>
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-250 bg-white rounded-lg shadow-lg z-50" style={{ width: '250px' }}>
                <Notifications user={user} setError={setErrorMessage} setActiveModule={setActiveModule} />
              </div>
            )}
          </div>
          <button
            onClick={handleLogout}
            className="bg-pear-yellow text-pear-dark px-3 py-1 rounded hover:bg-pear-green transition"
          >
            Cerrar Sesión
          </button>
        </div>
      </header>

      <div className="flex flex-1 pt-16">
        {isSidebarVisible ? <ExpandedSidebar /> : <CollapsedSidebar />}

        <main
          className="flex-1 p-6 transition-all duration-300"
          style={{ marginLeft: isSidebarVisible ? '15rem' : '4rem', marginTop: '4rem' }}
        >
          {renderModule()}
        </main>
      </div>
    </div>
  );
}

export default MainInterface;