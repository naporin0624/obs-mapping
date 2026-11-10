import type { ImageMetadata } from 'astro';
import dockMenu from '../../assets/guide/01-1-dock-menu.webp';
import toolsWebsocket from '../../assets/guide/01-2-tools-websocket.webp';
import websocketSettings from '../../assets/guide/01-3-websocket-settings.webp';
import dockConnect from '../../assets/guide/01-4-dock-connect.webp';
import addSource from '../../assets/guide/02-1-add-source.webp';
import sourceProperties from '../../assets/guide/02-2-source-properties.webp';
import dockSelectSource from '../../assets/guide/02-3-dock-select-source.webp';
import addSurface from '../../assets/guide/03-1-add-surface.webp';
import fitCorners from '../../assets/guide/03-2-fit-corners.webp';
import importExport from '../../assets/guide/04-1-import-export.webp';
import type { GuideImage } from '../../i18n/guide';

export const GUIDE_IMAGES: Record<GuideImage, ImageMetadata> = {
  '01-1-dock-menu': dockMenu,
  '01-2-tools-websocket': toolsWebsocket,
  '01-3-websocket-settings': websocketSettings,
  '01-4-dock-connect': dockConnect,
  '02-1-add-source': addSource,
  '02-2-source-properties': sourceProperties,
  '02-3-dock-select-source': dockSelectSource,
  '03-1-add-surface': addSurface,
  '03-2-fit-corners': fitCorners,
  '04-1-import-export': importExport,
};
