import * as THREE from 'three';

export type ProjectorBody = { group: THREE.Group; dispose(): void };

const BODY = { width: 0.34, height: 0.13, depth: 0.28 } as const;
const LENS = { radius: 0.05, length: 0.05 } as const;
const FOOT = { radius: 0.18, height: 0.03 } as const;
const STAND_RADIUS = 0.02;

const meshAt = (geometry: THREE.BufferGeometry, material: THREE.Material, position: THREE.Vector3Tuple, name = ''): THREE.Mesh => {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.name = name;
  return mesh;
};

// The lens sits on the projector position; the box trails behind it, offset like a real side-lens projector.
const createHead = (shell: THREE.Material, glass: THREE.Material, glow: THREE.Material): THREE.Group => {
  const head = new THREE.Group();
  const body = meshAt(new THREE.BoxGeometry(BODY.width, BODY.height, BODY.depth), shell, [-0.07, 0, BODY.depth / 2 + LENS.length / 2]);
  const lens = meshAt(new THREE.CylinderGeometry(LENS.radius * 0.9, LENS.radius, LENS.length, 32).rotateX(Math.PI / 2), glass, [0, 0, 0], 'projector-lens');
  const face = meshAt(new THREE.CircleGeometry(LENS.radius * 0.7, 32).rotateY(Math.PI), glow, [0, 0, -LENS.length / 2 - 0.001]);
  head.add(body, lens, face);
  return head;
};

const createStand = (top: THREE.Vector3, floor: number, shell: THREE.Material): THREE.Mesh[] => {
  const height = Math.max(0, top.y - BODY.height / 2 - floor);
  return [
    meshAt(new THREE.CylinderGeometry(STAND_RADIUS, STAND_RADIUS, height, 12), shell, [top.x, floor + height / 2, top.z]),
    meshAt(new THREE.CylinderGeometry(FOOT.radius, FOOT.radius * 1.1, FOOT.height, 32), shell, [top.x, floor + FOOT.height / 2, top.z]),
  ];
};

const disposeTree = (group: THREE.Group): void =>
  group.traverse((o) => {
    if (o instanceof THREE.Mesh && o.geometry instanceof THREE.BufferGeometry) o.geometry.dispose();
  });

/** A small lit projector on a stand at the projector pose, so the source of the light is visible. */
export const createProjectorBody = (projector: THREE.PerspectiveCamera, floor: number): ProjectorBody => {
  const shell = new THREE.MeshStandardMaterial({ color: 0xb4bac6, roughness: 0.6, metalness: 0.1 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x1c1e22, roughness: 0.25 });
  const glow = new THREE.MeshBasicMaterial({ color: 0xfff3d0 });
  const position = projector.getWorldPosition(new THREE.Vector3());
  const head = createHead(shell, glass, glow);
  head.position.copy(position);
  head.quaternion.copy(projector.getWorldQuaternion(new THREE.Quaternion()));
  const group = new THREE.Group();
  group.name = 'projector-body';
  group.add(head, ...createStand(position, floor, shell));
  return {
    group,
    dispose() {
      disposeTree(group);
      [shell, glass, glow].forEach((m) => m.dispose());
    },
  };
};
