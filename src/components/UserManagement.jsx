import React, { useState, useEffect } from 'react';

function UserManagement() {
  const [users, setUsers] = useState([]);
  const [newEmail, setnewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newUsername, setnewUsername] = useState('');
  const [newRole, setNewRole] = useState('vendedor');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Error al cargar usuarios');
      setUsers(data);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch('http://localhost:5000/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail, password: newPassword, username: newUsername, role: newRole }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Error al agregar usuario');

      setnewEmail('');
      setNewPassword('');
      setnewUsername('');
      setNewRole('vendedor');
      await fetchUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (id) => {
    try {
      const response = await fetch(`http://localhost:5000/api/users/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Error al eliminar usuario');
      await fetchUsers();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="bg-pear-neutral p-6">
      <h2 className="text-2xl font-bold text-pear-dark-green mb-4">Gestión de Usuarios</h2>
      {error && <p className="text-red-500">{error}</p>}
      <form onSubmit={handleAddUser} className="mb-6 space-y-4">
        <div>
          <label className="block text-pear-dark">Correo Electrónico (Usuario)</label>
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setnewEmail(e.target.value)}
            placeholder="Ingrese el correo electrónico"
            className="w-full p-2 border border-pear-green rounded"
            required
          />
        </div>
        <div>
          <label className="block text-pear-dark">Nombre</label>
          <input
            type="text"
            value={newUsername}
            onChange={(e) => setnewUsername(e.target.value)}
            placeholder="Ingrese el nombre"
            className="w-full p-2 border border-pear-green rounded"
            required
          />
        </div>
        <div>
          <label className="block text-pear-dark">Contraseña</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full p-2 border border-pear-green rounded"
            required
          />
        </div>
        <div>
          <label className="block text-pear-dark">Rol</label>
          <select
            value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
            className="w-full p-2 border border-pear-green rounded"
          >
            <option value="admin">Admin</option>
            <option value="vendedor">Vendedor</option>
            <option value="produccion">Producción</option>
            <option value="lector">Lector</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={loading}
          className={`bg-pear-dark-green text-white p-2 rounded hover:bg-pear-green transition ${
            loading ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {loading ? 'Agregando...' : 'Agregar Usuario'}
        </button>
      </form>

      <ul className="space-y-2">
        {users.map((user) => (
          <li key={user.id} className="flex justify-between items-center bg-white p-2 rounded">
            <span>
              {user.username} ({user.email}, {user.role})
            </span>
            <button
              onClick={() => handleDeleteUser(user.id)}
              className="bg-red-500 text-white p-1 rounded hover:bg-red-600"
            >
              Eliminar
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default UserManagement;