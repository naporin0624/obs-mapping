import { en as dock } from '../../../ui/src/i18n/messages/en';
import { DEMO_SOURCE } from '../scene/spec';
import type { SiteMessages, StepCopy } from './messages';

const GITHUB_URL = 'https://github.com/naporin0624/surface-mapper';
const target = { stairs: 'the stairs', hexagon: 'the hexagon panels', drums: 'the drums', cubes: 'the stacked cubes' } as const;

const holeStep: StepCopy = {
  title: 'Cut out the holes',
  body: `On a face that gets a hole, choose "${dock.maskPolygon}" under "${dock.maskHeading}", then press "${dock.maskEdit}", add vertices, trace once around the face and carry on around the hole. The part enclosed by both outlines drops out, so no light lands in the hole. This page fades it out smoothly for illustration; the plugin cuts to the shape you edited.`,
};

export const en: SiteMessages = {
  htmlLang: 'en',
  langSwitch: { label: 'Language', ja: '日本語', en: 'English' },
  root: {
    title: 'Surface Mapper',
    description: 'An OBS plugin that projection-maps your video onto physical objects.',
    getPlugin: 'Get the plugin',
    demos: 'See the demos',
    github: 'GitHub repository',
    releases: 'Releases (downloads)',
    external: ' (GitHub)',
    toc: { label: 'Contents' },
    can: {
      heading: 'What it does',
      items: [
        'Pick an OBS source for each face and warp the video into any four-cornered shape by moving its corners',
        'Cut faces out with ellipses or polygons, holes included',
        'Group faces and lay them out with align, distribute and tile',
        `${dock.exportButton} and ${dock.importButton} the mapping as mapping.json, or read and write it from scripts through obs-websocket vendor requests`,
      ],
    },
    install: {
      heading: 'Install',
      download: {
        title: 'Download',
        toc: 'Download',
        body: 'Pick the file for your OS from Releases: the .pkg on macOS, the .exe on Windows.',
        link: 'Open Releases',
      },
      run: {
        title: 'Quit OBS and run the installer',
        toc: 'Run the installer',
        body: 'Quit OBS before you install. The Windows installer will not continue while OBS is running.',
        macos: 'On 15 or later, if a warning stops you, open System Settings > Privacy & Security and press "Open Anyway".',
        macosOld: 'On 14 or earlier, if a warning stops you, right-click the pkg and choose "Open".',
        windows: 'If SmartScreen shows a warning, press "More info", then "Run anyway". If a User Account Control (UAC) prompt asks for administrator permission, allow it.',
      },
      open: {
        title: 'Open OBS',
        toc: 'Open OBS',
        body: 'The "Surface Mapper" dock is already on the right. It appears on its own only the first time.',
        rows: [
          {
            image: '01-1-dock-menu',
            alt: 'The Docks menu (in Japanese) with "Surface Mapper" checked',
            where: 'Docks',
            title: 'If you cannot find the dock',
            items: ['From the Docks menu in the menu bar, choose "Surface Mapper" so it is checked.'],
          },
        ],
        faq: 'If Surface Mapper is not in the menu either',
      },
      connect: {
        title: 'Turn on WebSocket and connect',
        toc: 'Connect over WebSocket',
        body: "Turn on OBS's WebSocket server, then connect to it from the dock. From the next launch on, the dock reconnects by itself.",
        rows: [
          {
            image: '01-2-tools-websocket',
            alt: 'The Tools menu (in Japanese) with WebSocket Server Settings highlighted',
            where: 'Tools',
            title: 'Open the settings',
            items: ['From the Tools menu in the menu bar, open WebSocket Server Settings.'],
          },
          {
            image: '01-3-websocket-settings',
            alt: 'The WebSocket Server Settings window (in Japanese): the enable checkbox, the server port set to 4455, and the server password field',
            where: 'Tools > WebSocket Server Settings',
            title: 'Enable the server',
            items: ['Check "Enable WebSocket server".', 'Check the server port. It is 4455 by default.', 'Note down the server password. You will enter it in the dock to connect.'],
          },
          {
            image: '01-4-dock-connect',
            alt: 'The connection bar at the top of the dock: URL, password, the connect button and the Connected status',
            where: 'Surface Mapper dock',
            title: 'Connect from the dock',
            items: [
              'The URL can stay at the default, ws://127.0.0.1:4455. If you changed the port, match the number at the end.',
              'In "Password", enter the server password you noted down.',
              `Press the "${dock.connectConnect}" button. Once connected, the same button becomes "${dock.connectDisconnect}".`,
              `You are done when it says "${dock.connectOpen}".`,
            ],
          },
        ],
      },
    },
    how: {
      heading: 'How to use it',
      source: {
        title: 'Add a Mapping source',
        toc: 'Add a Mapping source',
        rows: [
          {
            image: '02-1-add-source',
            alt: 'The Add Source window (in Japanese) with Mapping selected in the list on the left and the button that adds a new Mapping at the top right',
            where: 'Sources > +',
            title: 'Pick Mapping and add one',
            items: ['Press "+" under Sources and choose "Mapping" from the list.', 'Press the button at the top that adds a new Mapping.'],
          },
          {
            image: '02-2-source-properties',
            alt: "The Mapping source's properties window: a preview at the top, the mapping JSON field in the middle, and the OK button at the bottom right",
            where: 'Mapping source properties',
            title: 'Close the properties as they are',
            items: ['Press "OK". You edit the mapping JSON in the dock, so you can leave it alone here.'],
          },
          {
            image: '02-3-dock-select-source',
            alt: 'The Source field in the dock with the new Mapping source chosen and the reload button beside it',
            where: 'Surface Mapper dock',
            title: 'Choose it in the dock',
            items: [`In "${dock.source}", choose the Mapping source you added.`, `If it is not in the list, press the "${dock.sourceReload}" button.`],
          },
        ],
      },
      fit: {
        title: 'Create faces and fit their corners',
        toc: 'Fit the corners',
        rows: [
          {
            image: '03-1-add-surface',
            alt: 'The right side of the dock: the source picker, the add button, two faces under Layers, and the crop fields in the properties',
            where: 'Surface Mapper dock',
            title: 'Add a face',
            items: [
              `Left of "${dock.add}", choose the source to show on the face (for example, a Syphon client).`,
              `Press "${dock.add}" (+) to create a face.`,
              `The new face is listed under "${dock.layersHeading}".`,
              `Under "${dock.cropHeading}", set which part of the source to show, as ratios from 0 to 1.`,
            ],
          },
          {
            image: '03-2-fit-corners',
            alt: 'Face corners dragged on the stage to fit two walls, with the corner coordinate fields in the properties',
            where: 'Surface Mapper dock',
            title: 'Fit the corners',
            items: [
              "Drag the handles at the face's corners onto the corners of the object you project on.",
              `The selected corner's coordinates also appear as numbers in a field such as "${dock.cornerHeading(2)}" in the properties, where you can edit them.`,
            ],
          },
        ],
        mask: `Under "${dock.maskHeading}", you can cut a face out with an ellipse or a polygon.`,
        demos: 'Walk through it in the demos',
      },
      transfer: {
        title: 'Export and import the mapping',
        toc: 'Export and import',
        rows: [
          {
            image: '04-1-import-export',
            alt: 'The dock toolbar with the import and export buttons side by side',
            where: 'Surface Mapper dock',
            title: 'Pass it on as a file',
            items: [
              `"${dock.importButton}" loads a saved mapping.json. If the resolution differs, choose "${dock.importScale}" or "${dock.importOverwrite}". Loading cannot be undone.`,
              `"${dock.exportButton}" saves the current mapping as mapping.json.`,
            ],
          },
        ],
      },
    },
    guide: { enlarge: 'Enlarge image', close: 'Close' },
    faq: {
      heading: 'FAQ',
      groups: [
        {
          heading: 'Distribution and swapping',
          open: true,
          items: [
            {
              q: "How do I show the same mapping in every participant's setup?",
              a: [
                `Hand out the plugin and mapping.json. Each person loads mapping.json with "${dock.importButton}" in the dock.`,
                `If the resolution differs, choose "${dock.importScale}" when you ${dock.importButton.toLowerCase()}, and the points are scaled by ratio to fit. Loading cannot be undone.`,
              ],
            },
            {
              q: 'How do I swap only the video?',
              a: [
                'A face points to an OBS source by name. Change what is inside the source (the media file or the scene) and every face that uses that source changes together. You do not need to rebuild the mapping.',
              ],
            },
            {
              q: 'What if a source name in the json I received is not in my OBS?',
              a: [
                'That face shows nothing. Create a source with the same name as in the json and it shows right away, without importing again. You can also pick the source again for each face in the dock.',
              ],
            },
          ],
        },
        {
          heading: 'Trouble installing',
          open: false,
          items: [
            {
              q: 'The installer shows a warning',
              a: [
                'The installer is not signed by Apple or Microsoft. How to get past the warning is in step 2 of Install.',
                'On macOS, if OBS does not load the plugin after you install it, the README describes how to remove the quarantine attribute.',
              ],
              links: [
                { href: '#install-run', label: 'See step 2 of Install' },
                { href: `${GITHUB_URL}#macosインストーラー`, label: 'See the macOS installer section of the README (in Japanese)' },
              ],
            },
            {
              id: 'faq-dock',
              q: 'The dock does not appear',
              a: [
                'In an OBS without obs-browser, the dock does not appear on its own. If it does not appear, or if it is blank inside, the README (in Japanese) describes how to register it by hand as a custom browser dock.',
              ],
              links: [{ href: `${GITHUB_URL}#ドックが出ない場合カスタムブラウザドックに登録する`, label: 'See the section on the dock not appearing in the README (in Japanese)' }],
            },
            { q: 'Does it also work on Windows?', a: ['Yes. Since 0.5.0, it has also been tested on a real Windows (x64) machine.'] },
          ],
        },
        {
          heading: 'Running it live',
          open: false,
          items: [
            {
              q: 'Do the editing outlines show up in the stream?',
              a: ["Yes. The outlines and handles are drawn directly into the Mapping source's output, so turn the overlay off during the show. Whenever OBS starts, the overlay is always back off."],
            },
            {
              q: 'How do I send it to a projector?',
              a: [
                "Use OBS's projector output (a fullscreen projector) and put the Mapping source, or a scene that contains it, on the projector's screen. The dock's Stage is composited in the browser, so check the final look on the projector output.",
              ],
            },
          ],
        },
        {
          heading: 'Other',
          open: false,
          items: [
            {
              q: 'Can I drive it from scripts or AI agents?',
              a: [
                'Yes. You can read and write the mapping with the obs-websocket vendor requests (ListMappingSources, GetMapping, SetMapping). The skills for agents are covered in the section lower on the page.',
              ],
              links: [{ href: '#skills', label: 'See the skills below' }],
            },
            { q: 'What about price and license?', a: ['It is open source under GPL-2.0, and free.'] },
          ],
        },
      ],
    },
    skills: {
      heading: 'Skills for Claude Code and other agents',
      lead: 'Four skills let scripts and agents work with mappings.',
      list: {
        'driving-surface-mapper-over-websocket': 'Read and write a Mapping source through obs-websocket vendor requests.',
        'writing-mapping-json': 'Write and fix mapping.json (v2), including how to read its validation errors.',
        'mapping-led-pixel-maps': 'Lay out one face per screen on a single canvas from an LED pixel map (chart).',
        'upgrading-from-0-6': 'Bring back Mapping sources saved by 0.6.x or earlier that show as missing after updating to 0.7.0 or later.',
      },
      claudeCode: 'In Claude Code, install them as a plugin.',
      others: { before: 'For other agents such as Codex, GitHub Copilot and Cursor, install them one at a time with the ', link: 'skills CLI', after: '.' },
      oneByOne: 'Naming several skills in one command installs only the first.',
      global: { before: 'Add ', after: ' to install for your user instead of the project.' },
    },
    env: {
      heading: 'Requirements',
      macos: 'macOS (universal build for Apple Silicon and Intel): tested.',
      windows: 'Windows (x64): tested.',
      obs: 'OBS Studio 31.1.1 or later',
    },
    video: {
      description: "Dragging a surface's four corners in the dock until the video fits the two walls that meet at a room corner",
      pause: 'Pause video',
      play: 'Play video',
    },
  },
  demoIndex: {
    title: 'Demos',
    description: 'Follow the OBS and dock steps in your browser. The finished mapping.json can be imported as is.',
  },
  demos: {
    stairs: { title: 'Stairs', description: 'Split the video across the steps and fit each face to the stairs.' },
    hexagon: { title: 'Hexagon panels', description: 'Fit panels laid out as hexagons and cut each one out with a polygon.' },
    drums: { title: 'Drums', description: 'Fit the drum heads and cut each one out with an ellipse.' },
    cubes: { title: 'Stacked cubes', description: 'Wrap the video around three faces of each cube and cut holes with a polygon.' },
  },
  step: (slug, id): StepCopy => {
    const name = target[slug];
    switch (id) {
      case 'place':
        return {
          title: 'Add the sources',
          body: `In OBS, add a camera source named "${DEMO_SOURCE}", then add a Mapping source. In the "${dock.source}" at the top of the dock, choose that Mapping source.`,
        };
      case 'fit':
        return {
          title: 'Fit the corners',
          body: `In the "${dock.source}" next to "${dock.add}", pick ${DEMO_SOURCE}, then press "${dock.add}" to create a face. A new face shows the whole video as a plain rectangle. Drag its four corners onto the corners of ${name}, and the corners of the video follow. "${dock.cropHeading}" sets which part of the video each face uses.`,
        };
      case 'shape': {
        if (slug === 'cubes') return holeStep;
        const kind = slug === 'drums' ? dock.maskEllipse : dock.maskPolygon;
        return {
          title: 'Cut out the shape',
          body: `Under "${dock.maskHeading}", choose "${kind}", then press "${dock.maskEdit}" and match the outline to the object. Video outside the face disappears. This page fades it out smoothly for illustration; the plugin cuts to the shape you edited.`,
        };
      }
      case 'done':
        return {
          title: 'Done',
          body: `The video now sticks to ${name}. Download the mapping.json below and load it with "${dock.importButton}" in the dock.`,
        };
    }
  },
  viewer: {
    stage: '3D view',
    hint: 'Drag to orbit · Scroll to zoom · Right-drag to pan',
    keys: 'Arrow keys pan; Shift with the arrow keys orbits.',
    input: { heading: 'Input', sample: 'Sample', obs: 'OBS Virtual Camera', device: 'Camera', unnamed: 'Camera' },
    steps: { heading: 'Steps', locked: 'The OBS Virtual Camera already sends the finished output, so the steps are locked.' },
    view: { heading: 'View', beam: 'Show projection area', reset: 'Reset view' },
    connect: {
      heading: 'Connect OBS',
      importIt: `In the Surface Mapper dock, press "${dock.importButton}" and load the mapping.json.`,
      startCamera: 'In OBS, press "Start Virtual Camera".',
      chooseHere: 'Under "Input" on this page, choose "OBS Virtual Camera".',
    },
  },
  camera: {
    join: ' ',
    switchFailed: 'That camera could not be opened. Still projecting the current camera.',
    sample: 'Projecting the sample video, mapped the way OBS would output it.',
    requesting: 'Please allow camera access.',
    waiting: 'Waiting for the camera picture. The sample video stays until it arrives.',
    obs: 'Projecting the OBS Virtual Camera as it is.',
    other: 'No OBS Virtual Camera was found, so "{label}" is projected. Press "Start Virtual Camera" in OBS, then choose it again.',
    letterbox: 'The picture is not 16:9, so black bars fit it into the 16:9 frame.',
    denied: 'Camera access was denied. Back to the sample video.',
    unavailable: 'No camera was found. Press "Start Virtual Camera" in OBS, then choose it again. Back to the sample video.',
    busy: 'The camera is in use by another app (such as OBS on Windows) and could not be opened. Back to the sample video.',
    disconnected: 'The camera was disconnected, so the sample video is back.',
  },
  sample: { pause: 'Pause the sample video', play: 'Play the sample video' },
  webglFallback: 'This browser cannot show the 3D view. The steps and the mapping.json download still work.',
  download: {
    label: 'Download mapping.json',
    note: `Rename your camera source in OBS to ${DEMO_SOURCE} before you Import.`,
  },
};
