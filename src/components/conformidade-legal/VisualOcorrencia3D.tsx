"use client"

import { useEffect, useRef, useState } from "react"
import { CalendarDays, Clock3, Columns3, Diamond, CircleDashed, PanelsTopLeft } from "lucide-react"

type Props = { indice: number; cor: string; intensidade: number; ativo: boolean }

const icones = [Clock3, Columns3, Diamond, CircleDashed, PanelsTopLeft, CalendarDays]
const reduzirMovimento = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches

/** Ilustração 3D compacta para a categoria do cartão que a contém. */
export function VisualOcorrencia3D({ indice, cor, intensidade, ativo }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [indisponivel, setIndisponivel] = useState(false)
  const [pronto, setPronto] = useState(false)
  const groupRef = useRef<import("three").Group | null>(null)
  const renderRef = useRef<(() => void) | null>(null)
  const accentRef = useRef<import("three").MeshStandardMaterial | null>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    let disposed = false
    let visible = false
    let frame = 0
    let renderer: import("three").WebGLRenderer | undefined
    let scene: import("three").Scene | undefined
    let camera: import("three").PerspectiveCamera | undefined
    let objeto: import("three").Group | undefined
    const recursos: Array<{ dispose: () => void }> = []
    let observer: IntersectionObserver | undefined
    let observerSize: ResizeObserver | undefined
    let canvas: HTMLCanvasElement | undefined
    let targetX = 0
    let targetY = 0
    let focused = false
    let hovered = false

    const clamp = (v: number) => Math.max(0, Math.min(1, v))
    const draw = () => {
      if (!renderer || !scene || !camera || disposed) return
      renderer.render(scene, camera)
    }

    const settle = () => {
      if (!objeto || disposed) return
      cancelAnimationFrame(frame)
      const startX = objeto.rotation.x
      const startY = objeto.rotation.y
      const dx = targetX - startX
      const dy = targetY - startY
      const started = performance.now()
      const duration = reduzirMovimento() ? 0 : 220
      const step = (now: number) => {
        if (disposed || !objeto) return
        const t = duration ? clamp((now - started) / duration) : 1
        const eased = 1 - (1 - t) ** 4
        objeto.rotation.x = startX + dx * eased
        objeto.rotation.y = startY + dy * eased
        draw()
        if (t < 1) frame = requestAnimationFrame(step)
      }
      frame = requestAnimationFrame(step)
    }

    const aim = (x: number, y: number) => {
      const motionOff = reduzirMovimento()
      targetX = motionOff ? 0 : y * 0.28
      targetY = motionOff ? 0 : x * 0.38
      settle()
    }

    const pointerTarget = host.closest("button") ?? host.parentElement ?? host
    const onPointerMove = (event: PointerEvent) => {
      const rect = pointerTarget.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      hovered = true
      aim(((event.clientX - rect.left) / rect.width - 0.5) * 2, ((event.clientY - rect.top) / rect.height - 0.5) * 2)
    }
    const onPointerLeave = () => {
      hovered = false
      if (!focused) aim(0, 0)
    }
    const onFocusIn = (event: FocusEvent) => {
      if (pointerTarget.contains(event.target as Node)) {
        focused = true
        if (!hovered) aim(0.22, -0.12)
      }
    }
    const onFocusOut = (event: FocusEvent) => {
      if (pointerTarget.contains(event.target as Node) && !pointerTarget.contains(event.relatedTarget as Node | null)) {
        focused = false
        if (!hovered) aim(0, 0)
      }
    }

    const build = async () => {
      try {
        const THREE = await import("three")
        if (disposed) return
        const rect = host.getBoundingClientRect()
        const width = Math.max(1, rect.width)
        const height = Math.max(1, rect.height)
        const colorProbe = document.createElement("span")
        colorProbe.style.color = cor
        colorProbe.style.position = "absolute"
        colorProbe.style.visibility = "hidden"
        host.appendChild(colorProbe)
        const cssColor = getComputedStyle(colorProbe).color
        colorProbe.remove()
        const tint = new THREE.Color(cssColor)
        const material = new THREE.MeshStandardMaterial({ color: tint, roughness: 0.42, metalness: 0.12 })
        const accent = new THREE.MeshStandardMaterial({ color: tint, roughness: 0.32, metalness: 0.25, emissive: tint, emissiveIntensity: 0.08 + clamp(intensidade) * 0.16 })
        accentRef.current = accent
        const dark = new THREE.MeshStandardMaterial({ color: tint, roughness: 0.55, metalness: 0.08 })
        const group = new THREE.Group()
        const mesh = (geometry: import("three").BufferGeometry, mat = material, x = 0, y = 0, z = 0) => {
          recursos.push(geometry, mat)
          const item = new THREE.Mesh(geometry, mat)
          item.position.set(x, y, z)
          group.add(item)
          return item
        }
        const box = (x: number, y: number, z: number, sx: number, sy: number, sz: number, mat = material) => mesh(new THREE.BoxGeometry(sx, sy, sz), mat, x, y, z)
        const cyl = (x: number, y: number, z: number, radiusTop: number, radiusBottom: number, h: number, mat = material, sides = 16) => mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, h, sides), mat, x, y, z)
        const torus = (x: number, y: number, z: number, radius: number, tube: number, mat = material) => mesh(new THREE.TorusGeometry(radius, tube, 8, 28), mat, x, y, z)

        switch (((indice % 6) + 6) % 6) {
          case 0: { // Relógio: intervalo entre jornadas
            torus(0, 0, 0, 0.67, 0.075, accent)
            cyl(0, 0, -0.08, 0.055, 0.055, 0.12, dark, 12)
            box(0.17, 0.23, 0.03, 0.055, 0.44, 0.07, dark)
            box(0.29, 0.02, 0.03, 0.28, 0.055, 0.07, dark)
            for (let i = 0; i < 12; i++) {
              const angle = i * Math.PI / 6
              cyl(Math.sin(angle) * 0.53, Math.cos(angle) * 0.53, 0, 0.025, 0.025, 0.045, accent, 8)
            }
            break
          }
          case 1: { // Colunas progressivas: limite de horas diárias
            const heights = [0.46, 0.72, 1.02]
            heights.forEach((h, i) => {
              const column = box((i - 1) * 0.57, -0.05 + h / 2, 0, 0.35, h, 0.36, i === 2 ? accent : material)
              column.scale.y *= 0.8 + clamp(intensidade) * 0.35
            })
            box(0, -0.32, 0, 1.95, 0.08, 0.55, dark)
            break
          }
          case 2: { // Exceção: prisma destacado
            const prism = mesh(new THREE.OctahedronGeometry(0.78, 0), accent)
            prism.rotation.z = Math.PI / 4
            box(0, -0.71, 0, 1.52, 0.09, 0.45, dark)
            break
          }
          case 3: { // Ciclo da folga semanal
            torus(0, 0, 0, 0.72, 0.15, accent)
            torus(0, 0, 0.02, 0.43, 0.07, material)
            const bead = mesh(new THREE.SphereGeometry(0.16, 12, 10), dark, 0.68, 0.28, 0.08)
            bead.scale.set(1, 1, 0.68)
            break
          }
          case 4: { // Duas colunas: escala 12×36
            cyl(-0.46, 0, 0, 0.22, 0.3, 1.45, material, 12)
            cyl(0.46, 0, 0, 0.22, 0.3, 1.45, accent, 12)
            for (let i = 0; i < 3; i++) {
              const y = -0.44 + i * 0.44
              box(-0.46, y, 0.24, 0.19, 0.08, 0.07, dark)
              box(0.46, y, 0.24, 0.19, 0.08, 0.07, dark)
            }
            box(0, -0.77, 0, 1.58, 0.08, 0.48, dark)
            break
          }
          default: { // Calendário com dias e ponto de férias
            box(0, -0.02, -0.04, 1.55, 1.35, 0.18, material)
            box(0, 0.48, 0.08, 1.58, 0.34, 0.16, accent)
            for (const x of [-0.48, 0.48]) {
              const ring = torus(x, 0.69, 0.06, 0.1, 0.035, dark)
              ring.rotation.x = Math.PI / 2
            }
            for (let row = 0; row < 2; row++) for (let col = 0; col < 4; col++) {
              cyl(-0.49 + col * 0.33, 0.13 - row * 0.34, 0.08, 0.055, 0.055, 0.055, row === 0 && col === 2 ? accent : dark, 8)
            }
            break
          }
        }

        const webgl = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" })
        renderer = webgl
        webgl.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
        webgl.setSize(width, height, false)
        webgl.outputColorSpace = THREE.SRGBColorSpace
        webgl.setClearColor("black", 0)
        canvas = webgl.domElement
        canvas.setAttribute("aria-hidden", "true")
        canvas.addEventListener("webglcontextlost", onContextLost)
        canvas.style.display = "block"
        canvas.style.width = "100%"
        canvas.style.height = "100%"
        host.appendChild(canvas)

        const currentScene = new THREE.Scene()
        currentScene.add(new THREE.HemisphereLight("white", "slategray", 2.1))
        const key = new THREE.DirectionalLight("white", 2.6)
        key.position.set(-3, 4, 5)
        currentScene.add(key)
        const fill = new THREE.DirectionalLight("white", 1.4)
        fill.position.set(3, 1, -3)
        currentScene.add(fill)
        currentScene.add(group)
        scene = currentScene
        objeto = group
        groupRef.current = group
        const currentCamera = new THREE.PerspectiveCamera(34, width / height, 0.1, 50)
        currentCamera.position.set(0, 0, 5.1)
        currentCamera.lookAt(0, 0, 0)
        camera = currentCamera
        renderRef.current = draw
        observerSize = new ResizeObserver(() => {
          if (!renderer || !camera) return
          const next = host.getBoundingClientRect()
          if (!next.width || !next.height) return
          camera.aspect = next.width / next.height
          camera.updateProjectionMatrix()
          renderer.setSize(next.width, next.height, false)
          draw()
        })
        observerSize.observe(host)
        if (ativo) group.scale.setScalar(1.05)
        draw()
        setPronto(true)
        setIndisponivel(false)
      } catch {
        // Sem WebGL (ou se o dispositivo bloquear o contexto), o ícone Lucide permanece visível.
        if (!disposed) {
          setIndisponivel(true)
          setPronto(false)
        }
      }
    }

    const onContextLost = (event: Event) => {
      event.preventDefault()
      if (!disposed) {
        setIndisponivel(true)
        setPronto(false)
      }
    }
    observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !visible) {
        visible = true
        void build()
      }
    }, { rootMargin: "80px" })
    observer.observe(host)
    pointerTarget.addEventListener("pointermove", onPointerMove)
    pointerTarget.addEventListener("pointerleave", onPointerLeave)
    window.addEventListener("focusin", onFocusIn)
    window.addEventListener("focusout", onFocusOut)

    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      observer?.disconnect()
      observerSize?.disconnect()
      pointerTarget.removeEventListener("pointermove", onPointerMove)
      pointerTarget.removeEventListener("pointerleave", onPointerLeave)
      window.removeEventListener("focusin", onFocusIn)
      window.removeEventListener("focusout", onFocusOut)
      canvas?.removeEventListener("webglcontextlost", onContextLost)
      if (canvas?.parentElement === host) host.removeChild(canvas)
      renderer?.renderLists.dispose()
      renderer?.dispose()
      renderer?.forceContextLoss()
      recursos.forEach((recurso) => recurso.dispose())
      groupRef.current = null
      renderRef.current = null
      accentRef.current = null
    }
    // A cena é criada uma vez por cartão, sem animação contínua em repouso.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (groupRef.current) groupRef.current.scale.setScalar(ativo ? 1.05 : 1)
    if (accentRef.current) accentRef.current.emissiveIntensity = 0.08 + Math.max(0, Math.min(1, intensidade)) * 0.16
    renderRef.current?.()
  }, [ativo, intensidade])

  const Icon = icones[((indice % icones.length) + icones.length) % icones.length]
  return (
    <div ref={hostRef} className="relative h-24 w-full overflow-hidden" data-ocorrencia-3d="true" aria-hidden="true">
      <span className={`absolute inset-0 flex items-center justify-center ${pronto && !indisponivel ? "opacity-0" : "opacity-100"}`} style={{ color: cor }}>
        <Icon className="h-9 w-9" strokeWidth={1.5} />
      </span>
      {indisponivel && <span className="sr-only">Visualização 3D indisponível</span>}
    </div>
  )
}
