/**
 * Node-only loader for the instructor avatar (tests, content validation and pose fitting).
 * Builds bones and skinned meshes from the glTF without textures, mirroring what GLTFLoader produces.
 */
import * as THREE from 'three';
import { NodeIO, type Node as GNode } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { resolve } from 'node:path';
import { setAvatarTemplate, getAvatarTemplate, type AvatarTemplate } from './avatar';

export async function loadAvatarNode(path = resolve(import.meta.dirname, '../../../public/models/instructor.glb')): Promise<AvatarTemplate> {
  const existing = getAvatarTemplate();
  if (existing) return existing;
  await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
  const doc = await io.read(path);
  const root = new THREE.Group();
  const objOf = new Map<GNode, THREE.Object3D>();
  const jointNodes = new Set<GNode>();
  for (const skin of doc.getRoot().listSkins()) skin.listJoints().forEach((j) => jointNodes.add(j));

  const make = (n: GNode, parent: THREE.Object3D) => {
    const o = jointNodes.has(n) ? new THREE.Bone() : new THREE.Object3D();
    o.name = n.getName();
    o.position.fromArray(n.getTranslation());
    o.quaternion.fromArray(n.getRotation());
    o.scale.fromArray(n.getScale());
    parent.add(o);
    objOf.set(n, o);
    n.listChildren().forEach((c) => make(c, o));
  };
  for (const scene of doc.getRoot().listScenes()) scene.listChildren().forEach((n) => make(n, root));
  root.updateMatrixWorld(true);

  for (const [n, o] of objOf) {
    const mesh = n.getMesh();
    const skin = n.getSkin();
    if (!mesh || !skin) continue;
    for (const prim of mesh.listPrimitives()) {
      const g = new THREE.BufferGeometry();
      const attr = (name: string, item: number, Arr: Float32ArrayConstructor | Uint16ArrayConstructor) => {
        const a = prim.getAttribute(name)!;
        const out = new Arr(a.getCount() * item);
        const el: number[] = [];
        for (let i = 0; i < a.getCount(); i++) {
          a.getElement(i, el);
          for (let k = 0; k < item; k++) out[i * item + k] = el[k];
        }
        return out;
      };
      g.setAttribute('position', new THREE.BufferAttribute(attr('POSITION', 3, Float32Array), 3));
      g.setAttribute('skinIndex', new THREE.BufferAttribute(attr('JOINTS_0', 4, Uint16Array), 4));
      g.setAttribute('skinWeight', new THREE.BufferAttribute(attr('WEIGHTS_0', 4, Float32Array), 4));
      const idx = prim.getIndices();
      if (idx) g.setIndex(Array.from(idx.getArray()!));
      const sm = new THREE.SkinnedMesh(g, new THREE.MeshBasicMaterial());
      sm.name = n.getName() || mesh.getName();
      o.add(sm);
      sm.updateMatrixWorld(true);
      const ibm = skin.getInverseBindMatrices()!;
      const bones = skin.listJoints().map((j) => objOf.get(j) as THREE.Bone);
      const inverses = bones.map((_, i) => new THREE.Matrix4().fromArray(ibm.getElement(i, [])));
      sm.bind(new THREE.Skeleton(bones, inverses), sm.matrixWorld);
    }
  }
  const tpl = { root };
  setAvatarTemplate(tpl);
  return tpl;
}
