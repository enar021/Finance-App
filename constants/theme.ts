export const THEME = {
  colors: {
    // Screen Background from inspo: soft airy mint-tinted off-white
    background: '#F3F8F5',
    backgroundAlt: '#EBF4F0',

    // Pastel Cards directly from the inspiration mockup
    mintCard: '#CCE2D8',       // The green/mint card from screen 1 & 2
    mintCardLight: '#DCEEE6',
    
    lilacCard: '#E0DCF5',      // The purple/lavender card from screen 1 & 2
    lilacCardLight: '#ECE8FB',
    
    creamCard: '#FDF1CE',      // The warm butter/yellow card from screen 2
    creamCardLight: '#FEF7DF',

    periwinkleCard: '#D8E2F0', // Soft blue-gray for schedule list
    periwinkleLight: '#E8EFF8',

    // Aliases for compatibility
    cardLavender: '#CCE2D8',
    cardLavenderLight: '#DCEEE6',
    cardBank: '#CCE2D8',
    cardWeek: '#E0DCF5',
    cardWhite: '#FFFFFF',

    // Pure white for badges, circular arrow buttons, and cards
    white: '#FFFFFF',

    // Text hierarchy
    textDark: '#1E2229',       // Deep charcoal heading color
    textMedium: '#475161',     // Card body text
    textSecondary: '#5F697A',  // Secondary labels
    textMuted: '#7E8B9E',      // Small tags, subtitles
    
    // Accents & indicators
    indicatorRed: '#E53E3E',   // For the 10,500 -> 10,000 flow
    indicatorGreen: '#10B981', // Savings positive
    accentYellow: '#F59E0B',   // Progress bar accent
    accentPurple: '#8B5CF6',

    // Inspo UI pills
    pillDark: '#1E2229',
    pillDarkText: '#FFFFFF',
    pillLight: '#FFFFFF',
    pillLightText: '#1E2229',
  },
  radius: {
    xs: 10,
    sm: 14,
    md: 18,
    lg: 24,
    xl: 28,
    card: 28,                  // Very rounded modern cards from inspo
    full: 9999,
  },
  shadow: {
    soft: {
      shadowColor: '#1E2229',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.05,
      shadowRadius: 10,
      elevation: 2,
    },
    button: {
      shadowColor: '#1E2229',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3,
    },
  },
};
