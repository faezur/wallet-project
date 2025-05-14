// src/context/AuthContext.jsx
import React, { createContext, useState } from 'react';
export const AuthContext = createContext();
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const login = (email, password) => {
    // Dummy auth: accept any email with password 'password123'
    if (password === 'password123') {
      setUser({ email });
      return true;
    }
    setUser(null);
    return false;
  };
  const signup = (email, password) => {
    // In a real app, you'd call an API here
    return true;
  };
  const logout = () => {
    setUser(null);
  };
  return (
    <AuthContext.Provider value={{ user, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
};