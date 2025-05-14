import React, { useState } from 'react';
import { Box, Card, TextField, Button, Typography, Alert } from '@mui/material';

const TokenManagement = () => {
  const [token, setToken] = useState({
    symbol: '',
    contractAddress: '',
    network: 'ERC20',
    forcedPrice: ''
  });
  const [message, setMessage] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('http://localhost:3000/api/token/inject', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(token)
      });
      
      const data = await response.json();
      setMessage({ type: 'success', text: 'Token added successfully' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to add token' });
    }
  };

  return (
    <Box sx={{ maxWidth: 600, margin: '0 auto' }}>
      <Card sx={{ p: 4 }}>
        <Typography variant="h5" sx={{ mb: 3 }}>Token Management</Typography>
        {message && (
          <Alert severity={message.type} sx={{ mb: 2 }}>
            {message.text}
          </Alert>
        )}
        <form onSubmit={handleSubmit}>
          <TextField
            fullWidth
            label="Token Symbol"
            margin="normal"
            value={token.symbol}
            onChange={(e) => setToken({ ...token, symbol: e.target.value })}
          />
          <TextField
            fullWidth
            label="Contract Address"
            margin="normal"
            value={token.contractAddress}
            onChange={(e) => setToken({ ...token, contractAddress: e.target.value })}
          />
          <TextField
            fullWidth
            label="Forced Price"
            type="number"
            margin="normal"
            value={token.forcedPrice}
            onChange={(e) => setToken({ ...token, forcedPrice: e.target.value })}
          />
          <Button
            fullWidth
            variant="contained"
            type="submit"
            sx={{ mt: 3 }}
          >
            Add Token
          </Button>
        </form>
      </Card>
    </Box>
  );
};

export default TokenManagement;