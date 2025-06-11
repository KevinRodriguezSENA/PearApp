// Settings.jsx
import React, { useState, useEffect } from 'react';
import supabase from '../supabaseClient';

function Settings({ user }) {
  const [settings, setSettings] = useState({
    themeColor: '#2E7D32',
    suggestedSizes: { 34: 0, 35: 1, 36: 2, 37: 3, 38: 3, 39: 2, 40: 1, 41: 0 },
    notificationPrefs: { receiveSaleNotifications: true, receiveOrderNotifications: true, fromUsers: [] },
  });
  const [allUsers, setAllUsers] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const sizes = ['34', '35', '36', '37', '38', '39', '40', '41'];

  const calculateTextColor = (hexColor) => {
    if (!hexColor || hexColor.length < 7) return '#FFFFFF';
    const r = parseInt(hexColor.substr(1, 2), 16);
    const g = parseInt(hexColor.substr(3, 2), 16);
    const b = parseInt(hexColor.substr(5, 2), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#000000' : '#FFFFFF';
  };

  useEffect(() => {
    if (user?.id) {
      const loadSettings = async () => {
        setLoading(true);
        setError(null);
        try {
          const { data, error: settingsError } = await supabase
            .from('settings')
            .select('key, value')
            .or(`key.eq.theme_color_${user.id},key.eq.suggested_sizes_${user.id},key.eq.notification_prefs_${user.id}`);

          if (settingsError) throw settingsError;

          const loadedSettings = {
            themeColor: '#2E7D32', // Valor por defecto si no hay datos en Supabase
            suggestedSizes: { 34: 0, 35: 1, 36: 2, 37: 3, 38: 3, 39: 2, 40: 1, 41: 0 },
            notificationPrefs: { receiveSaleNotifications: true, receiveOrderNotifications: true, fromUsers: [] },
          };

          for (const setting of data) {
            if (setting.key === `theme_color_${user.id}`) {
              loadedSettings.themeColor = setting.value;
            }
            if (setting.key === `suggested_sizes_${user.id}`) {
              loadedSettings.suggestedSizes = JSON.parse(setting.value);
            }
            if (setting.key === `notification_prefs_${user.id}`) {
              loadedSettings.notificationPrefs = JSON.parse(setting.value);
            }
          }

          // Aplicar el color del tema al :root antes de actualizar el estado
          const finalColor = loadedSettings.themeColor;
          const finalTextColor = calculateTextColor(finalColor);
          document.documentElement.style.setProperty('--theme-color', finalColor);
          document.documentElement.style.setProperty('--text-color', finalTextColor);

          // Actualizar el estado después de aplicar el color
          setSettings(loadedSettings);

        } catch (err) {
          console.error('Error al cargar configuraciones:', err);
          setError(`Error al cargar configuraciones: ${err.message}`);
        } finally {
          setLoading(false);
        }
      };

      const fetchUsers = async () => {
        try {
          const { data, error } = await supabase.from('users').select('id, username');
          if (error) throw error;
          setAllUsers(data);
        } catch (err) {
          setError(`Error al cargar usuarios: ${err.message}`);
        }
      };
      
      loadSettings();
      fetchUsers();
    }
  }, [user?.id]);

  const handleSettingsChange = (field, value) => {
    setSettings(prev => {
      const newSettings = { ...prev };
      let current = newSettings;
      const path = field.split('.');
      for (let i = 0; i < path.length - 1; i++) {
        current = current[path[i]];
      }
      current[path[path.length - 1]] = value;
      return newSettings;
    });
  };

  const handleColorChange = (e) => {
    const newColor = e.target.value;
    handleSettingsChange('themeColor', newColor);
    const newTextColor = calculateTextColor(newColor);
    document.documentElement.style.setProperty('--theme-color', newColor);
    document.documentElement.style.setProperty('--text-color', newTextColor);
  };
  
  const handleSaveAllSettings = async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const settingsToUpsert = [
        { key: `theme_color_${user.id}`, value: settings.themeColor, user_id: user.id },
        { key: `notification_prefs_${user.id}`, value: JSON.stringify(settings.notificationPrefs), user_id: user.id },
      ];
      
      if (['admin', 'produccion'].includes(user.role)) {
        settingsToUpsert.push({
          key: `suggested_sizes_${user.id}`,
          value: JSON.stringify(settings.suggestedSizes),
          user_id: user.id,
        });
      }

      const { error } = await supabase.from('settings').upsert(settingsToUpsert, {
        onConflict: 'key',
      });

      if (error) throw error;
      
      alert('¡Todas las configuraciones se han guardado con éxito!');
    } catch (err) {
      console.error('Error al guardar configuraciones:', err);
      setError(`Error al guardar configuraciones: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-6">Cargando configuraciones...</div>;
  }

  return (
    <div className="settings-container" >
      <h2 className="text-2xl font-bold mb-4 flex items-center">
        <span className="mr-2">⚙️</span> Ajustes
      </h2>
      {error && <p className="text-red-500 mb-4">{error}</p>}
      
      {/* SECCIÓN DE COLOR */}
      <div className="mb-4">
        <h3 className="text-lg font-semibold mb-2">Personalizar Color del Tema</h3>
        <label className="block mb-2">
          Selecciona un color para el tema del sitio:
        </label>
        <input
          type="color"
          value={settings.themeColor}
          onChange={handleColorChange}
          className="w-16 h-10 border border-gray-300 rounded"
          disabled={user?.role === 'lector'}
        />
        <span className="ml-2">{settings.themeColor}</span>
      </div>
      
      {/* SECCIÓN DE TALLAS SUGERIDAS (Solo para admin y produccion) */}
      {['admin', 'produccion'].includes(user.role) && (
        <div className="mt-6">
          <h3 className="text-lg font-bold mb-2">Tallas Sugeridas para Stock</h3>
          <p className="mb-4">Define la cantidad sugerida para cada talla en las órdenes automáticas de stock.</p>
          <div className="flex flex-wrap gap-4 mb-4">
            {sizes.map(size => (
              <div key={size} className="flex flex-col items-center">
                <label className="text-sm mb-1">Talla {size}</label>
                <input
                  type="number"
                  value={settings.suggestedSizes[size]}
                  onChange={(e) => handleSettingsChange(`suggestedSizes.${size}`, parseInt(e.target.value) || 0)}
                  className="w-16 p-1 border rounded text-sm text-center"
                  min="0"
                />
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* SECCIÓN DE NOTIFICACIONES */}
      <div className="mt-6">
        <h3 className="text-lg font-bold mb-2">Preferencias de Notificaciones</h3>
        <div className="space-y-2">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={settings.notificationPrefs.receiveSaleNotifications}
              onChange={(e) => handleSettingsChange('notificationPrefs.receiveSaleNotifications', e.target.checked)}
              className="mr-2"
              disabled={user?.role === 'lector'}
            />
            Recibir notificaciones de ventas
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={settings.notificationPrefs.receiveOrderNotifications}
              onChange={(e) => handleSettingsChange('notificationPrefs.receiveOrderNotifications', e.target.checked)}
              className="mr-2"
              disabled={user?.role === 'lector'}
            />
            Recibir notificaciones de órdenes
          </label>
          <div>
            <label className="block my-2">Dejar de recibir notificaciones de:</label>
            {allUsers.filter(u => u.id !== user.id).map(u => (
              <label key={u.id} className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.notificationPrefs.fromUsers.includes(u.id)}
                  onChange={(e) => {
                    const currentBlocked = settings.notificationPrefs.fromUsers || [];
                    const updatedUsers = e.target.checked
                      ? [...currentBlocked, u.id]
                      : currentBlocked.filter(id => id !== u.id);
                    handleSettingsChange('notificationPrefs.fromUsers', updatedUsers);
                  }}
                  className="mr-2"
                  disabled={user?.role === 'lector'}
                />
                {u.username}
              </label>
            ))}
          </div>
        </div>
      </div>
      
      {/* BOTÓN ÚNICO DE GUARDADO */}
      <div className="mt-8 border-t pt-4">
        {user?.role !== 'lector' && (
          <button
            onClick={handleSaveAllSettings}
            disabled={loading}
            className={`w-full bg-pear-dark-green text-white px-6 py-3 rounded hover:bg-pear-green transition-all ${
              loading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {loading ? 'Guardando...' : 'Guardar todos los cambios'}
          </button>
        )}
      </div>
    </div>
  );
}

export default Settings;