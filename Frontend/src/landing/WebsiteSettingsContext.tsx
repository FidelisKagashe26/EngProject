import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, type WebsiteSettings } from "../services/api";

// Default fallback values (used when API returns nothing)
export const DEFAULT_WEBSITE_SETTINGS: WebsiteSettings = {
  phone_main:       "+255 754 000 100",
  phone_whatsapp:   "+255 754 000 100",
  email_main:       "info@engicost.co.tz",
  location:         "Dar es Salaam, Tanzania",
  hours:            "Mon–Sat: 8:00 AM – 6:00 PM",
  social_facebook:  "#",
  social_instagram: "#",
  social_linkedin:  "#",
  social_twitter:   "#",
};

interface WebsiteSettingsContextValue {
  settings: WebsiteSettings;
  loading: boolean;
}

const WebsiteSettingsContext = createContext<WebsiteSettingsContextValue>({
  settings: DEFAULT_WEBSITE_SETTINGS,
  loading: true,
});

export const WebsiteSettingsProvider = ({ children }: { children: ReactNode }) => {
  const [settings, setSettings] = useState<WebsiteSettings>(DEFAULT_WEBSITE_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    api
      .getPublicWebsiteSettings()
      .then((data) => {
        if (!mounted) return;
        setSettings({ ...DEFAULT_WEBSITE_SETTINGS, ...data });
      })
      .catch(() => {
        // silently fall back to defaults
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  return (
    <WebsiteSettingsContext.Provider value={{ settings, loading }}>
      {children}
    </WebsiteSettingsContext.Provider>
  );
};

export const useWebsiteSettings = () => useContext(WebsiteSettingsContext);
