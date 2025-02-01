import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  Grid,
  useTheme,
  IconButton,
} from '@mui/material';
import {
  Person as PersonIcon,
  Tune as TuneIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import { keyframes } from '@emotion/react';

const shineAnimation = keyframes`
  0% { background-position: -100px; }
  100% { background-position: 200px; }
`;

const SettingForm = () => {
  const theme = useTheme();
  const [aboutMe, setAboutMe] = useState('');
  const [preferences, setPreferences] = useState('');

  useEffect(() => {
    const savedAboutMe = localStorage.getItem('aboutMe');
    const savedPreferences = localStorage.getItem('preferences');
    if (savedAboutMe) setAboutMe(savedAboutMe);
    if (savedPreferences) setPreferences(savedPreferences);
  }, []);

  const handleSave = () => {
    localStorage.setItem('aboutMe', aboutMe);
    localStorage.setItem('preferences', preferences);
    alert('Settings saved successfully!');
  };

  const SettingBox = ({ title, icon, content, setContent }) => (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        height: '100%',
        background: 'transparent',
        transition: 'all 0.3s ease',
        '&:hover': {
          '& .MuiTextField-root': {
            transform: 'scale(1.05)',
            boxShadow: theme.shadows[4],
          },
        },
      }}
    >
      <Box 
        sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          mb: 2,
          position: 'relative',
          overflow: 'hidden',
          '&::after': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: -100,
            width: '150%',
            height: '100%',
            background: `linear-gradient(90deg, transparent, ${theme.palette.primary.main}33, transparent)`,
            animation: `${shineAnimation} 3s infinite linear`,
          },
        }}
      >
        <IconButton
          color="primary"
          sx={{
            mr: 1,
            backgroundColor: theme.palette.action.hover,
          }}
        >
          {icon}
        </IconButton>
        <Typography 
          variant="h6" 
          sx={{ 
            fontWeight: 'bold',
            background: `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          {title}
        </Typography>
      </Box>
      <TextField
        fullWidth
        multiline
        rows={8}
        variant="outlined"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={`Enter your ${title.toLowerCase()}...`}
        sx={{
          mb: 2,
          transition: 'all 0.3s ease',
          '& .MuiOutlinedInput-root': {
            '& fieldset': {
              borderColor: theme.palette.divider,
            },
            '&:hover fieldset': {
              borderColor: theme.palette.primary.main,
            },
            '&.Mui-focused fieldset': {
              borderColor: theme.palette.primary.main,
            },
          },
        }}
      />
    </Paper>
  );

  return (
    <Box sx={{ flexGrow: 1, p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ mb: 4, textAlign: 'center' }}>
        Personalize Your Experience
      </Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <SettingBox
            title="About Me"
            icon={<PersonIcon />}
            content={aboutMe}
            setContent={setAboutMe}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <SettingBox
            title="Preferences"
            icon={<TuneIcon />}
            content={preferences}
            setContent={setPreferences}
          />
        </Grid>
      </Grid>
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <Button
          variant="contained"
          color="primary"
          onClick={handleSave}
          startIcon={<SaveIcon />}
          sx={{
            px: 4,
            py: 1.5,
            borderRadius: '12px',
            fontSize: '1rem',
            fontWeight: 600,
            textTransform: 'none',
            transition: 'all 0.3s ease',
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: theme.shadows[4],
            },
          }}
        >
          Save Settings
        </Button>
      </Box>
    </Box>
  );
};

export default SettingForm;
