import { en as dock } from '../../../ui/src/i18n/messages/en';
import { DEMO_SOURCE } from '../scene/spec';
import type { SiteMessages, StepCopy } from './messages';

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
    demos: 'See the demos',
    github: 'GitHub',
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
