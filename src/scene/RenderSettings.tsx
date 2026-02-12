import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { ACESFilmicToneMapping, PMREMGenerator, SRGBColorSpace } from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment'

export default function RenderSettings() {
  const { gl, scene } = useThree()

  useEffect(() => {
    const pmrem = new PMREMGenerator(gl)
    const env = new RoomEnvironment()
    const envMap = pmrem.fromScene(env).texture

    scene.environment = envMap
    gl.toneMapping = ACESFilmicToneMapping
    gl.toneMappingExposure = 1.1
    gl.outputColorSpace = SRGBColorSpace

    return () => {
      env.dispose()
      pmrem.dispose()
      envMap.dispose()
    }
  }, [gl, scene])

  return null
}
