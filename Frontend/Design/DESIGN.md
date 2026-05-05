---
name: Structural Precision
colors:
  surface: '#faf9fd'
  surface-dim: '#dad9dd'
  surface-bright: '#faf9fd'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f4f3f7'
  surface-container: '#efedf1'
  surface-container-high: '#e9e7ec'
  surface-container-highest: '#e3e2e6'
  on-surface: '#1a1b1f'
  on-surface-variant: '#44474f'
  inverse-surface: '#2f3034'
  inverse-on-surface: '#f1f0f4'
  outline: '#74777f'
  outline-variant: '#c4c6d0'
  surface-tint: '#455f8b'
  primary: '#001534'
  on-primary: '#ffffff'
  primary-container: '#0b2a53'
  on-primary-container: '#7992c1'
  inverse-primary: '#adc7f9'
  secondary: '#914d00'
  on-secondary: '#ffffff'
  secondary-container: '#fc9430'
  on-secondary-container: '#663500'
  tertiary: '#280f00'
  on-tertiary: '#ffffff'
  tertiary-container: '#471f00'
  on-tertiary-container: '#c1835a'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d6e3ff'
  primary-fixed-dim: '#adc7f9'
  on-primary-fixed: '#001b3e'
  on-primary-fixed-variant: '#2d4771'
  secondary-fixed: '#ffdcc3'
  secondary-fixed-dim: '#ffb77d'
  on-secondary-fixed: '#2f1500'
  on-secondary-fixed-variant: '#6e3900'
  tertiary-fixed: '#ffdcc7'
  tertiary-fixed-dim: '#fdb78a'
  on-tertiary-fixed: '#311300'
  on-tertiary-fixed-variant: '#6a3b17'
  background: '#faf9fd'
  on-background: '#1a1b1f'
  surface-variant: '#e3e2e6'
typography:
  display:
    fontFamily: manrope
    fontSize: 48px
    fontWeight: '800'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  h1:
    fontFamily: manrope
    fontSize: 36px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  h2:
    fontFamily: manrope
    fontSize: 30px
    fontWeight: '700'
    lineHeight: '1.3'
  h3:
    fontFamily: manrope
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.4'
  body-lg:
    fontFamily: inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  label-md:
    fontFamily: inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.05em
  caption:
    fontFamily: inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: '1.4'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 64px
  container_max: 1280px
  gutter: 24px
---

## Brand & Style

This design system is built on the pillars of **Corporate Modernism** and technical excellence. Designed for a high-end engineering firm, the visual language balances the heavy-duty nature of construction with the sophisticated precision of modern architectural planning. 

The aesthetic prioritizes clarity and structural integrity through a generous use of whitespace and a "blueprint-clean" approach. It aims to evoke a sense of absolute reliability, premium service, and meticulous attention to detail. Every element is intentional, avoiding unnecessary ornamentation to ensure the content—engineering expertise—remains the focal point.

## Colors

The color strategy uses a "Trust Navy" and "Construction Orange" pairing. The navy blue provides a conservative, authoritative foundation, while the orange accent acts as a high-visibility functional highlight, reminiscent of safety equipment and architectural markings.

In **Light Mode**, the interface feels airy and professional, utilizing soft grays for structural borders. In **Dark Mode**, the hierarchy flips to prioritize legibility in low-light environments, using deeper navy tones for the background to reduce eye strain while maintaining the brand's premium identity.

## Typography

This design system utilizes a dual-font strategy. **Manrope** is used for headings to provide a modern, refined, and geometric feel that speaks to engineering precision. **Inter** is used for body text and functional labels due to its exceptional legibility and systematic, utilitarian nature.

Large headlines should use tighter letter spacing to appear more "constructed" and impactful. Body text maintains a generous line height (1.6) to ensure technical documentation and project descriptions remain highly readable.

## Layout & Spacing

The layout philosophy follows a **Fixed Grid** model for desktop, centered within the viewport to maintain a high-end, editorial feel. A 12-column system is used with 24px gutters to allow for complex technical layouts.

The spacing rhythm is based on a 4px baseline grid, ensuring all components align to a predictable mathematical scale. Ample margins (32px+) are encouraged between major sections to prevent the UI from feeling cluttered, reflecting the precision and "breathing room" found in architectural blueprints.

## Elevation & Depth

Hierarchy is established through **Ambient Shadows** and tonal layering. Surfaces do not "float" aggressively; instead, they sit slightly above the background with soft, diffused shadows (Blur: 15px-30px, Opacity: 5-8%).

In Light Mode, elevation is communicated through white cards on a `#f4f6fa` background. In Dark Mode, depth is achieved by using slightly lighter navy tones (`#0b1220`) for cards against the primary background. Transparent, low-contrast outlines are used on interactive elements to define boundaries without adding visual noise.

## Shapes

The shape language is "Softly Geometric." A standard radius of **8px to 12px** is applied to all cards and containers to soften the industrial nature of the brand while maintaining a professional structure.

Buttons and input fields utilize a 10px radius, creating a consistent "squircle" aesthetic that feels contemporary. Icons should follow a 2px stroke weight to match the technical precision of the typography.

## Components

### Buttons
Primary buttons utilize the Navy Blue (#0b2a53) with white text. Accent buttons use the Orange (#f28c28). All buttons feature a subtle 200ms transition on hover, shifting to their respective hover colors and lifting slightly with a soft shadow.

### Cards
Cards are the primary container. They feature a white (or #0b1220 in dark mode) background, an 8px border-radius, and a 1px border using the "Border Color" variable. Padding within cards should be a minimum of 24px (lg).

### Input Fields
Inputs use the "Light Background" as their fill in light mode, with a 1px border that darkens on focus. The focus state is signaled by a 2px stroke in the accent orange.

### Progress Indicators
Given the construction context, custom progress bars are essential. They should use a thick, rounded track with the accent orange for the fill to signify "work in progress" or completion.

### Data Tables
Tables should be clean with no vertical borders. Use the "Text Main" for headers in a bold weight and the "Text Muted" for secondary data. Row hover states should use a subtle background tint change.