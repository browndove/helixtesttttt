# UGMC Sidebar (Light Mode Only)

This bundle contains the UGMC sidebar and its required local dependencies, with theme support removed and logo locked to light mode.

## Included files

- `components/sidebar/sidebar.tsx`
- `components/text.tsx`
- `lib/theme-colors.ts`
- `public/assets/images/ugmc-logo-full-light-mode.png`

## Notes

- Theme dependency (`next-themes`) has been removed.
- Sidebar always uses the light logo asset.
- Keep the same relative structure when copying into another project.

## Required packages in target project

- `next`
- `react`
- `react-dom`
- `clsx`
- `react-icons`
