import React, { useState } from 'react';
import { 
  Box, 
  TextField, 
  Button, 
  Typography, 
  Container, 
  Paper,
  Alert 
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';

const StyledPaper = styled(Paper)(({ theme }) => ({
  backgroundColor: '#1a1b25',
  padding: theme.spacing(4),
  borderRadius: '16px',
  maxWidth: '400px',
  margin: '40px auto',
  textAlign: 'center'
}));

const StyledTextField = styled(TextField)({
  '& .MuiOutlinedInput-root': {
    color: '#fff',
    '& fieldset': {
      borderColor: '#374151',
    },
    '&:hover fieldset': {
      borderColor: '#4b5563',
    },
    '&.Mui-focused fieldset': {
      borderColor: '#7c3aed',
    },
  },
  '& .MuiInputLabel-root': {
    color: '#9ca3af',
  },
});

const StyledButton = styled(Button)({
  backgroundColor: '#7c3aed',
  padding: '12px',
  borderRadius: '8px',
  '&:hover': {
    backgroundColor: '#6d28d9',
  },
});

const Login = () => {
  const navigate = useNavigate();
  const [credentials, setCredentials] = useState({
    username: '',
    password: ''
  });
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(credentials)
      });

      const data = await response.json();
      if (response.ok) {
        localStorage.setItem('token', data.token);
        navigate('/dashboard');
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Login failed. Please try again.');
    }
  };

  return (
    <Container>
      <StyledPaper elevation={3}>
        <Typography variant="h4" sx={{ color: '#7c3aed', mb: 1 }}>
          Web3 Wallet
        </Typography>
        
        <Typography variant="subtitle1" sx={{ color: '#9ca3af', mb: 4 }}>
          Secure. Simple. Powerful.
        </Typography>

        <Typography variant="h5" sx={{ color: '#fff', mb: 1 }}>
          Welcome Back
        </Typography>
        
        <Typography variant="body1" sx={{ color: '#9ca3af', mb: 4 }}>
          Login to continue
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 3, backgroundColor: '#481111', color: '#fff' }}>
            {error}
          </Alert>
        )}

        <form onSubmit={handleLogin}>
          <StyledTextField
            fullWidth
            label="Username"
            margin="normal"
            value={credentials.username}
            onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
          />
          <StyledTextField
            fullWidth
            label="Password"
            type="password"
            margin="normal"
            value={credentials.password}
            onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
          />
          <StyledButton
            fullWidth
            variant="contained"
            type="submit"
            sx={{ mt: 3 }}
          >
            Login
          </StyledButton>
        </form>

        <Typography sx={{ color: '#9ca3af', mt: 3 }}>
          Don't have an account?{' '}
          <Button
            sx={{
              color: '#7c3aed',
              textTransform: 'none',
              '&:hover': {
                backgroundColor: 'transparent',
                textDecoration: 'underline',
              },
            }}
            onClick={() => navigate('/register')}
          >
            Create Account
          </Button>
        </Typography>
      </StyledPaper>
    </Container>
  );
};

export default Login;