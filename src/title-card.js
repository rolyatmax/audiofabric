const fit = require('canvas-fit')
const css = require('dom-css')
const Alea = require('alea')
const { createSpring } = require('spring-animator')

const settings = {
  text: 'audiofabric',
  particles: 600,
  dampening: 0.35, // 0.17
  stiffness: 0.85, // 0.9
  speed: 50,
  precision: 0.98,
  lineOpacity: 0.17,
  turnGranularity: 12,
  startSpreadMultiplier: 0.35,
  particleDieRate: 0,
  colorThreshold: 200,
  particleSize: 1
}

const container = document.querySelector('.title-card-container')
const canvas = container.querySelector('canvas')
const ctx = canvas.getContext('2d')
ctx.globalCompositeOperation = 'lighter'
const resize = fit(canvas)
window.addEventListener('resize', resize)

const instructions = container.querySelector('.instructions')
const button = container.querySelector('button')

let rand, points, pixelPicker, rAFToken, start, isFading

module.exports = function createTitleCard () {
  return {
    resize: function () {
      if (isFading) return
      start = Date.now()
      resize()
      setup()
      loop()
    },
    show: function () {
      start = Date.now()
      setTimeout(() => {
        css(instructions, { opacity: 1 })
      }, 1500)
      setup()
      loop()
      return new Promise((resolve) => {
        button.addEventListener('click', (e) => {
          e.preventDefault()
          remove()
          activateDrawers()
          resolve()
          return false
        })
      })
    }
  }

  function remove () {
    isFading = true
    css(canvas, {
      transition: 'opacity 1500ms linear',
      opacity: 0
    })
    css(instructions, { opacity: 0 })
    setTimeout(() => {
      window.removeEventListener('resize', resize)
      window.cancelAnimationFrame(rAFToken)
      container.parentElement.removeChild(container)
    }, 1700)
  }

  function loop () {
    if (!isFading && (Date.now() - start) > 30000) return
    window.cancelAnimationFrame(rAFToken)
    rAFToken = window.requestAnimationFrame(loop)
    update()
    draw()
  }

  function setup () {
    const seed = Math.random() * 1000 | 0 // 74 & 336 looks good
    rand = new Alea(seed)
    console.log(`seed: ${seed}`)
    pixelPicker = getSource()
    points = (new Array(settings.particles)).fill().map(() => {
      const rads = rand() * Math.PI * 2
      const mag = Math.pow(rand(), 0.5) * settings.startSpreadMultiplier * Math.max(window.innerWidth, window.innerHeight)
      return {
        x: Math.cos(rads) * mag + ctx.canvas.width / 2,
        y: Math.sin(rads) * mag + ctx.canvas.height / 2,
        angle: createSpring(settings.dampening, settings.stiffness, rand() * Math.PI * 2),
        speed: rand() * settings.speed / 40,
        entropy: rand(),
        isActive: true,
        line: []
      }
    })
  }

  function update () {
    points.forEach((p) => {
      if (!p.isActive) return
      const color = pixelPicker(p.x, p.y)
      const averageVal = getAveragePixelVal(color)
      const isOnActivePixel = p.line.length || averageVal < settings.colorThreshold

      if (isOnActivePixel) {
        p.line.push([p.x, p.y])
      }

      if (rand() < settings.precision) {
        updateNextAngle(p, pixelPicker)
      }

      const angle = p.angle.tick()
      const velX = Math.cos(angle) * p.speed
      const velY = Math.sin(angle) * p.speed
      p.x += velX
      p.y += velY

      if (rand() < settings.particleDieRate / 10) {
        p.isActive = false
      }
    })

    let i = 0
    while (i < points.length) {
      const p = points[i]
      if (!p.line.length && (p.x < 0 || p.y < 0 || p.x > ctx.canvas.width || p.y > ctx.canvas.height)) {
        points.splice(i, 1)
      } else {
        i += 1
      }
    }
  }

  function updateNextAngle (p, pixelPicker) {
    const angle = p.angle.tick(1, false)
    const currentPixelVal = getAveragePixelVal(pixelPicker(p.x, p.y))
    for (let i = 0; i <= settings.turnGranularity; i += 1) {
      const t = i / settings.turnGranularity * Math.PI
      let velX = Math.cos(angle + t) * p.speed
      let velY = Math.sin(angle + t) * p.speed
      let pixel = pixelPicker(p.x + velX, p.y + velY)
      if (getAveragePixelVal(pixel) < currentPixelVal) {
        p.angle.updateValue(angle + t)
        break
      }
      velX = Math.cos(angle - t) * p.speed
      velY = Math.sin(angle - t) * p.speed
      pixel = pixelPicker(p.x + velX, p.y + velY)
      if (getAveragePixelVal(pixel) < currentPixelVal) {
        p.angle.updateValue(angle - t)
        break
      }
    }
  }

  function activateDrawers () {
    settings.precision = 0.4
    points.forEach((p) => {
      p.isActive = true
      p.speed *= rand() * 10
      p.angle = createSpring(0.05, 0.9, p.angle.tick())
      p.angle.updateValue(rand() * Math.PI * 2)
    })
  }

  function draw () {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (settings.particleSize) {
      points.forEach((p) => {
        if (!p.isActive) return
        const radius = p.line.length ? settings.particleSize : 0
        const opacity = 0.2 * (radius < 10 ? radius / 10 : 1)
        ctx.strokeStyle = `rgba(200, 200, 255, ${opacity})`
        ctx.beginPath()
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2)
        ctx.stroke()
      })
    }

    ctx.beginPath()
    ctx.strokeStyle = `rgba(200, 200, 255, ${settings.lineOpacity})`
    points.forEach((p) => {
      if (p.line.length > 1) {
        ctx.moveTo(p.line[0][0], p.line[0][1])
        p.line.slice(1).forEach(pt => {
          ctx.lineTo(pt[0], pt[1])
        })
      }
    })
    ctx.stroke()
  }
}

// ---------

function getAveragePixelVal (pixel) {
  return (pixel.r + pixel.g + pixel.b) / 3
}

function getSource () {
  const hiddenCanvas = container.appendChild(document.createElement('canvas'))
  const hiddenCtx = hiddenCanvas.getContext('2d')
  fit(hiddenCanvas)
  hiddenCanvas.style.display = 'none'
  hiddenCtx.fillStyle = 'rgb(255, 255, 255)'
  hiddenCtx.fillRect(0, 0, hiddenCanvas.width, hiddenCanvas.height)
  printText(hiddenCtx, settings.text, Math.min(hiddenCanvas.width, hiddenCanvas.height) * 0.1)
  const picker = makePixelPicker(hiddenCanvas)
  hiddenCanvas.parentElement.removeChild(hiddenCanvas)
  return picker
}

function makePixelPicker (canvas) {
  const imageData = canvas.getContext('2d').getImageData(
    0, 0, canvas.width, canvas.height
  )
  return (x, y) => {
    x = x | 0
    y = y | 0
    const i = 4 * (x + y * imageData.width)
    return {
      r: imageData.data[i],
      g: imageData.data[i + 1],
      b: imageData.data[i + 2],
      a: imageData.data[i + 3]
    }
  }
}

function printText (context, text, size) {
  context.font = `${size}px "Open Sans"`
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillStyle = 'rgb(0, 0, 0)'
  context.fillText(text, context.canvas.width / 2, context.canvas.height / 3)
}
