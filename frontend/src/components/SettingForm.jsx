// src/components/SettingForm.jsx
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
import { api } from '../services/api'; // Adjust the import path as needed

const shineAnimation = keyframes`
  0% { transform: translateX(-150%); }
  100% { transform: translateX(150%); }
`;

// A separate SettingBox component with its own focus state.
const SettingBox = ({ title, icon, content, setContent }) => {
  const theme = useTheme();
  const [isFocused, setIsFocused] = useState(false);

  return (
    <Paper
      elevation={3}
      sx={{
        p: 3,
        height: '100%',
        background:
          theme.palette.mode === 'dark'
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
      {/* Conditionally render the shine overlay only when NOT focused */}
      {!isFocused && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex: 0,
            pointerEvents: 'none',
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: '-150%',
              width: '150%',
              height: '100%',
              background: `linear-gradient(90deg, transparent, ${theme.palette.primary.main}33, transparent)`,
              animation: `${shineAnimation} 3s infinite linear`,
            }}
          />
        </Box>
      )}

      {/* Content container with higher stacking order */}
      <Box sx={{ position: 'relative', zIndex: 1 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            mb: 2,
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
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={`Enter your ${title.toLowerCase()}...`}
          sx={{
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
      </Box>
    </Paper>
  );
};

const SettingForm = () => {
  const theme = useTheme();
  const [aboutMe, setAboutMe] = useState('');
  const [preferences, setPreferences] = useState('');

  const userId = localStorage.getItem('userId') || 'ashuthe1';

  // Fetch user settings on component mount.
  useEffect(() => {
    api.getUserSettings(userId)
      .then((data) => {
        if (data) {
          setAboutMe(data.aboutMe || '');
          setPreferences(data.preferences || '');
        }
      })
      .catch((error) => {
        console.error("Error fetching user settings:", error);
      });
  }, [userId]);

  // When the user saves, update the settings via the API.
  const handleSave = async () => {
    try {
      await api.updateUserSettings(userId, aboutMe, preferences);
      alert('Settings updated successfully!');
    } catch (error) {
      console.error("Error updating settings:", error);
      alert('Error updating settings');
    }
  };

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
