 import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Grid, 
  Card, 
  Typography, 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableRow 
} from '@mui/material';

const Dashboard = () => {
  const [tokens, setTokens] = useState([]);
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    // Connect to WebSocket for real-time updates
    const ws = new WebSocket('ws://localhost:3000');
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'TOKEN_UPDATED') {
        // Update token data
        setTokens(prevTokens => {
          const updatedTokens = [...prevTokens];
          const index = updatedTokens.findIndex(t => t.symbol === data.token.symbol);
          if (index !== -1) {
            updatedTokens[index] = data.token;
          }
          return updatedTokens;
        });
      }
    };

    // Fetch initial token data
    fetchTokens();
    fetchTransactions();

    return () => ws.close();
  }, []);

  const fetchTokens = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/tokens', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      setTokens(data);
    } catch (error) {
      console.error('Failed to fetch tokens:', error);
    }
  };

  const fetchTransactions = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/transactions', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      setTransactions(data);
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    }
  };

  return (
    <Box sx={{ flexGrow: 1, p: 3 }}>
      <Grid container spacing={3}>
        {/* Token Overview */}
        <Grid item xs={12}>
          <Card sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>Token Overview</Typography>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Symbol</TableCell>
                  <TableCell>Contract Address</TableCell>
                  <TableCell>Network</TableCell>
                  <TableCell>Forced Price</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tokens.map((token) => (
                  <TableRow key={token.symbol}>
                    <TableCell>{token.symbol}</TableCell>
                    <TableCell>{token.contractAddress}</TableCell>
                    <TableCell>{token.network}</TableCell>
                    <TableCell>${token.forcedPrice}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </Grid>

        {/* Recent Transactions */}
        <Grid item xs={12}>
          <Card sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>Recent Transactions</Typography>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Token</TableCell>
                  <TableCell>Amount</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {transactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell>{new Date(tx.timestamp).toLocaleString()}</TableCell>
                    <TableCell>{tx.type}</TableCell>
                    <TableCell>{tx.token}</TableCell>
                    <TableCell>{tx.amount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;