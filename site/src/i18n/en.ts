import { en as dock } from '../../../ui/src/i18n/messages/en';
import { DEMO_SOURCE } from '../scene/spec';
import type { SiteMessages, StepCopy } from './messages';

const GITHUB_URL = 'https://github.com/naporin0624/obs-mapping';
const target = { stairs: 'the stairs', hexagon: 'the hexagon panels', drums: 'the drums', cubes: 'the stacked cubes' } as const;

const holeStep: StepCopy = {
  title: 'Cut out the holes',
  body: `On a face that gets a hole, choose "${dock.maskPolygon}" under "${dock.maskHeading}", then press "${dock.maskEdit}", add vertices, trace once around the face and carry on around the hole. The part enclosed by both outlines drops out, so no light lands in the hole. This page fades it out smoothly for illustration; the plugin cuts to the shape you edited.`,
};

export const en: SiteMessages = {
  htmlLang: 'en',
  langSwitch: { label: 'Language', ja: '日本語', en: 'English' },
  root: {
    title: 'obs-mapping',
    description: 'An OBS plugin that projection-maps your video onto physical objects.',
    getPlugin: 'Get the plugin',
    demos: 'See the demos',
    github: 'GitHub repository',
    releases: 'Releases (downloads)',
    external: ' (GitHub)',
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
        body: 'Pick the file for your OS from Releases: the .pkg on macOS, the .exe on Windows.',
        link: 'Open Releases',
      },
      run: {
        title: 'Quit OBS and run the installer',
        body: 'Quit OBS before you install. The Windows installer will not continue while OBS is running.',
        macos: 'On 15 or later, if a warning stops you, open System Settings > Privacy & Security and press "Open Anyway".',
        macosOld: 'On 14 or earlier, if a warning stops you, right-click the pkg and choose "Open".',
        windows: 'If SmartScreen shows a warning, press "More info", then "Run anyway". If a User Account Control (UAC) prompt asks for administrator permission, allow it.',
      },
      open: {
        title: 'Open OBS',
        body: 'The "OBS Mapping" dock is already on the right. It appears on its own only the first time.',
        faq: 'If the dock does not appear',
      },
      connect: {
        title: 'Turn on WebSocket and connect',
        body: `Under Tools > WebSocket Server Settings, enable the server and set a password. Enter that password in the dock and press "${dock.connectConnect}". The URL can stay at the default, ws://127.0.0.1:4455. From the next launch on, the dock reconnects by itself.`,
      },
    },
    how: {
      heading: 'How to use it',
      map: {
        title: 'Add a Mapping source and fit the faces',
        body: `In OBS, add a Mapping source and choose it in the dock's "${dock.source}". Press "${dock.add}" to create a face, drag its corners onto the corners of the object, and cut it out with an ellipse or polygon under "${dock.maskHeading}".`,
        demos: 'Walk through it in the demos',
      },
    },
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
      lead: 'Three skills let scripts and agents work with mappings.',
      list: {
        'driving-obs-mapping-over-websocket': 'Read and write a Mapping source through obs-websocket vendor requests.',
        'writing-mapping-json': 'Write and fix mapping.json (v2), including how to read its validation errors.',
        'mapping-led-pixel-maps': 'Lay out one face per screen on a single canvas from an LED pixel map (chart).',
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
      importIt: `In the obs-mapping dock, press "${dock.importButton}" and load the mapping.json.`,
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
