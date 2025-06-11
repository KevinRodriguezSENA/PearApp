import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import supabase from './supabaseClient';
import Login from './components/Login';
import MainInterface from './components/MainInterface';
import UserManagement from './components/UserManagement';
import './styles.css';

function App() {
  const [user, setUser] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('Conectando...');
  const [loadingSession, setLoadingSession] = useState(true);

  const handleSetUser = (userData) => {
    if (userData) {
      localStorage.setItem('pear-user', JSON.stringify(userData));
    } else {
      localStorage.removeItem('pear-user');
      localStorage.removeItem('activeModule');
      localStorage.removeItem('themeColor');
      localStorage.removeItem('textColor');
    }
    setUser(userData);
  };

  const calculateTextColor = (hexColor) => {
    if (!hexColor || hexColor.length < 7) return '#FFFFFF';
    const r = parseInt(hexColor.substr(1, 2), 16);
    const g = parseInt(hexColor.substr(3, 2), 16);
    const b = parseInt(hexColor.substr(5, 2), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#000000' : '#FFFFFF';
  };

  useEffect(() => {
    async function testConnection() {
      try {
        const { error } = await supabase.from('users').select('id').limit(1);
        if (error) throw error;
        setConnectionStatus('¡Conectado a Supabase!');
      } catch (error) {
        setConnectionStatus('Error al conectar: ' + error.message);
      }
    }
    testConnection();

    async function initializeSession(session) {
      if (session) {
        const cachedUser = JSON.parse(localStorage.getItem('pear-user'));
        if (cachedUser && cachedUser.id === session.user.id) {
          handleSetUser(cachedUser);
          let themeColor = localStorage.getItem('themeColor') || '#2E7D32';
          const { data, error } = await supabase
            .from('settings')
            .select('value')
            .eq('key', `theme_color_${cachedUser.id}`)
            .single();
          if (!error && data) {
            themeColor = data.value || themeColor;
          }
          const textColor = calculateTextColor(themeColor);
          document.documentElement.style.setProperty('--theme-color', themeColor);
          document.documentElement.style.setProperty('--text-color', textColor);
          localStorage.setItem('themeColor', themeColor);
          localStorage.setItem('textColor', textColor);
          setLoadingSession(false);

          supabase
            .from('users')
            .update({ last_login: new Date().toISOString() })
            .eq('id', cachedUser.id)
            .then();
          return;
        }

        try {
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('id, username, role')
            .eq('id', session.user.id)
            .single();

          if (userError) {
            if (userError.code === 'PGRST116') {
              // No insertar automáticamente, dejar que UserManagement lo haga
              handleSetUser({ id: session.user.id, email: session.user.email, username: '', role: 'vendedor' });
            } else {
              throw userError;
            }
          } else {
            await supabase
              .from('users')
              .update({ last_login: new Date().toISOString() })
              .eq('id', userData.id);
            handleSetUser(userData);

            const { data: themeData, error: themeError } = await supabase
              .from('settings')
              .select('value')
              .eq('key', `theme_color_${userData.id}`)
              .single();
            let themeColor = themeData?.value || '#2E7D32';
            const textColor = calculateTextColor(themeColor);
            document.documentElement.style.setProperty('--theme-color', themeColor);
            document.documentElement.style.setProperty('--text-color', textColor);
            localStorage.setItem('themeColor', themeColor);
            localStorage.setItem('textColor', textColor);
          }
        } catch (err) {
          console.error('Error en la consulta a users:', err);
          handleSetUser(null);
          await supabase.auth.signOut();
        }
      } else {
        handleSetUser(null);
      }
      setLoadingSession(false);
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      initializeSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = JSON.parse(localStorage.getItem('pear-user'));
      if (session?.user?.id !== currentUser?.id) {
        await initializeSession(session);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const ProtectedRoute = ({ children }) => {
    if (loadingSession) {
      return <div className="p-4 text-center">Cargando...</div>;
    }
    if (!user) {
      return <Navigate to="/login" replace />;
    }
    return children;
  };

  return (
    <Router>
      <div className="min-h-screen" style={{ backgroundColor: 'var(--theme-color)' }}>
        <div className="p-4 text-pear-dark text-center">
          <p>{connectionStatus}</p>
        </div>
        <Routes>
          <Route path="/login" element={<Login setUser={handleSetUser} />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <MainInterface user={user} setUser={handleSetUser} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/users"
            element={
              <ProtectedRoute>
                {user && user.role === 'admin' ? (
                  <UserManagement />
                ) : (
                  <div className="text-red-500 text-center p-4">Acceso denegado.</div>
                )}
              </ProtectedRoute>
            }
          />
          <Route
            path="*"
            element={!user ? <Navigate to="/login" replace /> : <Navigate to="/" replace />}
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;