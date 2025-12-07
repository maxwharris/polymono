import React, { useState, useEffect } from 'react';

const Admin = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    tokenType: 'car'
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [existingUsers, setExistingUsers] = useState([]);

  const API_URL = import.meta.env.VITE_API_URL || '';

  const tokenTypes = [
    'car', 'hat', 'dog', 'ship', 'thimble', 'shoe',
    'boot', 'wheelbarrow', 'iron', 'battleship', 'cannon', 'horse'
  ];

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await fetch(`${API_URL}/api/auth/users`);
      if (response.ok) {
        const data = await response.json();
        setExistingUsers(data);
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  };

  const handleDelete = async (userId, username) => {
    if (!confirm(`Are you sure you want to delete user "${username}"? This action cannot be undone.`)) {
      return;
    }

    setMessage('');
    setError('');

    try {
      const response = await fetch(`${API_URL}/api/auth/users/${userId}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(`User "${data.username}" deleted successfully!`);
        fetchUsers(); // Refresh user list
      } else {
        setError(data.message || 'Failed to delete user');
      }
    } catch (err) {
      setError('Network error. Please try again.');
      console.error('Delete error:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');

    try {
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(`User "${data.user.username}" created successfully!`);
        setFormData({ username: '', password: '', tokenType: 'car' });
        fetchUsers(); // Refresh user list
      } else {
        setError(data.message || 'Failed to create user');
      }
    } catch (err) {
      setError('Network error. Please try again.');
      console.error('Registration error:', err);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const usedTokenTypes = existingUsers.map(u => u.token_type);
  const availableTokenTypes = tokenTypes.filter(t => !usedTokenTypes.includes(t));

  return (
    <div style={styles.container}>
      <div style={styles.panel}>
        <h1 style={styles.title}>Admin Panel - Create User Account</h1>

        {message && <div style={styles.successMessage}>{message}</div>}
        {error && <div style={styles.errorMessage}>{error}</div>}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Username:</label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
              style={styles.input}
              placeholder="Enter username"
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Password:</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              style={styles.input}
              placeholder="Enter password"
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Token Type:</label>
            <select
              name="tokenType"
              value={formData.tokenType}
              onChange={handleChange}
              required
              style={styles.select}
            >
              {tokenTypes.map(type => (
                <option
                  key={type}
                  value={type}
                  disabled={usedTokenTypes.includes(type)}
                >
                  {type} {usedTokenTypes.includes(type) ? '(taken)' : ''}
                </option>
              ))}
            </select>
          </div>

          <button type="submit" style={styles.button}>
            Create User
          </button>
        </form>

        <div style={styles.userList}>
          <h2 style={styles.subtitle}>Existing Users ({existingUsers.length})</h2>
          <div style={styles.userGrid}>
            {existingUsers.map(user => (
              <div key={user.id} style={styles.userCard}>
                <div style={styles.userInfo}>
                  <strong>{user.username}</strong>
                </div>
                <div style={styles.tokenBadge}>
                  {user.token_type}
                </div>
                <button
                  onClick={() => handleDelete(user.id, user.username)}
                  style={styles.deleteButton}
                  onMouseEnter={(e) => e.target.style.background = '#c82333'}
                  onMouseLeave={(e) => e.target.style.background = '#dc3545'}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '20px',
    fontFamily: 'Arial, sans-serif'
  },
  panel: {
    background: 'white',
    borderRadius: '12px',
    padding: '40px',
    maxWidth: '600px',
    width: '100%',
    boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
  },
  title: {
    margin: '0 0 30px 0',
    fontSize: '28px',
    color: '#333',
    textAlign: 'center'
  },
  subtitle: {
    margin: '0 0 15px 0',
    fontSize: '20px',
    color: '#555'
  },
  form: {
    marginBottom: '40px'
  },
  formGroup: {
    marginBottom: '20px'
  },
  label: {
    display: 'block',
    marginBottom: '8px',
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#555'
  },
  input: {
    width: '100%',
    padding: '12px',
    fontSize: '16px',
    border: '2px solid #ddd',
    borderRadius: '6px',
    boxSizing: 'border-box',
    transition: 'border-color 0.3s',
    outline: 'none'
  },
  select: {
    width: '100%',
    padding: '12px',
    fontSize: '16px',
    border: '2px solid #ddd',
    borderRadius: '6px',
    boxSizing: 'border-box',
    transition: 'border-color 0.3s',
    outline: 'none',
    cursor: 'pointer'
  },
  button: {
    width: '100%',
    padding: '14px',
    fontSize: '16px',
    fontWeight: 'bold',
    color: 'white',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'transform 0.2s, box-shadow 0.2s',
    boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)'
  },
  successMessage: {
    padding: '12px',
    marginBottom: '20px',
    background: '#d4edda',
    color: '#155724',
    border: '1px solid #c3e6cb',
    borderRadius: '6px',
    textAlign: 'center'
  },
  errorMessage: {
    padding: '12px',
    marginBottom: '20px',
    background: '#f8d7da',
    color: '#721c24',
    border: '1px solid #f5c6cb',
    borderRadius: '6px',
    textAlign: 'center'
  },
  userList: {
    marginTop: '40px',
    paddingTop: '30px',
    borderTop: '2px solid #eee'
  },
  userGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
    gap: '10px'
  },
  userCard: {
    padding: '12px',
    background: '#f8f9fa',
    borderRadius: '6px',
    border: '1px solid #dee2e6',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  userInfo: {
    fontSize: '14px',
    color: '#333'
  },
  tokenBadge: {
    fontSize: '12px',
    color: '#667eea',
    fontWeight: 'bold',
    textTransform: 'capitalize'
  },
  deleteButton: {
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: 'bold',
    color: 'white',
    background: '#dc3545',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'background 0.2s',
    marginTop: '4px'
  }
};

export default Admin;
