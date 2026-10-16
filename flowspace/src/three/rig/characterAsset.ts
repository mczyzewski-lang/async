import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { setAvatarTemplate } from './avatar';

let loading: Promise<void> | null = null;
let ready = false;

/** Loads the instructor avatar (public/models/instructor.glb) once; 3D routes wait for it. */
export function preloadCharacter(): Promise<void> {
  if (!loading) {
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    const base = `${import.meta.env.BASE_URL}models/instructor.glb`;
    loading = loader
      .loadAsync(base)
      // Hosts that cannot serve .glb get a base64 JSON copy (instructor.glb.json).
      .catch(() =>
        fetch(`${base}.json`)
          .then((r) => r.json() as Promise<{ data: string }>)
          .then(({ data }) => loader.parseAsync(Uint8Array.from(atob(data), (c) => c.charCodeAt(0)).buffer, '')),
      )
      .then((gltf) => {
        gltf.scene.updateMatrixWorld(true);
        setAvatarTemplate({ root: gltf.scene });
      })
      .catch((e) => {
        console.error('Instructor avatar failed to load', e);
        loading = null;
      })
      .finally(() => {
        ready = true;
      });
  }
  return loading;
}

export function isCharacterReady() {
  return ready;
}
