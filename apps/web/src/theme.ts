import { createTheme, type MantineColorsTuple } from '@mantine/core';

/* ── System font stack (clean, modern UI) ─────────────────────────── */
const systemFont =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, Roboto, 'Helvetica Neue', Arial, sans-serif";

/* ═══════════════════════════════════════════════════════════════════
   Color Tuples (10-shade scales for Mantine's `color` prop)
   Shades: 0 = lightest … 9 = darkest
   primaryShade dark:4  →  used for <Button>, <Badge color="ot"> etc.
   ═══════════════════════════════════════════════════════════════════ */

const ot: MantineColorsTuple = [
  '#faf6eb', // 0
  '#f0e9ce', // 1
  '#e5d9ad', // 2
  '#d4c48a', // 3
  '#c8a84e', // 4  ← primary dark shade (muted gold)
  '#b09242', // 5
  '#967834', // 6
  '#7a6128', // 7
  '#5e4a1e', // 8
  '#423416', // 9
];

const elf: MantineColorsTuple = [
  '#edfff5', '#c8f5dc', '#a0e8c2', '#70d8a0', '#4caf82',
  '#3d9a6e', '#30805a', '#246646', '#184d34', '#0e3322',
];
const human: MantineColorsTuple = [
  '#edf3ff', '#c8d8f5', '#a0bce8', '#709cd8', '#4c7ec0',
  '#3d6aa8', '#305690', '#244278', '#183060', '#0e1e48',
];
const undead: MantineColorsTuple = [
  '#f0f0f2', '#d4d4da', '#b8b8c2', '#9494a8', '#787890',
  '#646478', '#505060', '#3c3c48', '#282830', '#1a1a20',
];
const goblin: MantineColorsTuple = [
  '#ffeef0', '#f5c8cc', '#e8a0a6', '#d87078', '#c05050',
  '#a84040', '#903434', '#782828', '#601e1e', '#481414',
];

/* ═══════════════════════════════════════════════════════════════════ */

export const theme = createTheme({
  /* ── Palette ──────────────────────────────────────────────────── */
  colors: { ot, elf, human, undead, goblin },
  primaryColor: 'ot',
  primaryShade: { light: 6, dark: 4 },

  /* ── Typography ───────────────────────────────────────────────── */
  fontFamily: systemFont,
  headings: {
    fontFamily: "var(--font-medieval), 'MedievalSharp', cursive",
    fontWeight: '700',
    sizes: {
      h1: { fontSize: '30px', lineHeight: '1.3' },
      h2: { fontSize: '22px', lineHeight: '1.35' },
      h3: { fontSize: '18px', lineHeight: '1.4' },
      h4: { fontSize: '16px', lineHeight: '1.45' },
      h5: { fontSize: '14px', lineHeight: '1.5' },
      h6: { fontSize: '13px', lineHeight: '1.5' },
    },
  },
  fontSizes: {
    xs: '12px',
    sm: '13px',
    md: '14px',
    lg: '16px',
    xl: '18px',
  },
  lineHeights: {
    xs: '1.4',
    sm: '1.45',
    md: '1.5',
    lg: '1.55',
    xl: '1.6',
  },

  /* ── Spacing (8 px grid) ──────────────────────────────────────── */
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
  },

  /* ── Radius ───────────────────────────────────────────────────── */
  defaultRadius: 'md',
  radius: {
    xs: '4px',
    sm: '6px',
    md: '10px',
    lg: '14px',
    xl: '18px',
  },

  /* ── Shadows (soft, layered) ──────────────────────────────────── */
  shadows: {
    xs: '0 1px 2px rgba(0,0,0,.15)',
    sm: '0 2px 6px rgba(0,0,0,.18), 0 1px 2px rgba(0,0,0,.10)',
    md: '0 4px 14px rgba(0,0,0,.22)',
    lg: '0 8px 28px rgba(0,0,0,.28)',
    xl: '0 16px 48px rgba(0,0,0,.32)',
  },

  /* ── Focus ────────────────────────────────────────────────────── */
  focusRing: 'auto',

  /* ── Component defaults ───────────────────────────────────────── */
  components: {

    /* ─── Paper / Card ──────────────────────────────────────────── */
    Paper: {
      defaultProps: { radius: 'lg' },
      styles: {
        root: {
          backgroundColor: 'var(--ot-bg-surface-1)',
          borderColor: 'var(--ot-border)',
          transition: 'border-color 150ms ease, box-shadow 150ms ease',
        },
      },
    },

    Card: {
      defaultProps: { radius: 'lg', shadow: 'sm' },
      styles: {
        root: {
          backgroundColor: 'var(--ot-bg-surface-1)',
          borderColor: 'var(--ot-border)',
        },
      },
    },

    /* ─── Typography ────────────────────────────────────────────── */
    Title: {
      styles: {
        root: {
          color: 'var(--ot-accent)',
        },
      },
    },

    /* ─── Button ────────────────────────────────────────────────── */
    Button: {
      defaultProps: { radius: 'md' },
      styles: {
        root: {
          fontFamily: systemFont,
          fontWeight: 600,
          height: '40px',
          transition: 'all 150ms ease',
        },
      },
    },

    ActionIcon: {
      defaultProps: { radius: 'md' },
      styles: {
        root: {
          transition: 'all 150ms ease',
        },
      },
    },

    /* ─── Table ─────────────────────────────────────────────────── */
    Table: {
      defaultProps: { highlightOnHover: true },
      styles: {
        table: {
          borderColor: 'var(--ot-border)',
        },
        thead: {
          backgroundColor: 'var(--ot-bg-surface-2)',
        },
        th: {
          color: 'var(--ot-text-dim)',
          borderBottomColor: 'var(--ot-border)',
          fontFamily: systemFont,
          fontSize: '12px',
          fontWeight: 600,
          letterSpacing: '0.02em',
          padding: '10px 12px',
        },
        td: {
          borderBottomColor: 'var(--ot-border-subtle)',
          fontSize: '14px',
          padding: '10px 12px',
        },
        tr: {
          transition: 'background-color 120ms ease',
        },
      },
    },

    /* ─── Navigation ────────────────────────────────────────────── */
    NavLink: {
      styles: {
        root: {
          borderRadius: '10px',
          transition: 'all 120ms ease',
        },
        label: {
          fontFamily: systemFont,
          fontSize: '14px',
        },
      },
    },

    /* ─── Badge ─────────────────────────────────────────────────── */
    Badge: {
      defaultProps: { radius: 'xl' },
      styles: {
        root: {
          fontFamily: systemFont,
          fontWeight: 600,
          textTransform: 'capitalize' as const,
        },
      },
    },

    /* ─── Tabs ──────────────────────────────────────────────────── */
    Tabs: {
      styles: {
        tab: {
          fontFamily: systemFont,
          fontWeight: 500,
          fontSize: '14px',
          transition: 'all 120ms ease',
          padding: '10px 16px',
        },
      },
    },

    /* ─── Inputs ────────────────────────────────────────────────── */
    TextInput: {
      defaultProps: { radius: 'md' },
      styles: {
        input: {
          backgroundColor: 'var(--ot-bg-input)',
          borderColor: 'var(--ot-border)',
          height: '40px',
          transition: 'border-color 150ms ease',
          '&:focus': {
            borderColor: 'var(--ot-accent)',
          },
        },
        label: {
          color: 'var(--ot-text)',
          fontWeight: 500,
          fontSize: '13px',
          marginBottom: '4px',
        },
      },
    },

    PasswordInput: {
      defaultProps: { radius: 'md' },
      styles: {
        input: {
          backgroundColor: 'var(--ot-bg-input)',
          borderColor: 'var(--ot-border)',
          height: '40px',
          transition: 'border-color 150ms ease',
        },
        label: {
          color: 'var(--ot-text)',
          fontWeight: 500,
          fontSize: '13px',
          marginBottom: '4px',
        },
      },
    },

    NumberInput: {
      defaultProps: { radius: 'md' },
      styles: {
        input: {
          backgroundColor: 'var(--ot-bg-input)',
          borderColor: 'var(--ot-border)',
          height: '40px',
          transition: 'border-color 150ms ease',
        },
        label: {
          color: 'var(--ot-text)',
          fontWeight: 500,
          fontSize: '13px',
          marginBottom: '4px',
        },
      },
    },

    Select: {
      defaultProps: { radius: 'md' },
      styles: {
        input: {
          backgroundColor: 'var(--ot-bg-input)',
          borderColor: 'var(--ot-border)',
          height: '40px',
          transition: 'border-color 150ms ease',
        },
        label: {
          color: 'var(--ot-text)',
          fontWeight: 500,
          fontSize: '13px',
          marginBottom: '4px',
        },
        dropdown: {
          backgroundColor: 'var(--ot-bg-surface-2)',
          borderColor: 'var(--ot-border)',
        },
      },
    },

    /* ─── Modal ─────────────────────────────────────────────────── */
    Modal: {
      defaultProps: { radius: 'lg', centered: true },
      styles: {
        content: {
          backgroundColor: 'var(--ot-bg-surface-1)',
          border: '1px solid var(--ot-border)',
        },
        header: {
          backgroundColor: 'var(--ot-bg-surface-1)',
        },
      },
    },

    /* ─── Tooltip ───────────────────────────────────────────────── */
    Tooltip: {
      defaultProps: { withArrow: true, radius: 'md' },
      styles: {
        tooltip: {
          backgroundColor: 'var(--ot-bg-surface-2)',
          border: '1px solid var(--ot-border)',
          color: 'var(--ot-text)',
          fontSize: '13px',
          padding: '8px 12px',
        },
      },
    },

    /* ─── Divider ───────────────────────────────────────────────── */
    Divider: {
      styles: {
        root: {
          borderColor: 'var(--ot-border)',
        },
      },
    },

    /* ─── Pagination ────────────────────────────────────────────── */
    Pagination: {
      styles: {
        control: {
          borderColor: 'var(--ot-border)',
          transition: 'all 120ms ease',
          borderRadius: '10px',
        },
      },
    },

    /* ─── Progress ──────────────────────────────────────────────── */
    Progress: {
      defaultProps: { radius: 'xl' },
      styles: {
        root: {
          backgroundColor: 'var(--ot-bg-surface-2)',
        },
      },
    },

    /* ─── Skeleton ──────────────────────────────────────────────── */
    Skeleton: {
      styles: {
        root: {
          '&::after': {
            background:
              'linear-gradient(90deg, transparent, rgba(255,255,255,0.03), transparent)',
          },
        },
      },
    },

    /* ─── Alert ─────────────────────────────────────────────────── */
    Alert: {
      defaultProps: { radius: 'lg' },
    },

    /* ─── Accordion ─────────────────────────────────────────────── */
    Accordion: {
      styles: {
        item: {
          borderColor: 'var(--ot-border)',
        },
        control: {
          transition: 'background-color 120ms ease',
        },
      },
    },

    /* ─── SegmentedControl ──────────────────────────────────────── */
    SegmentedControl: {
      defaultProps: { radius: 'md' },
    },

    /* ─── ScrollArea ────────────────────────────────────────────── */
    ScrollArea: {
      defaultProps: { scrollbarSize: 6 },
    },
  },
});
