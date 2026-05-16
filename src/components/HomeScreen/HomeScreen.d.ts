/**
 * TypeScript module resolution stub. This file contains no runtime code.
 *
 * TypeScript cannot understand Metro's platform-specific extensions, so it
 * needs a plain `HomeScreen` module to resolve the import in index.tsx.
 *
 * At bundle time Metro ignores this file and picks instead:
 *   iOS     → HomeScreen.ios.tsx   (BlurView / Liquid Glass)
 *   Android → HomeScreen.android.tsx  (warm DESIGN.md palette)
 */
import type { ComponentType } from 'react';

declare const HomeScreen: ComponentType;
export default HomeScreen;
