import { createTheme, type MantineColorsTuple } from '@mantine/core';

/* ── Gold / Amber primary scale ───────────────────────────────────── */
const ot: MantineColorsTuple = [
  '#fef9e7', // 0  very pale gold
  '#fdf0c4', // 1
  '#fce6a0', // 2
  '#fde265', // 3  bright gold
  '#fbd753', // 4  gold-stat
  '#f0c040', // 5
  '#dd953f', // 6  gold-muted
  '#b87a2a', // 7
  '#8a5a1a', // 8
  '#554813', // 9  border color (dark gold-brown)
];

/* ── Race colour scales ───────────────────────────────────────────── */
const elf: MantineColorsTuple = [
  '#e6fff2', '#b3ffdb', '#80ffc4', '#4dffa8', '#1aff80',
  '#0dd66b', '#0ba856', '#097f41', '#06552b', '#042b16',
];
const human: MantineColorsTuple = [
  '#e6f3ff', '#b3d9ff', '#80bfff', '#4da6ff', '#1a8cff',
  '#1a75d6', '#145da8', '#0f467f', '#0a2e55', '#05172b',
];
const undead: MantineColorsTuple = [
  '#f0f0f0', '#d9d9d9', '#c0c0c0', '#a8a8a8', '#909090',
  '#787878', '#606060', '#484848', '#303030', '#1a1a1a',
];
const goblin: MantineColorsTuple = [
  '#ffe6e6', '#ffb3b3', '#ff8080', '#ff5c5c', '#ff4444',
  '#d63636', '#a82929', '#7f1e1e', '#551414', '#2b0a0a',
];

export const theme = createTheme({
  /* ── Palette ──────────────────────────────────────────────────── */
  colors: { ot, elf, human, undead, goblin },
  primaryColor: 'ot',
  primaryShade: { light: 7, dark: 3 },

  /* ── Typography ───────────────────────────────────────────────── */
  fontFamily:
    "'Palatino Linotype', 'Book Antiqua', Palatino, Georgia, serif",
  headings: {
    fontFamily: "var(--font-medieval), 'MedievalSharp', cursive",
  },

  /* ── Radius ───────────────────────────────────────────────────── */
  defaultRadius: 'sm',
  radius: {
    xs: '2px',
    sm: '4px',
    md: '8px',
    lg: '12px',
    xl: '16px',
  },

  /* ── Spacing ──────────────────────────────────────────────────── */
  spacing: {
    xs: '8px',
    sm: '12px',
    md: '16px',
    lg: '24px',
    xl: '32px',
  },

  /* ── Shadows ──────────────────────────────────────────────────── */
  shadows: {
    xs: '0 1px 2px rgba(0,0,0,.4)',
    sm: '0 2px 4px rgba(0,0,0,.4)',
    md: '0 4px 8px rgba(0,0,0,.5)',
    lg: '0 8px 24px rgba(0,0,0,.5)',
    xl: '0 12px 40px rgba(0,0,0,.6)',
  },

  /* ── Component defaults ───────────────────────────────────────── */
  components: {
    Paper: {
      defaultProps: { radius: 'sm' },
      styles: {
        root: {
          backgroundColor: 'var(--ot-bg-card)',
          borderColor: 'var(--ot-border)',
          transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
        },
      },
    },

    Title: {
      styles: {
        root: {
          color: 'var(--ot-gold-muted)',
        },
      },
    },

    Table: {
      defaultProps: { highlightOnHover: true },
      styles: {
        table: {
          borderColor: 'var(--ot-border)',
        },
        thead: {
          backgroundColor: 'var(--ot-bg-card-header)',
        },
        th: {
          color: 'var(--ot-gold-muted)',
          borderBottomColor: 'var(--ot-border)',
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          fontSize: '0.8rem',
          fontWeight: 600,
          textTransform: 'uppercase' as const,
          letterSpacing: '0.04em',
        },
        td: {
          borderBottomColor: 'var(--ot-border-subtle)',
        },
        tr: {
          transition: 'background-color 0.15s ease',
        },
      },
    },

    Button: {
      defaultProps: { radius: 'sm' },
      styles: {
        root: {
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          fontWeight: 600,
          transition: 'all 0.2s ease',
        },
      },
    },

    NavLink: {
      styles: {
        root: {
          borderRadius: '4px',
          transition: 'all 0.15s ease',
        },
        label: {
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        },
      },
    },

    Badge: {
      styles: {
        root: {
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          fontWeight: 600,
        },
      },
    },

    Tabs: {
      styles: {
        tab: {
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          fontWeight: 500,
          transition: 'all 0.15s ease',
        },
      },
    },

    TextInput: {
      styles: {
        input: {
          backgroundColor: 'var(--ot-bg-input)',
          borderColor: 'var(--ot-border)',
          transition: 'border-color 0.2s ease',
        },
        label: {
          color: 'var(--ot-text)',
          fontWeight: 500,
        },
      },
    },

    PasswordInput: {
      styles: {
        input: {
          backgroundColor: 'var(--ot-bg-input)',
          borderColor: 'var(--ot-border)',
          transition: 'border-color 0.2s ease',
        },
        label: {
          color: 'var(--ot-text)',
          fontWeight: 500,
        },
      },
    },

    NumberInput: {
      styles: {
        input: {
          backgroundColor: 'var(--ot-bg-input)',
          borderColor: 'var(--ot-border)',
          transition: 'border-color 0.2s ease',
        },
      },
    },

    Select: {
      styles: {
        input: {
          backgroundColor: 'var(--ot-bg-input)',
          borderColor: 'var(--ot-border)',
          transition: 'border-color 0.2s ease',
        },
        label: {
          color: 'var(--ot-text)',
          fontWeight: 500,
        },
      },
    },

    Skeleton: {
      styles: {
        root: {
          '&::after': {
            background:
              'linear-gradient(90deg, transparent, rgba(253,226,101,0.04), transparent)',
          },
        },
      },
    },

    Tooltip: {
      defaultProps: { withArrow: true },
      styles: {
        tooltip: {
          backgroundColor: 'var(--ot-bg-card-header)',
          border: '1px solid var(--ot-border)',
          color: 'var(--ot-text)',
        },
      },
    },

    Alert: {
      styles: {
        root: {
          borderRadius: '4px',
        },
      },
    },

    Divider: {
      styles: {
        root: {
          borderColor: 'var(--ot-border)',
        },
      },
    },

    Pagination: {
      styles: {
        control: {
          borderColor: 'var(--ot-border)',
          transition: 'all 0.15s ease',
        },
      },
    },

    Progress: {
      styles: {
        root: {
          backgroundColor: 'var(--ot-bg-card-header)',
        },
      },
    },
  },
});
