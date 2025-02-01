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
      elevation={3}
      sx={{
        p: 3,
        height: '100%',
        background: theme.palette.mode === 'dark'
          ? 'rgba(45, 55, 72, 0.8)'
          : 'rgba(255, 255, 255, 0.8)',
        backdropFilter: 'blur(10px)',
        borderRadius: '12px',
        position: 'relative',
        overflow: 'hidden',
        transition: 'transform 0.3s ease, box-shadow 0.3s ease',
        '&:hover': {
          transform: 'scale(1.02)',
          boxShadow: theme.shadows[6],
        },
      }}
    >
      {/* Header with icon and title */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          mb: 2,
          position: 'relative',
          zIndex: 1, // Ensures the header content stays above the shine overlay
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

      {/* Shine effect overlay */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: '-100px',
          width: '150%',
          height: '100%',
          background: `linear-gradient(90deg, transparent, ${theme.palette.primary.main}33, transparent)`,
          animation: `${shineAnimation} 3s infinite linear`,
          pointerEvents: 'none', // This prevents the overlay from intercepting clicks
          zIndex: 0,
        }}
      />

      {/* Text input field */}
      <TextField
        fullWidth
        multiline
        rows={8}
        variant="outlined"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={`Enter your ${title.toLowerCase()}...`}
        sx={{
          mt: 2,
          backgroundColor: theme.palette.background.paper,
          borderRadius: '8px',
          '& .MuiOutlinedInput-root': {
            borderRadius: '8px',
            transition: 'all 0.3s ease',
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
      <Typography
        variant="h4"
        gutterBottom
        sx={{ mb: 4, textAlign: 'center', fontWeight: 700 }}
      >
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
