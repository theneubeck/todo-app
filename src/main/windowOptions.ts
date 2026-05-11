import path from 'path'
import type { BrowserWindowConstructorOptions } from 'electron'

/**
 * Builds the constructor options for the main BrowserWindow.
 *
 * When `NODE_ENV === 'test'` the `show` flag is set to `false` so that
 * Playwright-driven verify scripts can drive the offscreen renderer
 * without popping a visible window (and bouncing the macOS dock icon)
 * on every launch. In every other environment the window stays visible.
 */
export function buildWindowOptions(): BrowserWindowConstructorOptions {
  return {
    width: 900,
    height: 720,
    show: process.env.NODE_ENV !== 'test',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  }
}
