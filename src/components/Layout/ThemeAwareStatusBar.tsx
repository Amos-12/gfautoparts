import { useEffect } from 'react';
import { useTheme } from 'next-themes';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

/**
 * Component that updates Android system bars (status bar and navigation bar)
 * to match the current theme (light/dark mode).
 */
export const ThemeAwareStatusBar = () => {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const updateSystemBars = async () => {
      if (!Capacitor.isNativePlatform()) return;

      try {
        const isDark = resolvedTheme === 'dark';
        
        // Colors matching the CSS --background variable
        // Light: hsl(210 15% 98%) → #f8fafc
        // Dark: hsl(222.2 84% 4.9%) → #020817
        const backgroundColor = isDark ? '#020817' : '#f8fafc';
        
        // Style.Dark = light icons (for dark backgrounds)
        // Style.Light = dark icons (for light backgrounds)
        const statusBarStyle = isDark ? Style.Dark : Style.Light;

        await StatusBar.setBackgroundColor({ color: backgroundColor });
        await StatusBar.setStyle({ style: statusBarStyle });
        
        // Note: Navigation bar color is set via native Android code in MainActivity.java
        // We update a CSS variable that could be read by a custom Capacitor plugin if needed
        document.documentElement.style.setProperty('--system-bar-color', backgroundColor);
      } catch (error) {
        console.error('Error updating system bars:', error);
      }
    };

    // Small delay to ensure theme is fully resolved
    const timeoutId = setTimeout(updateSystemBars, 100);
    
    return () => clearTimeout(timeoutId);
  }, [resolvedTheme]);

  return null;
};

export default ThemeAwareStatusBar;
