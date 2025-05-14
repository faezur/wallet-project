import React, { useState } from 'react';
import { 
  Box, 
  Card, 
  TextField, 
  Button, 
  Typography, 
  Alert,
  Select,
  MenuItem,
  FormControl,
  InputLabel 
} from '@mui/material';
import { tokenService } from '../services/api';

const TokenBurning = ({ tokens, onBurnComplete }) => {
  const [burnData, setBurnData] = useState({
    token_symbol: '',
    amount: '',
    network: 'ERC20'
  });
  const [message, setMessage] = useState(null);

  const handleBurn = async (e) => {
    e.preventDefault();
    try {
      await tokenService.burnToken(burnData);
      setMessage({ type: 'success', text: 'Tokens burned successfully' });
      if (onBurnComplete) onBurnComplete();
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.message || 'Failed to burn tokens' 
      });
    }
  };

  return (
    <Card sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" gutterBottom>Burn Tokens</Typography>
      {message && (
        <Alert severity={message.type} sx={{ mb: 2 }}>
          {message.text}
        </Alert>
      )}
      <form onSubmit={handleBurn}>
        <FormControl fullWidth margin="normal">
          <InputLabel>Token</InputLabel>
          <Select
            value={burnData.token_symbol}
            onChange={(e) => setBurnData({ ...burnData, token_symbol: e.target.value })}
          >
            {tokens.map((token) => (
              <MenuItem key={token.symbol} value={token.symbol}>
                {token.symbol}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          fullWidth
          label="Amount"
          type="number"
          margin="normal"
          value={burnData.amount}
          onChange={(e) => setBurnData({ ...burnData, amount: e.target.value })}
        />
        <Button
          fullWidth
          variant="contained"
          color="error"
          type="submit"
          sx={{ mt: 2 }}
        >
          Burn Tokens
        </Button>
      </form>
    </Card>
  );
};

export default TokenBurning;