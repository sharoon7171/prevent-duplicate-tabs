import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve, join } from 'path';
import { fileURLToPath } from 'url';
import { copyFileSync, mkdirSync, existsSync, readdirSync, renameSync, rmSync } from 'fs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const POPPINS_WEIGHTS = ['500', '600', '700', '900'] as const;

const copyPoppinsFonts = (): void => {
  const fontsSrc = resolve(__dirname, 'node_modules/@fontsource/poppins/files');
  const fontsDest = resolve(__dirname, 'dist/fonts');

  if (!existsSync(fontsSrc)) {
    return;
  }

  if (!existsSync(fontsDest)) {
    mkdirSync(fontsDest, { recursive: true });
  }

  for (const weight of POPPINS_WEIGHTS) {
    const fileName = `poppins-latin-${weight}-normal.woff2`;
    const srcPath = join(fontsSrc, fileName);
    if (existsSync(srcPath)) {
      copyFileSync(srcPath, join(fontsDest, fileName));
    }
  }
};

const copyPublicAssets = (): void => {
  const publicDir = resolve(__dirname, 'public');
  const distDir = resolve(__dirname, 'dist');

  if (!existsSync(publicDir)) {
    return;
  }

  if (!existsSync(distDir)) {
    mkdirSync(distDir, { recursive: true });
  }

  const manifestSrc = join(publicDir, 'manifest.json');
  if (existsSync(manifestSrc)) {
    copyFileSync(manifestSrc, join(distDir, 'manifest.json'));
  }

  const iconsDir = join(publicDir, 'icons');
  if (!existsSync(iconsDir)) {
    return;
  }

  for (const icon of readdirSync(iconsDir, { withFileTypes: true })) {
    if (icon.isFile() && icon.name !== 'prevent-duplicate-tabs.png') {
      copyFileSync(join(iconsDir, icon.name), join(distDir, icon.name));
    }
  }
};

const moveBuiltHtmlToDistRoot = (htmlName: string): void => {
  const distDir = resolve(__dirname, 'dist');
  const publicInDist = join(distDir, 'public');
  const htmlSrc = join(publicInDist, htmlName);
  if (existsSync(htmlSrc)) {
    renameSync(htmlSrc, join(distDir, htmlName));
  }
  if (existsSync(publicInDist)) {
    rmSync(publicInDist, { recursive: true });
  }
};

const isBackgroundOnly = process.env.BUILD_BACKGROUND === '1';
const isPopupOnly = process.env.BUILD_POPUP === '1';
const preserveOutput = process.env.EMPTY_OUT_DIR === '0';

const copyAssetsPlugin = () => {
  const publicDir = resolve(__dirname, 'public');

  return {
    name: 'copy-assets',
    buildStart() {
      if (existsSync(publicDir)) {
        this.addWatchFile(publicDir);
      }
    },
    closeBundle() {
      copyPublicAssets();
      if (isBackgroundOnly) {
        return;
      }
      copyPoppinsFonts();
      if (isPopupOnly) {
        moveBuiltHtmlToDistRoot('popup.html');
      } else {
        moveBuiltHtmlToDistRoot('options.html');
      }
    },
    watchChange(id: string) {
      if (id.startsWith(publicDir)) {
        copyPublicAssets();
      }
    },
  };
};

const uiEntry = isPopupOnly
  ? { popup: resolve(__dirname, 'public/popup.html') }
  : { options: resolve(__dirname, 'public/options.html') };

export default defineConfig({
  plugins: [...(isBackgroundOnly ? [] : [react()]), copyAssetsPlugin()],
  resolve: {
    alias: { '@': resolve(__dirname, './src') },
  },
  publicDir: false,
  build: isBackgroundOnly
    ? {
        outDir: 'dist',
        emptyOutDir: false,
        rolldownOptions: {
          input: {
            background: resolve(__dirname, 'src/service-worker/index.ts'),
          },
          output: {
            codeSplitting: false,
            entryFileNames: '[name].js',
            format: 'es',
          },
        },
      }
    : {
        outDir: 'dist',
        emptyOutDir: !preserveOutput && isPopupOnly,
        cssCodeSplit: false,
        rolldownOptions: {
          input: uiEntry,
          output: {
            codeSplitting: !isPopupOnly,
            entryFileNames: '[name].js',
            chunkFileNames: '[name].js',
            assetFileNames: (assetInfo): string => {
              const names = assetInfo.names ?? (assetInfo.name ? [assetInfo.name] : []);
              if (names.some((name) => name.endsWith('.css'))) {
                return isPopupOnly ? 'popup.css' : 'options.css';
              }
              return '[name][extname]';
            },
            format: 'es',
          },
        },
      },
});
